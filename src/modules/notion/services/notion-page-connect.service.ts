import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../entities/notion-page.entity';
import { PageSnapshot } from '../entities/page-snapshot.entity';
import { NotionAddPageRequestDto } from '../dtos/notion-add-page-request.dto';
import { NotionPageDto } from '../dtos/notion-page.dto';
import { NotionPageResponseDto } from '../dtos/notion-page-response.dto';
import { NotionClientService } from './notion-client.service';
import { NotionConnectionAccessService } from './notion-connection-access.service';
import { NotionParsingService } from './notion-parsing.service';
import { Question } from '../../question/entities/question.entity';
import { QuestionGenerationService } from '../../question/services/question-generation.service';

@Injectable()
export class NotionPageConnectService {
  private static readonly MAX_PAGES_PER_USER = 5;
  private static readonly DEFAULT_INITIAL_QUESTIONS_COUNT = 3;

  constructor(
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
    @InjectRepository(PageSnapshot)
    private readonly pageSnapshotRepository: Repository<PageSnapshot>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    private readonly notionClient: NotionClientService,
    private readonly notionConnectionAccessService: NotionConnectionAccessService,
    private readonly parsingService: NotionParsingService,
    private readonly questionGenerationService: QuestionGenerationService,
  ) {}

  async addPage(
    userId: string,
    dto: NotionAddPageRequestDto,
  ): Promise<NotionPageResponseDto> {
    const token =
      await this.notionConnectionAccessService.getUserAccessTokenOrThrow(
        userId,
      );
    const notionPageId = this.resolveNotionPageId(dto);
    const existing = await this.notionPageRepository.findOne({
      where: { notionPageId },
    });
    const page = await this.notionClient.retrievePage(token, notionPageId);
    const title = this.parsingService.extractTitleFromPage(page);
    const url = typeof page.url === 'string' ? page.url : '';

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          'This page is already linked to another user.',
        );
      }

      existing.title = title;
      existing.url = url;
      existing.isConnected = true;
      await this.notionPageRepository.save(existing);

      await this.ensureInitialQuestions({
        pageId: existing.pageId,
        notionPageId: existing.notionPageId,
        token,
        forceRefresh: true,
      });

      return { page: this.toNotionPageDto(existing) };
    }

    const currentCount = await this.notionPageRepository.count({
      where: { userId },
    });
    if (currentCount >= NotionPageConnectService.MAX_PAGES_PER_USER) {
      throw new BadRequestException('You can connect up to 5 Notion pages.');
    }

    const notionPage = this.notionPageRepository.create({
      userId,
      notionPageId,
      title,
      url,
      isConnected: true,
      connectedAt: new Date(),
    });
    const savedPage = await this.notionPageRepository.save(notionPage);

    await this.ensureInitialQuestions({
      pageId: savedPage.pageId,
      notionPageId,
      token,
      forceRefresh: false,
    });

    return { page: this.toNotionPageDto(savedPage) };
  }

  private async ensureInitialQuestions(params: {
    pageId: string;
    notionPageId: string;
    token: string;
    forceRefresh: boolean;
  }): Promise<void> {
    const snapshot = await this.getOrCreateLatestSnapshot(params);
    const existingQuestionCount = await this.questionRepository.count({
      where: { snapshotId: snapshot.snapshotId },
    });

    if (existingQuestionCount > 0) {
      return;
    }

    await this.questionGenerationService.generateFromSnapshot(
      snapshot.snapshotId,
      NotionPageConnectService.DEFAULT_INITIAL_QUESTIONS_COUNT,
    );
  }

  private async getOrCreateLatestSnapshot(params: {
    pageId: string;
    notionPageId: string;
    token: string;
    forceRefresh: boolean;
  }): Promise<PageSnapshot> {
    if (!params.forceRefresh) {
      const latestSnapshot = await this.pageSnapshotRepository.findOne({
        where: { pageId: params.pageId },
        order: { createdAt: 'DESC' },
      });
      if (latestSnapshot) {
        return latestSnapshot;
      }
    } else {
      await this.pageSnapshotRepository.delete({
        pageId: params.pageId,
      });
    }

    const blocks = await this.notionClient.retrieveAllBlockChildren(
      params.token,
      params.notionPageId,
      2,
    );
    const plainText = this.parsingService.extractPlainTextFromBlocks(blocks);
    const snapshotContent = {
      blocks,
      plainText,
    };
    const contentHash = this.parsingService.createContentHash(
      params.notionPageId,
      snapshotContent,
    );

    const snapshot = this.pageSnapshotRepository.create({
      pageId: params.pageId,
      content: snapshotContent,
      contentHash,
    });
    return this.pageSnapshotRepository.save(snapshot);
  }

  private resolveNotionPageId(dto: NotionAddPageRequestDto): string {
    if (dto.notionPageId) {
      return dto.notionPageId;
    }
    if (!dto.notionUrl) {
      throw new BadRequestException('notionUrl or notionPageId is required.');
    }

    const idFromUrl = this.extractPageIdFromUrl(dto.notionUrl);
    if (!idFromUrl) {
      throw new BadRequestException('Cannot extract pageId from Notion URL.');
    }
    return idFromUrl;
  }

  private extractPageIdFromUrl(url: string): string | null {
    const trimmed = url.trim();
    const uuidPattern =
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const compactPattern = /[0-9a-fA-F]{32}/;

    const uuidMatch = trimmed.match(uuidPattern);
    if (uuidMatch?.[0]) {
      return uuidMatch[0];
    }
    const compactMatch = trimmed.match(compactPattern);
    if (!compactMatch?.[0]) {
      return null;
    }
    const raw = compactMatch[0];
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }

  private toNotionPageDto(page: NotionPage): NotionPageDto {
    return {
      pageId: page.pageId,
      notionPageId: page.notionPageId,
      title: page.title,
      url: page.url,
      isConnected: page.isConnected,
      connectedAt: page.connectedAt,
    };
  }
}
