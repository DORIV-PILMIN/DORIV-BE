import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { QuestionAttempt } from '../entities/question-attempt.entity';
import { QuestionStatus } from '../entities/question-status.entity';
import { QuestionAttemptService } from './question-attempt.service';
import { QuestionEvaluationService } from './question-evaluation.service';

describe('QuestionAttemptService', () => {
  const questionRepository = {
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<Question>;

  const questionAttemptRepository = {
    create: jest.fn((value) => ({ questionAttemptId: 'attempt-1', ...value })),
    save: jest.fn(async (value) => value),
  } as unknown as Repository<QuestionAttempt>;

  const questionStatusRepository = {
    manager: {
      transaction: jest.fn(async (work: (manager: any) => Promise<void>) => {
        const repo = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn((value) => value),
          save: jest.fn(async () => undefined),
        };
        await work({ getRepository: () => repo });
      }),
    },
  } as unknown as Repository<QuestionStatus>;

  const evaluationService = {
    evaluate: jest.fn().mockResolvedValue({ score: 80, feedback: 'Good answer.' }),
  } as unknown as QuestionEvaluationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when question is not owned by user', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    (questionRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const service = new QuestionAttemptService(
      questionRepository,
      questionAttemptRepository,
      questionStatusRepository,
      evaluationService,
    );

    await expect(
      service.submitAttempt('user-1', 'question-1', { answer: 'answer' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores evaluation result for owned question', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ questionId: 'question-1', prompt: 'prompt' }),
    };
    (questionRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const service = new QuestionAttemptService(
      questionRepository,
      questionAttemptRepository,
      questionStatusRepository,
      evaluationService,
    );

    const result = await service.submitAttempt('user-1', 'question-1', { answer: 'answer' });

    expect(result.result).toBe('PASS');
    expect(result.score).toBe(80);
    expect(questionAttemptRepository.save).toHaveBeenCalledTimes(2);
  });
});
