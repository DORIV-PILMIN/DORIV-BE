import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StudySchedule } from '../entities/study-schedule.entity';
import { StudyPlan } from '../entities/study-plan.entity';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { Question } from '../../question/entities/question.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';
import { PushService } from '../../push/push.service';

@Injectable()
export class StudySchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(StudySchedulerService.name);

  constructor(
    @InjectRepository(StudySchedule)
    private readonly scheduleRepository: Repository<StudySchedule>,
    @InjectRepository(StudyPlan)
    private readonly planRepository: Repository<StudyPlan>,
    @InjectRepository(PageSnapshot)
    private readonly snapshotRepository: Repository<PageSnapshot>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    private readonly questionGenerationService: QuestionGenerationService,
    private readonly pushService: PushService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.intervalId = setInterval(() => {
      this.processDueSchedules().catch((error: unknown) => {
        this.logger.error('Failed to process due schedules', error as Error);
      });
    }, 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async processDueSchedules(): Promise<void> {
    const dueSchedules = await this.claimDueSchedules();
    for (const schedule of dueSchedules) {
      await this.processSchedule(schedule);
    }
  }

  private async claimDueSchedules(): Promise<StudySchedule[]> {
    const now = new Date();
    const staleTime = new Date(now.getTime() - 10 * 60 * 1000);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const dueSchedules = await queryRunner.manager
        .createQueryBuilder(StudySchedule, 'schedule')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('schedule.scheduledAt <= :now', { now })
        .andWhere(
          `(schedule.status = 'PENDING' OR (schedule.status = 'PROCESSING' AND schedule.updatedAt <= :staleTime))`,
          { staleTime },
        )
        .orderBy('schedule.scheduledAt', 'ASC')
        .take(20)
        .getMany();

      for (const schedule of dueSchedules) {
        schedule.status = 'PROCESSING';
        schedule.failureReason = null;
      }

      if (dueSchedules.length > 0) {
        await queryRunner.manager.save(StudySchedule, dueSchedules);
      }

      await queryRunner.commitTransaction();
      return dueSchedules;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async processSchedule(schedule: StudySchedule): Promise<void> {
    try {
      const plan = await this.planRepository.findOne({ where: { planId: schedule.planId } });
      if (!plan) {
        throw new Error('plan not found');
      }

      const latestSnapshot = await this.snapshotRepository.findOne({
        where: { pageId: plan.pageId },
        order: { createdAt: 'DESC' },
      });
      if (!latestSnapshot) {
        throw new Error('latest snapshot not found');
      }

      const existingCount = await this.questionRepository.count({
        where: { scheduleId: schedule.scheduleId },
      });
      const needsRegenerate =
        existingCount === 0 || schedule.snapshotId !== latestSnapshot.snapshotId;

      if (needsRegenerate) {
        await this.questionRepository.delete({ scheduleId: schedule.scheduleId });
        await this.questionGenerationService.generateFromSnapshot(
          latestSnapshot.snapshotId,
          plan.questionsPerDay,
          schedule.scheduleId,
        );
        schedule.snapshotId = latestSnapshot.snapshotId;
        schedule.generatedAt = new Date();
      }

      const pushResult = await this.pushService.sendToUser(plan.userId, {});
      if (pushResult.successCount === 0 && pushResult.failureCount > 0) {
        throw new Error('push send failed');
      }

      schedule.status = 'SENT';
      schedule.failureReason = null;
      await this.scheduleRepository.save(schedule);
    } catch (error) {
      schedule.status = 'FAILED';
      schedule.failureReason = this.formatError(error);
      await this.scheduleRepository.save(schedule);
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'schedule processing failed';
  }
}
