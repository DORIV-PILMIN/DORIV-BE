import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionViewDto } from '../dtos/question-view.dto';
import { Question } from '../entities/question.entity';

@Injectable()
export class QuestionQueryService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  async getWaitingQuestion(userId: string): Promise<QuestionViewDto | null> {
    const question = await this.questionRepository
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

    return question ? this.toView(question) : null;
  }

  async getQuestionOrThrow(
    userId: string,
    questionId: string,
  ): Promise<QuestionViewDto> {
    const question = await this.findOwnedQuestion(userId, questionId);

    if (!question) {
      throw new NotFoundException('Question is not found.');
    }

    return this.toView(question);
  }

  async findOwnedQuestion(
    userId: string,
    questionId: string,
  ): Promise<Question | null> {
    return this.questionRepository
      .createQueryBuilder('q')
      .innerJoin('page_snapshots', 'ps', 'ps.snapshot_id = q.snapshot_id')
      .innerJoin(
        'notion_pages',
        'np',
        'np.page_id = ps.page_id AND np.user_id = :userId',
        { userId },
      )
      .where('q.question_id = :questionId', { questionId })
      .getOne();
  }

  private toView(question: Question): QuestionViewDto {
    return {
      questionId: question.questionId,
      prompt: question.prompt,
      createdAt: question.createdAt,
    };
  }
}
