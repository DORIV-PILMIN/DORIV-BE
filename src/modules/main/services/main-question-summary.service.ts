import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionAttempt } from '../../question/entities/question-attempt.entity';
import { Question } from '../../question/entities/question.entity';
import { MainQuestionDomainDto } from '../dtos/main-question-domain.dto';
import { MainRecentSessionDto } from '../dtos/main-recent-session.dto';
import { MainWaitingQuestionDto } from '../dtos/main-waiting-question.dto';

@Injectable()
export class MainQuestionSummaryService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepository: Repository<QuestionAttempt>,
  ) {}

  async getQuestion(userId: string): Promise<MainQuestionDomainDto> {
    let waitingQuestion: MainWaitingQuestionDto | null = null;
    const waitingQuestionEntity = await this.questionRepository
      .createQueryBuilder('q')
      .innerJoin('page_snapshots', 'ps', 'ps.snapshot_id = q.snapshot_id')
      .innerJoin(
        'notion_pages',
        'np',
        'np.page_id = ps.page_id AND np.user_id = :userId',
        { userId },
      )
      .leftJoin(
        'question_attempts',
        'qa',
        'qa.question_id = q.question_id AND qa.user_id = :userId',
        { userId },
      )
      .where('qa.question_attempt_id IS NULL')
      .orderBy('q.created_at', 'DESC')
      .getOne();

    if (waitingQuestionEntity) {
      waitingQuestion = {
        questionId: waitingQuestionEntity.questionId,
        title: waitingQuestionEntity.prompt,
      };
    }

    const recentAttempts = await this.questionAttemptRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 6,
      relations: ['question'],
    });

    const recentSessions: MainRecentSessionDto[] = recentAttempts.map(
      (attempt) => {
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
          attemptId: attempt.questionAttemptId,
          questionId: attempt.questionId,
          title: attempt.question?.prompt ?? 'Untitled',
          result,
          score,
          createdAt: attempt.createdAt,
        };
      },
    );

    return {
      waitingQuestion,
      recentSessions,
    };
  }
}
