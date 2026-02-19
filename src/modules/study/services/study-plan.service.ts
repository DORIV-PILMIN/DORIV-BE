import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../../notion/entities/notion-page.entity';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudySchedule } from '../entities/study-schedule.entity';
import { StudyPlanRequestDto } from '../dtos/study-plan-request.dto';
import { StudyPlanResponseDto } from '../dtos/study-plan-response.dto';

@Injectable()
export class StudyPlanService {
  private readonly timezone = 'Asia/Seoul';
  private static readonly KST_OFFSET_HOURS = 9;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudySchedule)
    private readonly studyScheduleRepository: Repository<StudySchedule>,
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
    @InjectRepository(PageSnapshot)
    private readonly pageSnapshotRepository: Repository<PageSnapshot>,
    private readonly questionGenerationService: QuestionGenerationService,
  ) {}

  async createPlan(userId: string, dto: StudyPlanRequestDto): Promise<StudyPlanResponseDto> {
    const page = await this.notionPageRepository.findOne({ where: { pageId: dto.pageId } });
    if (!page || page.userId !== userId) {
      throw new BadRequestException('Notion page is not found.');
    }

    const total = dto.days * dto.questionsPerDay;
    if (total > 35) {
      throw new BadRequestException('Total question count must be less than or equal to 35.');
    }

    const startsAt = this.getTodayDateInKst();

    const plan = this.studyPlanRepository.create({
      userId,
      pageId: dto.pageId,
      days: dto.days,
      questionsPerDay: dto.questionsPerDay,
      totalQuestions: total,
      startsAt,
      timezone: this.timezone,
      status: 'ACTIVE',
    });
    const saved = await this.studyPlanRepository.save(plan);

    const schedules = await this.studyScheduleRepository.save(
      this.buildSchedules(saved.planId, dto.days),
    );

    const latestSnapshot = await this.getLatestSnapshot(saved.pageId);
    if (!latestSnapshot) {
      for (const schedule of schedules) {
        schedule.status = 'FAILED';
        schedule.failureReason = 'latest snapshot not found';
      }
      await this.studyScheduleRepository.save(schedules);
      throw new BadRequestException('Latest page snapshot is not found.');
    }

    for (const schedule of schedules) {
      try {
        await this.questionGenerationService.generateFromSnapshot(
          latestSnapshot.snapshotId,
          saved.questionsPerDay,
          schedule.scheduleId,
        );
        schedule.snapshotId = latestSnapshot.snapshotId;
        schedule.generatedAt = new Date();
        schedule.failureReason = null;
      } catch (error) {
        schedule.status = 'FAILED';
        schedule.failureReason = this.formatError(error);
      }
    }
    await this.studyScheduleRepository.save(schedules);

    return {
      plan: {
        planId: saved.planId,
        pageId: saved.pageId,
        days: saved.days,
        questionsPerDay: saved.questionsPerDay,
        totalQuestions: saved.totalQuestions,
        startsAt: saved.startsAt,
        timezone: saved.timezone,
      },
    };
  }

  private buildSchedules(planId: string, days: number): StudySchedule[] {
    const schedules: StudySchedule[] = [];

    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      const { year, month, day } = this.getKstDateParts(dayOffset);
      const scheduledAtUtc = new Date(
        Date.UTC(year, month, day, -StudyPlanService.KST_OFFSET_HOURS, 0, 0),
      );

      schedules.push(
        this.studyScheduleRepository.create({
          planId,
          dayIndex: dayOffset,
          scheduledAt: scheduledAtUtc,
          status: 'PENDING',
          snapshotId: null,
          generatedAt: null,
          failureReason: null,
        }),
      );
    }

    return schedules;
  }

  private getKstDateParts(dayOffset = 0): { year: number; month: number; day: number } {
    const now = Date.now();
    const kstMs =
      now +
      StudyPlanService.KST_OFFSET_HOURS * 60 * 60 * 1000 +
      dayOffset * StudyPlanService.MS_PER_DAY;
    const kstDate = new Date(kstMs);

    return {
      year: kstDate.getUTCFullYear(),
      month: kstDate.getUTCMonth(),
      day: kstDate.getUTCDate(),
    };
  }

  private getTodayDateInKst(): string {
    const { year, month, day } = this.getKstDateParts(0);
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  private async getLatestSnapshot(pageId: string): Promise<PageSnapshot | null> {
    return this.pageSnapshotRepository.findOne({
      where: { pageId },
      order: { createdAt: 'DESC' },
    });
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'question generation failed';
  }
}
