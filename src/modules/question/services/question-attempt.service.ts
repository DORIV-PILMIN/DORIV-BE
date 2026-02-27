import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionAttempt } from '../entities/question-attempt.entity';
import { QuestionStatus } from '../entities/question-status.entity';
import { QuestionAttemptRequestDto } from '../dtos/question-attempt-request.dto';
import { QuestionAttemptResultDto } from '../dtos/question-attempt-result.dto';
import { QuestionEvaluationService } from './question-evaluation.service';
import { QuestionQueryService } from './question-query.service';

@Injectable()
export class QuestionAttemptService {
  constructor(
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepository: Repository<QuestionAttempt>,
    @InjectRepository(QuestionStatus)
    private readonly questionStatusRepository: Repository<QuestionStatus>,
    private readonly questionQueryService: QuestionQueryService,
    private readonly evaluationService: QuestionEvaluationService,
  ) {}

  async submitAttempt(
    userId: string,
    questionId: string,
    dto: QuestionAttemptRequestDto,
  ): Promise<QuestionAttemptResultDto> {
    const question = await this.questionQueryService.findOwnedQuestion(
      userId,
      questionId,
    );

    if (!question) {
      throw new ForbiddenException('You do not have access to this question.');
    }

    const evaluation = await this.evaluationService.evaluate(
      question.prompt,
      dto.answer,
    );
    const attempt = this.questionAttemptRepository.create({
      userId,
      questionId,
      userAnswer: dto.answer,
      score: evaluation.score,
      aiFeedback: evaluation.feedback,
    });
    const saved = await this.questionAttemptRepository.save(attempt);

    const result = this.toResult(saved.score);
    await this.upsertStatus(userId, questionId, result);

    return {
      attemptId: saved.questionAttemptId,
      questionId,
      result,
      score: saved.score ?? 0,
      feedback: saved.aiFeedback ?? '',
    };
  }

  private toResult(score: number | null): 'PASS' | 'WEAK' | 'FAIL' {
    if (score === null) {
      return 'FAIL';
    }
    if (score >= 70) {
      return 'PASS';
    }
    if (score >= 40) {
      return 'WEAK';
    }
    return 'FAIL';
  }

  private async upsertStatus(
    userId: string,
    questionId: string,
    result: 'PASS' | 'WEAK' | 'FAIL',
  ): Promise<void> {
    await this.questionStatusRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(QuestionStatus);
      const existing = await repo.findOne({
        where: { userId, questionId },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        existing.status = result;
        await repo.save(existing);
        return;
      }

      const status = repo.create({
        userId,
        questionId,
        status: result,
      });
      await repo.save(status);
    });
  }
}
