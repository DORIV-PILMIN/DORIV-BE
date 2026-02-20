import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { PushService } from '../../push/push.service';
import { Question } from '../../question/entities/question.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudySchedule } from '../entities/study-schedule.entity';

@Injectable()
export class StudyScheduleProcessingService {
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
  ) {}

  async processSchedule(schedule: StudySchedule): Promise<void> {
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
