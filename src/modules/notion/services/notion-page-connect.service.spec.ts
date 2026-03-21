import { Repository } from 'typeorm';
import { NotionPage } from '../entities/notion-page.entity';
import { PageSnapshot } from '../entities/page-snapshot.entity';
import { NotionPageConnectService } from './notion-page-connect.service';
import { NotionClientService } from './notion-client.service';
import { NotionConnectionAccessService } from './notion-connection-access.service';
import { NotionParsingService } from './notion-parsing.service';
import { Question } from '../../question/entities/question.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';

describe('NotionPageConnectService', () => {
  const notionPageRepository = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<NotionPage>;
  const pageSnapshotRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<PageSnapshot>;
  const questionRepository = {
    count: jest.fn(),
  } as unknown as Repository<Question>;
  const notionClient = {
    retrievePage: jest.fn(),
    retrieveAllBlockChildren: jest.fn(),
  } as unknown as NotionClientService;
  const notionConnectionAccessService = {
    getUserAccessTokenOrThrow: jest.fn(),
  } as unknown as NotionConnectionAccessService;
  const parsingService = {
    extractTitleFromPage: jest.fn(),
    extractPlainTextFromBlocks: jest.fn(),
    createContentHash: jest.fn(),
  } as unknown as NotionParsingService;
  const questionGenerationService = {
    generateFromSnapshot: jest.fn(),
  } as unknown as QuestionGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates initial questions right after a page is connected', async () => {
    (notionConnectionAccessService.getUserAccessTokenOrThrow as jest.Mock).mockResolvedValue(
      'notion-token',
    );
    (notionPageRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
    (notionPageRepository.count as jest.Mock).mockResolvedValue(0);
    (notionClient.retrievePage as jest.Mock).mockResolvedValue({
      url: 'https://www.notion.so/example',
    });
    (parsingService.extractTitleFromPage as jest.Mock).mockReturnValue(
      '테스트 페이지',
    );
    (notionPageRepository.create as jest.Mock).mockReturnValue({
      userId: 'user-1',
      notionPageId: 'notion-page-1',
      title: '테스트 페이지',
      url: 'https://www.notion.so/example',
      isConnected: true,
      connectedAt: new Date('2026-03-22T00:00:00.000Z'),
    });
    (notionPageRepository.save as jest.Mock).mockResolvedValue({
      pageId: 'page-1',
      userId: 'user-1',
      notionPageId: 'notion-page-1',
      title: '테스트 페이지',
      url: 'https://www.notion.so/example',
      isConnected: true,
      connectedAt: new Date('2026-03-22T00:00:00.000Z'),
    });
    (pageSnapshotRepository.findOne as jest.Mock).mockResolvedValue(null);
    (notionClient.retrieveAllBlockChildren as jest.Mock).mockResolvedValue([
      { id: 'block-1' },
    ]);
    (parsingService.extractPlainTextFromBlocks as jest.Mock).mockReturnValue(
      '노션 본문 텍스트',
    );
    (parsingService.createContentHash as jest.Mock).mockReturnValue('hash-1');
    (pageSnapshotRepository.create as jest.Mock).mockReturnValue({
      pageId: 'page-1',
      content: {
        blocks: [{ id: 'block-1' }],
        plainText: '노션 본문 텍스트',
      },
      contentHash: 'hash-1',
    });
    (pageSnapshotRepository.save as jest.Mock).mockResolvedValue({
      snapshotId: 'snapshot-1',
      pageId: 'page-1',
      content: {
        blocks: [{ id: 'block-1' }],
        plainText: '노션 본문 텍스트',
      },
      contentHash: 'hash-1',
    });
    (questionRepository.count as jest.Mock).mockResolvedValue(0);
    (questionGenerationService.generateFromSnapshot as jest.Mock).mockResolvedValue(
      [],
    );

    const service = new NotionPageConnectService(
      notionPageRepository,
      pageSnapshotRepository,
      questionRepository,
      notionClient,
      notionConnectionAccessService,
      parsingService,
      questionGenerationService,
    );

    await service.addPage('user-1', { notionPageId: 'notion-page-1' });

    expect(questionGenerationService.generateFromSnapshot).toHaveBeenCalledWith(
      'snapshot-1',
      3,
    );
  });

  it('backfills initial questions for an already linked page when none exist', async () => {
    (notionConnectionAccessService.getUserAccessTokenOrThrow as jest.Mock).mockResolvedValue(
      'notion-token',
    );
    (notionPageRepository.findOne as jest.Mock).mockResolvedValue({
      pageId: 'page-1',
      userId: 'user-1',
      notionPageId: 'notion-page-1',
      title: '기존 페이지',
      url: 'https://www.notion.so/example',
      isConnected: true,
      connectedAt: new Date('2026-03-22T00:00:00.000Z'),
    });
    (pageSnapshotRepository.findOne as jest.Mock).mockResolvedValue({
      snapshotId: 'snapshot-1',
      pageId: 'page-1',
      content: { plainText: '노션 본문 텍스트' },
      contentHash: 'hash-1',
    });
    (questionRepository.count as jest.Mock).mockResolvedValue(0);
    (questionGenerationService.generateFromSnapshot as jest.Mock).mockResolvedValue(
      [],
    );

    const service = new NotionPageConnectService(
      notionPageRepository,
      pageSnapshotRepository,
      questionRepository,
      notionClient,
      notionConnectionAccessService,
      parsingService,
      questionGenerationService,
    );

    await service.addPage('user-1', { notionPageId: 'notion-page-1' });

    expect(questionGenerationService.generateFromSnapshot).toHaveBeenCalledWith(
      'snapshot-1',
      3,
    );
  });
});
