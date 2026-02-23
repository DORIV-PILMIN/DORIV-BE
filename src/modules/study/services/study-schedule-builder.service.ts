import { Injectable } from '@nestjs/common';

type KstDateParts = {
  year: number;
  month: number;
  day: number;
};

export type StudyScheduleSeed = {
  planId: string;
  dayIndex: number;
  scheduledAt: Date;
  status: string;
  snapshotId: string | null;
  generatedAt: Date | null;
  failureReason: string | null;
};

@Injectable()
export class StudyScheduleBuilderService {
  private static readonly KST_OFFSET_HOURS = 9;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  getTodayDateInKst(): string {
    const { year, month, day } = this.getKstDateParts(0);
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  buildScheduleSeeds(planId: string, days: number): StudyScheduleSeed[] {
    const schedules: StudyScheduleSeed[] = [];

    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      const { year, month, day } = this.getKstDateParts(dayOffset);
      const scheduledAtUtc = new Date(
        Date.UTC(
          year,
          month,
          day,
          -StudyScheduleBuilderService.KST_OFFSET_HOURS,
          0,
          0,
        ),
      );

      schedules.push({
        planId,
        dayIndex: dayOffset,
        scheduledAt: scheduledAtUtc,
        status: 'PENDING',
        snapshotId: null,
        generatedAt: null,
        failureReason: null,
      });
    }

    return schedules;
  }

  private getKstDateParts(dayOffset = 0): KstDateParts {
    const now = Date.now();
    const kstMs =
      now +
      StudyScheduleBuilderService.KST_OFFSET_HOURS * 60 * 60 * 1000 +
      dayOffset * StudyScheduleBuilderService.MS_PER_DAY;
    const kstDate = new Date(kstMs);

    return {
      year: kstDate.getUTCFullYear(),
      month: kstDate.getUTCMonth(),
      day: kstDate.getUTCDate(),
    };
  }
}
