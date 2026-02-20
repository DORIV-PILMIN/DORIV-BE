import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StudyScheduleClaimService } from './study-schedule-claim.service';
import { StudyScheduleProcessingService } from './study-schedule-processing.service';

@Injectable()
export class StudySchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(StudySchedulerService.name);

  constructor(
    private readonly studyScheduleClaimService: StudyScheduleClaimService,
    private readonly studyScheduleProcessingService: StudyScheduleProcessingService,
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
    const dueSchedules = await this.studyScheduleClaimService.claimDueSchedules();
    for (const schedule of dueSchedules) {
      await this.studyScheduleProcessingService.processSchedule(schedule);
    }
  }
}
