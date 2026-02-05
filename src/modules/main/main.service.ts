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
import { MainNotionDomainDto } from './dtos/main-notion-domain.dto';
import { MainQuestionDomainDto } from './dtos/main-question-domain.dto';

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
    const [user, notion, question, stats] = await Promise.all([
      this.getUser(userId),
      this.getNotion(userId),
      this.getQuestion(userId),
      this.getStats(userId),
    ]);

    return {
      user,
      notion,
      question,
      stats,
    };
  }

  async getUser(userId: string): Promise<MainUserDto> {
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) {
      return {
        userId,
        name: 'Unknown',
        profileImage: null,
        badge: null,
      };
    }

    return {
      userId: user.userId,
      name: user.name,
      profileImage: user.profileImage,
      badge: null,
    };
  }

  async getNotion(userId: string): Promise<MainNotionDomainDto> {
    const notionPages = await this.notionPageRepository.find({
      where: { userId },
      order: { connectedAt: 'DESC' },
      take: 5,
    });

    const pages: MainNotionPageDto[] = notionPages.map((page) => ({
      pageId: page.pageId,
      notionPageId: page.notionPageId,
      title: page.title,
      url: page.url,
      isConnected: page.isConnected,
      syncStatus: page.isConnected ? 'OK' : 'FAIL',
    }));

    return { pages };
  }

  async getQuestion(userId: string): Promise<MainQuestionDomainDto> {
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

    const recentAttempts = await this.questionAttemptRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 6,
      relations: ['question'],
    });

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

    return {
      waitingQuestion,
      recentSessions,
    };
  }

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
