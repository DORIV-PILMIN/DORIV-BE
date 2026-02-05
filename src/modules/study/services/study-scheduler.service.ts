import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { StudySchedule } from '../entities/study-schedule.entity';
import { StudyPlan } from '../entities/study-plan.entity';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { Question } from '../../question/entities/question.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';

@Injectable()
export class StudySchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;

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
  ) {}

  onModuleInit(): void {
    this.intervalId = setInterval(() => {
      this.processDueSchedules().catch(() => null);
    }, 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async processDueSchedules(): Promise<void> {
    const now = new Date();
    const dueSchedules = await this.scheduleRepository.find({
      where: { status: 'PENDING', scheduledAt: LessThanOrEqual(now) },
      order: { scheduledAt: 'ASC' },
      take: 20,
    });

    for (const schedule of dueSchedules) {
      await this.processSchedule(schedule);
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
