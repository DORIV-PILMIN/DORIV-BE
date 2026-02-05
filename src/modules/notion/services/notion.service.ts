import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../entities/notion-page.entity';
import { PageSnapshot } from '../entities/page-snapshot.entity';
import { NotionConnection } from '../entities/notion-connection.entity';
import { NotionClientService } from './notion-client.service';
import { NotionParsingService } from './notion-parsing.service';
import { NotionSearchRequestDto } from '../dtos/notion-search-request.dto';
import { NotionSearchResponseDto } from '../dtos/notion-search-response.dto';
import { NotionPageSummaryDto } from '../dtos/notion-page-summary.dto';
import { NotionAddPageRequestDto } from '../dtos/notion-add-page-request.dto';
import { NotionPageDto } from '../dtos/notion-page.dto';

@Injectable()
export class NotionService {
  // 노션 연결 사용자 기준으로 검색/페이지추가/스냅샷 저장을 오케스트레이션
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
  ) {}

  async searchPages(userId: string, dto: NotionSearchRequestDto): Promise<NotionSearchResponseDto> {
    // 사용자 토큰으로 노션 페이지 검색
    const token = await this.getUserAccessTokenOrThrow(userId);
    const response = await this.notionClient.searchPages(token, {
      query: dto.query,
      pageSize: dto.pageSize,
      startCursor: dto.startCursor,
    });

    const pages = (response.results ?? [])
      .filter((result: any) => result?.object === 'page')
      .map((page: any) => this.toPageSummaryDto(page));

    return {
      pages,
      hasMore: response.has_more ?? false,
      nextCursor: response.next_cursor ?? null,
    };
  }

  async addPage(userId: string, dto: NotionAddPageRequestDto): Promise<NotionPageDto> {
    // 페이지 추가 + 스냅샷 저장
    const token = await this.getUserAccessTokenOrThrow(userId);
    const existing = await this.notionPageRepository.findOne({
      where: { notionPageId: dto.notionPageId },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('이미 다른 사용자에게 연결된 페이지입니다.');
      }
      return this.toNotionPageDto(existing);
    }

    const currentCount = await this.notionPageRepository.count({ where: { userId } });
    if (currentCount >= NotionService.MAX_PAGES_PER_USER) {
      throw new BadRequestException('노션 페이지는 최대 5개까지 연결할 수 있습니다.');
    }

    const page = await this.notionClient.retrievePage(token, dto.notionPageId);
    const title = this.parsingService.extractTitleFromPage(page);
    const url = typeof page.url === 'string' ? page.url : '';

    const notionPage = this.notionPageRepository.create({
      userId,
      notionPageId: dto.notionPageId,
      title,
      url,
      isConnected: true,
      connectedAt: new Date(),
    });
    const savedPage = await this.notionPageRepository.save(notionPage);

    const blocks = await this.notionClient.retrieveAllBlockChildren(token, dto.notionPageId, 2);
    const plainText = this.parsingService.extractPlainTextFromBlocks(blocks);
    const snapshotContent = {
      blocks,
      plainText,
    };
    const contentHash = this.parsingService.createContentHash(dto.notionPageId, snapshotContent);

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

    return this.toNotionPageDto(savedPage);
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
    // 노션 미연결 사용자 차단
    const connection = await this.notionConnectionRepository.findOne({ where: { userId } });
    if (!connection?.accessToken) {
      throw new BadRequestException('노션 연결이 필요합니다.');
    }
    return connection.accessToken;
  }
}
