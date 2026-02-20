import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionAttempt } from '../../question/entities/question-attempt.entity';
import { QuestionStatus } from '../../question/entities/question-status.entity';
import { MainStatsDto } from '../dtos/main-stats.dto';

@Injectable()
export class MainStatsService {
  constructor(
    @InjectRepository(QuestionStatus)
    private readonly questionStatusRepository: Repository<QuestionStatus>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepository: Repository<QuestionAttempt>,
  ) {}

  async getStats(userId: string): Promise<MainStatsDto> {
    const flashcardCountRaw = await this.questionStatusRepository
      .createQueryBuilder('qs')
      .select('COUNT(DISTINCT qs.questionId)', 'count')
      .where('qs.userId = :userId', { userId })
      .getRawOne<{ count: string }>();

    const retentionRateRaw = await this.questionAttemptRepository
      .createQueryBuilder('qa')
      .select('AVG(qa.score)', 'avg')
      .where('qa.userId = :userId', { userId })
      .andWhere('qa.score IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

    return {
      flashcardCount: flashcardCountRaw ? Number(flashcardCountRaw.count) : 0,
      retentionRate: retentionRateRaw?.avg ? Number(retentionRateRaw.avg) : null,
    };
  }
}
