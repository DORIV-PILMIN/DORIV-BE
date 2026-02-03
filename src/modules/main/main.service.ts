import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../notion/entities/notion-page.entity';
import { QuestionStatus } from '../question/entities/question-status.entity';
import { Question } from '../question/entities/question.entity';
import { QuestionAttempt } from '../question/entities/question-attempt.entity';
import { User } from '../user/entities/user.entity';
import { MainNotionPageDto } from './dtos/main-notion-page.dto';
import { MainPageResponseDto } from './dtos/main-page-response.dto';
import { MainRecentSessionDto } from './dtos/main-recent-session.dto';
import { MainStatsDto } from './dtos/main-stats.dto';
import { MainUserDto } from './dtos/main-user.dto';
import { MainWaitingQuestionDto } from './dtos/main-waiting-question.dto';

@Injectable()
export class MainService {
  constructor(
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
    @InjectRepository(QuestionStatus)
    private readonly questionStatusRepository: Repository<QuestionStatus>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepository: Repository<QuestionAttempt>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getMainPage(userId: string): Promise<MainPageResponseDto> {
    // 사용자 기본 정보 조회
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) {
      // 유저가 없을 때 기본 응답 반환
      return {
        user: {
          userId,
          name: 'Unknown',
          profileImage: null,
          badge: null,
        },
        notionPages: [],
        waitingQuestion: null,
        recentSessions: [],
        stats: {
          flashcardCount: null,
          retentionRate: null,
        },
      };
    }

    // 연결된 노션 페이지 목록 조회(최근 연결순, 최대 5개)
    const notionPages = await this.notionPageRepository.find({
      where: { userId },
      order: { connectedAt: 'DESC' },
      take: 5,
    });

    // 노션 페이지 DTO 변환
    const notionPageDtos: MainNotionPageDto[] = notionPages.map((page) => ({
      pageId: page.pageId,
      notionPageId: page.notionPageId,
      title: page.title,
      url: page.url,
      isConnected: page.isConnected,
      syncStatus: page.isConnected ? 'OK' : 'FAIL',
    }));

    // 플래시카드(질문) 개수 집계
    const flashcardCountRaw = await this.questionStatusRepository
      .createQueryBuilder('qs')
      .select('COUNT(DISTINCT qs.questionId)', 'count')
      .where('qs.userId = :userId', { userId })
      .getRawOne<{ count: string }>();

    // 기억 유지율 평균(점수 평균) 계산
    const retentionRateRaw = await this.questionAttemptRepository
      .createQueryBuilder('qa')
      .select('AVG(qa.score)', 'avg')
      .where('qa.userId = :userId', { userId })
      .andWhere('qa.score IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

    // 통계 DTO 생성
    const stats: MainStatsDto = {
      flashcardCount: flashcardCountRaw ? Number(flashcardCountRaw.count) : 0,
      retentionRate: retentionRateRaw?.avg ? Number(retentionRateRaw.avg) : null,
    };

    // 사용자 DTO 생성
    const userDto: MainUserDto = {
      userId: user.userId,
      name: user.name,
      profileImage: user.profileImage,
      badge: null,
    };

    // 답변 대기 상태(WAITING) 중 가장 최근 1건 조회
    const waitingStatus = await this.questionStatusRepository.findOne({
      where: { userId, status: 'WAITING' },
      order: { createdAt: 'DESC' },
    });

    let waitingQuestion: MainWaitingQuestionDto | null = null;
    if (waitingStatus) {
      const waitingQuestionEntity = await this.questionRepository.findOne({
        where: { questionId: waitingStatus.questionId },
      });
      if (waitingQuestionEntity) {
        waitingQuestion = {
          title: waitingQuestionEntity.prompt,
        };
      }
    }

    // 최근 풀이 로그 조회(최신순, 최대 6개)
    const recentAttempts = await this.questionAttemptRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 6,
      relations: ['question'],
    });

    // 점수 기준으로 PASS/WEAK/FAIL 분류
    const recentSessions: MainRecentSessionDto[] = recentAttempts.map((attempt) => {
      const score = attempt.score;
      let result: MainRecentSessionDto['result'] = 'FAIL';
      if (score !== null) {
        if (score >= 70) {
          result = 'PASS';
        } else if (score >= 40) {
          result = 'WEAK';
        }
      }
      return {
        title: attempt.question?.prompt ?? 'Untitled',
        result,
        score,
        createdAt: attempt.createdAt,
      };
    });

    // 메인 페이지 응답 구성
    return {
      user: userDto,
      notionPages: notionPageDtos,
      waitingQuestion,
      recentSessions,
      stats,
    };
  }
}
