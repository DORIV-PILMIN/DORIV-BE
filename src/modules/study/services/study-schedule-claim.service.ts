import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StudySchedule } from '../entities/study-schedule.entity';

@Injectable()
export class StudyScheduleClaimService {
  constructor(private readonly dataSource: DataSource) {}

  async claimDueSchedules(): Promise<StudySchedule[]> {
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
}
