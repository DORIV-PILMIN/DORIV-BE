import { Injectable } from '@nestjs/common';
import { NotionSearchRequestDto } from '../dtos/notion-search-request.dto';
import { NotionSearchPagesResponseDto } from '../dtos/notion-search-pages-response.dto';
import { NotionAddPageRequestDto } from '../dtos/notion-add-page-request.dto';
import { NotionPageResponseDto } from '../dtos/notion-page-response.dto';
import { NotionPageSearchService } from './notion-page-search.service';
import { NotionPageConnectService } from './notion-page-connect.service';

@Injectable()
export class NotionService {
  constructor(
    private readonly notionPageSearchService: NotionPageSearchService,
    private readonly notionPageConnectService: NotionPageConnectService,
  ) {}

  async searchPagesOnly(
    userId: string,
    dto: NotionSearchRequestDto,
  ): Promise<NotionSearchPagesResponseDto> {
    return this.notionPageSearchService.searchPagesOnly(userId, dto);
  }

  async addPage(
    userId: string,
    dto: NotionAddPageRequestDto,
  ): Promise<NotionPageResponseDto> {
    return this.notionPageConnectService.addPage(userId, dto);
  }
}
