import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { QuestionQueryService } from './question-query.service';

type QueryBuilderMock = {
  innerJoin: jest.Mock;
  leftJoin: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  getOne: jest.Mock;
};

function createQueryBuilderMock(result: Question | null): QueryBuilderMock {
  const qb: QueryBuilderMock = {
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    getOne: jest.fn().mockResolvedValue(result),
  };
  qb.innerJoin.mockReturnValue(qb);
  qb.leftJoin.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
}

describe('QuestionQueryService', () => {
  const questionRepository = {
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<Question>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when waiting question does not exist', async () => {
    const qb = createQueryBuilderMock(null);
    (questionRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const service = new QuestionQueryService(questionRepository);
    const waiting = await service.getWaitingQuestion('user-1');

    expect(waiting).toBeNull();
  });

  it('returns waiting question view when exists', async () => {
    const createdAt = new Date('2026-02-27T08:00:00.000Z');
    const qb = createQueryBuilderMock({
      questionId: 'question-1',
      prompt: 'prompt-1',
      createdAt,
    } as Question);
    (questionRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const service = new QuestionQueryService(questionRepository);
    const waiting = await service.getWaitingQuestion('user-1');

    expect(waiting).toEqual({
      questionId: 'question-1',
      prompt: 'prompt-1',
      createdAt,
    });
  });

  it('throws when question is not found', async () => {
    const qb = createQueryBuilderMock(null);
    (questionRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const service = new QuestionQueryService(questionRepository);

    await expect(
      service.getQuestionOrThrow('user-1', 'question-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
