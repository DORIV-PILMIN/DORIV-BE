import { MainController } from './main.controller';
import { MainService } from './main.service';

describe('MainController', () => {
  const mainService = {
    getWaitingQuestion: jest.fn(),
  } as unknown as MainService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns waiting question from main/questions/waiting', async () => {
    (mainService.getWaitingQuestion as jest.Mock).mockResolvedValue({
      questionId: 'question-1',
      prompt: '대기 중인 질문',
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
    });

    const controller = new MainController(mainService);
    const result = await controller.getWaitingQuestion('user-1');

    expect(result.waitingQuestion).toEqual({
      questionId: 'question-1',
      prompt: '대기 중인 질문',
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
    });
  });
});
