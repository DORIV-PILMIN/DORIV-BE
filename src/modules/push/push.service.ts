import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { createSign } from 'crypto';
import { PushToken } from './entities/push-token.entity';
import { PushSendLog } from './entities/push-send-log.entity';
import { PushTokenRegisterRequestDto } from './dtos/push-token-register-request.dto';
import { PushTokenRegisterResponseDto } from './dtos/push-token-register-response.dto';
import { PushSendRequestDto } from './dtos/push-send-request.dto';
import { PushSendResponseDto } from './dtos/push-send-response.dto';
import { PushSendLogListResponseDto } from './dtos/push-send-log-list-response.dto';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  private_key_id?: string;
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

type SendResult = {
  status: 'ok' | 'invalid' | 'fail';
  errorCode: string | null;
};

@Injectable()
export class PushService {
  private accessTokenCache: CachedAccessToken | null = null;

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
    @InjectRepository(PushSendLog)
    private readonly pushSendLogRepository: Repository<PushSendLog>,
    private readonly configService: ConfigService,
  ) {}

  async registerToken(
    userId: string,
    dto: PushTokenRegisterRequestDto,
    userAgent: string | null,
  ): Promise<PushTokenRegisterResponseDto> {
    const token = dto.token.trim();
    if (!token) {
      throw new BadRequestException('푸시 토큰이 비어 있습니다.');
    }

    const platform = dto.platform?.trim() || 'WEB';
    const deviceType = dto.deviceType?.trim() || 'UNKNOWN';

    const existing = await this.pushTokenRepository.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.deviceType = deviceType;
      existing.userAgent = userAgent;
      const saved = await this.pushTokenRepository.save(existing);
      return {
        pushTokenId: saved.pushTokenId,
        token: saved.token,
        platform: saved.platform,
        deviceType: saved.deviceType,
      };
    }

    const entity = this.pushTokenRepository.create({
      userId,
      token,
      platform,
      deviceType,
      userAgent,
    });
    const saved = await this.pushTokenRepository.save(entity);
    return {
      pushTokenId: saved.pushTokenId,
      token: saved.token,
      platform: saved.platform,
      deviceType: saved.deviceType,
    };
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    await this.pushTokenRepository.delete({ userId, token });
  }

  getVapidPublicKey(): string {
    return this.configService.getOrThrow<string>('FCM_VAPID_PUBLIC_KEY');
  }

  async sendToUser(userId: string, dto: PushSendRequestDto): Promise<PushSendResponseDto> {
    const tokens = await this.pushTokenRepository.find({ where: { userId } });
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokenRemoved: 0 };
    }

    let successCount = 0;
    let failureCount = 0;
    let invalidTokenRemoved = 0;

    const title = dto.title || '일주일이 지났어요!';
    const body = dto.body || '지금 복습하면 기억이 더 오래가요.';

    for (const token of tokens) {
      const result = await this.sendToToken(token.token, { ...dto, title, body });
      if (result.status === 'ok') {
        successCount += 1;
      } else if (result.status === 'invalid') {
        invalidTokenRemoved += 1;
        await this.pushTokenRepository.delete({ token: token.token });
      } else {
        failureCount += 1;
      }

      await this.pushSendLogRepository.save(
        this.pushSendLogRepository.create({
          userId,
          pushTokenId: token.pushTokenId,
          title,
          body,
          data: dto.data ?? null,
          status: result.status.toUpperCase(),
          errorCode: result.errorCode,
        }),
      );
    }

    return { successCount, failureCount, invalidTokenRemoved };
  }

  async getLogs(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PushSendLogListResponseDto> {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [logs, total] = await this.pushSendLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return {
      logs: logs.map((log) => ({
        logId: log.pushSendLogId,
        pushTokenId: log.pushTokenId,
        title: log.title,
        body: log.body,
        status: log.status,
        errorCode: log.errorCode,
        createdAt: log.createdAt,
      })),
      page: Math.max(page, 1),
      pageSize: take,
      total,
    };
  }

  private async sendToToken(token: string, dto: PushSendRequestDto): Promise<SendResult> {
    const accessToken = await this.getAccessToken();
    const projectId = this.getServiceAccount().project_id;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const payload: Record<string, unknown> = {
      message: {
        token,
        notification: {
          title: dto.title,
          body: dto.body,
        },
        data: dto.data ?? undefined,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { status: 'ok', errorCode: null };
    }

    let errorCode: string | null = null;
    try {
      const body = (await response.json()) as {
        error?: { details?: Array<{ errorCode?: string }> };
      };
      errorCode = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? null;
    } catch {
      // ignore
    }

    if (response.status === 404 || errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
      return { status: 'invalid', errorCode };
    }

    return { status: 'fail', errorCode };
  }

  private getServiceAccount(): ServiceAccount {
    const raw = this.configService.getOrThrow<string>('FCM_SERVICE_ACCOUNT_JSON');
    try {
      const parsed = JSON.parse(raw) as ServiceAccount;
      if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
        throw new Error('missing required fields');
      }
      return parsed;
    } catch {
      throw new InternalServerErrorException('FCM_SERVICE_ACCOUNT_JSON 형식이 올바르지 않습니다.');
    }
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.accessTokenCache;
    if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
      return cached.token;
    }

    const serviceAccount = this.getServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60;

    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: serviceAccount.private_key_id,
    };
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp,
    };

    const jwt = this.signJwt(header, payload, serviceAccount.private_key);

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(`FCM 토큰 발급 실패: ${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private signJwt(
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    privateKey: string,
  ): string {
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();

    const signature = signer.sign(privateKey);
    const encodedSignature = this.base64UrlEncode(signature);

    return `${unsigned}.${encodedSignature}`;
  }

  private base64UrlEncode(input: string | Buffer): string {
    const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buffer
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
