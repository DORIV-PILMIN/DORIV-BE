import { Injectable } from '@nestjs/common';
import { NotionSearchRequestDto } from '../dtos/notion-search-request.dto';
import { NotionSearchPagesResponseDto } from '../dtos/notion-search-pages-response.dto';
import { NotionPageSummaryDto } from '../dtos/notion-page-summary.dto';
import { NotionClientService } from './notion-client.service';
import { NotionConnectionAccessService } from './notion-connection-access.service';
import { NotionParsingService } from './notion-parsing.service';

@Injectable()
export class NotionPageSearchService {
  constructor(
    private readonly notionClient: NotionClientService,
    private readonly notionConnectionAccessService: NotionConnectionAccessService,
    private readonly parsingService: NotionParsingService,
  ) {}

  async searchPagesOnly(
    userId: string,
    dto: NotionSearchRequestDto,
  ): Promise<NotionSearchPagesResponseDto> {
    const token =
      await this.notionConnectionAccessService.getUserAccessTokenOrThrow(
        userId,
      );
    const response = await this.notionClient.searchPages(token, {
      query: dto.query,
      pageSize: dto.pageSize,
      startCursor: dto.startCursor,
    });

    return { pages: this.toPageSummaries(response.results ?? []) };
  }

  private toPageSummaries(results: unknown[]): NotionPageSummaryDto[] {
    return (results ?? [])
      .filter((result: any) => result?.object === 'page')
      .map((page: any) => ({
        notionPageId: String(page.id),
        title: this.parsingService.extractTitleFromPage(page),
        url: typeof page.url === 'string' ? page.url : '',
        lastEditedTime: String(page.last_edited_time ?? ''),
      }));
  }
}
