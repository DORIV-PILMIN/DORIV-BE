import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushSendRequestDto } from '../dtos/push-send-request.dto';
import { FcmAuthService } from './fcm-auth.service';

export type PushSendResult = {
  status: 'ok' | 'invalid' | 'fail';
  errorCode: string | null;
};

@Injectable()
export class FcmMessageService {
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly fcmAuthService: FcmAuthService,
    private readonly configService: ConfigService,
  ) {
    this.requestTimeoutMs = Number(
      configService.get<string>('FCM_TIMEOUT_MS') ?? 10000,
    );
  }

  async sendToToken(
    token: string,
    dto: PushSendRequestDto,
  ): Promise<PushSendResult> {
    const accessToken = await this.fcmAuthService.getAccessToken();
    const projectId = this.fcmAuthService.getProjectId();
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
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (response.ok) {
      return { status: 'ok', errorCode: null };
    }

    let errorCode: string | null = null;
    try {
      const body = (await response.json()) as {
        error?: { details?: Array<{ errorCode?: string }> };
      };
      errorCode =
        body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? null;
    } catch {
      // ignore
    }

    if (
      response.status === 404 ||
      errorCode === 'UNREGISTERED' ||
      errorCode === 'INVALID_ARGUMENT'
    ) {
      return { status: 'invalid', errorCode };
    }

    return { status: 'fail', errorCode };
  }
}
