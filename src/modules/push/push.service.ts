import { Injectable } from '@nestjs/common';
import { PushTokenRegisterRequestDto } from './dtos/push-token-register-request.dto';
import { PushTokenRegisterResponseDto } from './dtos/push-token-register-response.dto';
import { PushSendRequestDto } from './dtos/push-send-request.dto';
import { PushSendResponseDto } from './dtos/push-send-response.dto';
import { PushSendLogListResponseDto } from './dtos/push-send-log-list-response.dto';
import { FcmAuthService } from './services/fcm-auth.service';
import {
  FcmMessageService,
  PushSendResult,
} from './services/fcm-message.service';
import { PushLogService } from './services/push-log.service';
import { PushTokenService } from './services/push-token.service';

type DeliveryItem = {
  pushTokenId: string;
  token: string;
  status: PushSendResult['status'];
  errorCode: string | null;
};

@Injectable()
export class PushService {
  private readonly sendConcurrency = 10;

  constructor(
    private readonly pushTokenService: PushTokenService,
    private readonly fcmAuthService: FcmAuthService,
    private readonly fcmMessageService: FcmMessageService,
    private readonly pushLogService: PushLogService,
  ) {}

  async registerToken(
    userId: string,
    dto: PushTokenRegisterRequestDto,
    userAgent: string | null,
  ): Promise<PushTokenRegisterResponseDto> {
    return this.pushTokenService.registerToken(userId, dto, userAgent);
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    await this.pushTokenService.deleteToken(userId, token);
  }

  getVapidPublicKey(): string {
    return this.fcmAuthService.getVapidPublicKey();
  }

  async sendToUser(
    userId: string,
    dto: PushSendRequestDto,
  ): Promise<PushSendResponseDto> {
    const tokens = await this.pushTokenService.findByUserId(userId);
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokenRemoved: 0 };
    }

    let successCount = 0;
    let failureCount = 0;
    let invalidTokenRemoved = 0;

    const title = dto.title || '일주일이 지났어요!';
    const body = dto.body || '지금 복습하면 기억이 더 오래가요.';

    const items = await this.runWithConcurrency(
      tokens,
      this.sendConcurrency,
      async (tokenEntity) => {
        const result = await this.fcmMessageService.sendToToken(
          tokenEntity.token,
          {
            ...dto,
            title,
            body,
          },
        );

        return {
          pushTokenId: tokenEntity.pushTokenId,
          token: tokenEntity.token,
          status: result.status,
          errorCode: result.errorCode,
        } satisfies DeliveryItem;
      },
    );

    const invalidTokens: string[] = [];
    for (const item of items) {
      if (item.status === 'ok') {
        successCount += 1;
      } else if (item.status === 'invalid') {
        invalidTokenRemoved += 1;
        invalidTokens.push(item.token);
      } else {
        failureCount += 1;
      }
    }

    if (invalidTokens.length > 0) {
      await this.pushTokenService.deleteByTokenValues(invalidTokens);
    }

    await this.pushLogService.createMany(
      items.map((item) => ({
        userId,
        pushTokenId: item.pushTokenId,
        title,
        body,
        data: dto.data ?? null,
        status: item.status.toUpperCase(),
        errorCode: item.errorCode,
      })),
    );

    return { successCount, failureCount, invalidTokenRemoved };
  }

  async getLogs(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PushSendLogListResponseDto> {
    return this.pushLogService.getLogs(userId, page, pageSize);
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results: R[] = new Array(items.length);
    let cursor = 0;

    const runner = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        results[index] = await worker(items[index]);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runner(),
    );
    await Promise.all(workers);
    return results;
  }
}
