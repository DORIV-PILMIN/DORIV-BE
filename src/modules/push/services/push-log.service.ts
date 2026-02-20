import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSendLog } from '../entities/push-send-log.entity';
import { PushSendLogListResponseDto } from '../dtos/push-send-log-list-response.dto';

export type PushSendLogWriteInput = {
  userId: string;
  pushTokenId: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  status: string;
  errorCode: string | null;
};

@Injectable()
export class PushLogService {
  constructor(
    @InjectRepository(PushSendLog)
    private readonly pushSendLogRepository: Repository<PushSendLog>,
  ) {}

  async createMany(items: PushSendLogWriteInput[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const logs = items.map((item) =>
      this.pushSendLogRepository.create({
        userId: item.userId,
        pushTokenId: item.pushTokenId,
        title: item.title,
        body: item.body,
        data: item.data,
        status: item.status,
        errorCode: item.errorCode,
      }),
    );

    await this.pushSendLogRepository.save(logs);
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
}
