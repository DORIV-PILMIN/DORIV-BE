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
      throw new BadRequestException('노션 페이지를 찾을 수 없습니다.');
    }

    const total = dto.days * dto.questionsPerDay;
    if (total > 35) {
      throw new BadRequestException('총 질문 수는 최대 35개입니다.');
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
      throw new BadRequestException('페이지 스냅샷을 찾을 수 없습니다.');
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
      planId: saved.planId,
      pageId: saved.pageId,
      days: saved.days,
      questionsPerDay: saved.questionsPerDay,
      totalQuestions: saved.totalQuestions,
      startsAt: saved.startsAt,
      timezone: saved.timezone,
    };
  }

  private buildSchedules(planId: string, days: number): StudySchedule[] {
    const schedules: StudySchedule[] = [];
    const kstToday = this.getKstDate();

    for (let i = 0; i < days; i += 1) {
      const targetKst = new Date(kstToday);
      targetKst.setDate(targetKst.getDate() + i);
      const scheduledAtUtc = new Date(Date.UTC(
        targetKst.getFullYear(),
        targetKst.getMonth(),
        targetKst.getDate(),
        0,
        0,
        0,
      ));

      schedules.push(
        this.studyScheduleRepository.create({
          planId,
          dayIndex: i,
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

  private getKstDate(): Date {
    return new Date(Date.now() + 9 * 60 * 60 * 1000);
  }

  private getTodayDateInKst(): string {
    const kst = this.getKstDate();
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, '0');
    const d = String(kst.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
