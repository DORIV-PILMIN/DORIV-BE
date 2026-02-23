import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';

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

@Injectable()
export class FcmAuthService {
  private accessTokenCache: CachedAccessToken | null = null;
  private readonly requestTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.requestTimeoutMs = Number(
      configService.get<string>('FCM_TIMEOUT_MS') ?? 10000,
    );
  }

  getVapidPublicKey(): string {
    return this.configService.getOrThrow<string>('FCM_VAPID_PUBLIC_KEY');
  }

  getProjectId(): string {
    return this.getServiceAccount().project_id;
  }

  async getAccessToken(): Promise<string> {
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
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(`FCM 토큰 발급 실패: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private getServiceAccount(): ServiceAccount {
    const raw = this.configService.getOrThrow<string>(
      'FCM_SERVICE_ACCOUNT_JSON',
    );
    try {
      const parsed = JSON.parse(raw) as ServiceAccount;
      if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
        throw new Error('missing required fields');
      }
      return parsed;
    } catch {
      throw new InternalServerErrorException(
        'FCM_SERVICE_ACCOUNT_JSON 형식이 올바르지 않습니다.',
      );
    }
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
    const buffer =
      typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buffer
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
