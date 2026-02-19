import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../entities/notion-page.entity';
import { PageSnapshot } from '../entities/page-snapshot.entity';
import { NotionConnection } from '../entities/notion-connection.entity';
import { NotionClientService } from './notion-client.service';
import { NotionParsingService } from './notion-parsing.service';
import { NotionTokenCryptoService } from './notion-token-crypto.service';
import { NotionSearchRequestDto } from '../dtos/notion-search-request.dto';
import { NotionSearchPagesResponseDto } from '../dtos/notion-search-pages-response.dto';
import { NotionPageSummaryDto } from '../dtos/notion-page-summary.dto';
import { NotionAddPageRequestDto } from '../dtos/notion-add-page-request.dto';
import { NotionPageDto } from '../dtos/notion-page.dto';
import { NotionPageResponseDto } from '../dtos/notion-page-response.dto';

@Injectable()
export class NotionService {
  private static readonly MAX_PAGES_PER_USER = 5;

  constructor(
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
    @InjectRepository(PageSnapshot)
    private readonly pageSnapshotRepository: Repository<PageSnapshot>,
    @InjectRepository(NotionConnection)
    private readonly notionConnectionRepository: Repository<NotionConnection>,
    private readonly notionClient: NotionClientService,
    private readonly parsingService: NotionParsingService,
    private readonly notionTokenCryptoService: NotionTokenCryptoService,
  ) {}

  async searchPagesOnly(
    userId: string,
    dto: NotionSearchRequestDto,
  ): Promise<NotionSearchPagesResponseDto> {
    const response = await this.fetchSearchResult(userId, dto);
    return { pages: this.toPageSummaries(response.results ?? []) };
  }

  async addPage(userId: string, dto: NotionAddPageRequestDto): Promise<NotionPageResponseDto> {
    const token = await this.getUserAccessTokenOrThrow(userId);
    const notionPageId = this.resolveNotionPageId(dto);
    const existing = await this.notionPageRepository.findOne({
      where: { notionPageId },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('This page is already linked to another user.');
      }
      return { page: this.toNotionPageDto(existing) };
    }

    const currentCount = await this.notionPageRepository.count({ where: { userId } });
    if (currentCount >= NotionService.MAX_PAGES_PER_USER) {
      throw new BadRequestException('You can connect up to 5 Notion pages.');
    }

    const page = await this.notionClient.retrievePage(token, notionPageId);
    const title = this.parsingService.extractTitleFromPage(page);
    const url = typeof page.url === 'string' ? page.url : '';

    const notionPage = this.notionPageRepository.create({
      userId,
      notionPageId,
      title,
      url,
      isConnected: true,
      connectedAt: new Date(),
    });
    const savedPage = await this.notionPageRepository.save(notionPage);

    const blocks = await this.notionClient.retrieveAllBlockChildren(token, notionPageId, 2);
    const plainText = this.parsingService.extractPlainTextFromBlocks(blocks);
    const snapshotContent = {
      blocks,
      plainText,
    };
    const contentHash = this.parsingService.createContentHash(notionPageId, snapshotContent);

    const existingSnapshot = await this.pageSnapshotRepository.findOne({
      where: { contentHash },
    });
    if (!existingSnapshot) {
      const snapshot = this.pageSnapshotRepository.create({
        pageId: savedPage.pageId,
        content: snapshotContent,
        contentHash,
      });
      await this.pageSnapshotRepository.save(snapshot);
    }

    return { page: this.toNotionPageDto(savedPage) };
  }

  private async fetchSearchResult(
    userId: string,
    dto: NotionSearchRequestDto,
  ): Promise<{ results: unknown[]; next_cursor: string | null; has_more: boolean }> {
    const token = await this.getUserAccessTokenOrThrow(userId);
    return this.notionClient.searchPages(token, {
      query: dto.query,
      pageSize: dto.pageSize,
      startCursor: dto.startCursor,
    });
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
    const uuidPattern = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
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

  private toPageSummaries(results: unknown[]): NotionPageSummaryDto[] {
    return (results ?? [])
      .filter((result: any) => result?.object === 'page')
      .map((page: any) => this.toPageSummaryDto(page));
  }

  private toPageSummaryDto(page: any): NotionPageSummaryDto {
    return {
      notionPageId: String(page.id),
      title: this.parsingService.extractTitleFromPage(page),
      url: typeof page.url === 'string' ? page.url : '',
      lastEditedTime: String(page.last_edited_time ?? ''),
    };
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

  private async getUserAccessTokenOrThrow(userId: string): Promise<string> {
    const connection = await this.notionConnectionRepository.findOne({ where: { userId } });
    if (!connection?.accessToken) {
      throw new BadRequestException('Notion connection is required.');
    }
    return this.notionTokenCryptoService.decrypt(connection.accessToken);
  }
}
