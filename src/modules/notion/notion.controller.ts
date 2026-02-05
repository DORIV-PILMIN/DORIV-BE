import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { NotionSearchRequestDto } from './dtos/notion-search-request.dto';
import { NotionSearchResponseDto } from './dtos/notion-search-response.dto';
import { NotionSearchPagesResponseDto } from './dtos/notion-search-pages-response.dto';
import { NotionSearchPageInfoResponseDto } from './dtos/notion-search-page-info-response.dto';
import { NotionAddPageRequestDto } from './dtos/notion-add-page-request.dto';
import { NotionPageResponseDto } from './dtos/notion-page-response.dto';
import { NotionService } from './services/notion.service';

@ApiTags('notion')
@Controller('notion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotionController {
  constructor(private readonly notionService: NotionService) {}

  @Post('search')
  @ApiOperation({ summary: '노션 페이지 검색' })
  @ApiBody({ type: NotionSearchRequestDto })
  @ApiOkResponse({
    type: NotionSearchResponseDto,
    description: '검색 결과 페이지 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  search(
    @CurrentUserId() userId: string,
    @Body() dto: NotionSearchRequestDto,
  ): Promise<NotionSearchResponseDto> {
    return this.notionService.searchPages(userId, dto);
  }

  @Post('search/pages')
  @ApiOperation({ summary: '노션 페이지 검색(페이지 목록만)' })
  @ApiBody({ type: NotionSearchRequestDto })
  @ApiOkResponse({
    type: NotionSearchPagesResponseDto,
    description: '검색 결과 페이지 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  searchPagesOnly(
    @CurrentUserId() userId: string,
    @Body() dto: NotionSearchRequestDto,
  ): Promise<NotionSearchPagesResponseDto> {
    return this.notionService.searchPagesOnly(userId, dto);
  }

  @Post('search/page-info')
  @ApiOperation({ summary: '노션 페이지 검색(페이지 정보만)' })
  @ApiBody({ type: NotionSearchRequestDto })
  @ApiOkResponse({
    type: NotionSearchPageInfoResponseDto,
    description: '검색 페이지 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  searchPageInfoOnly(
    @CurrentUserId() userId: string,
    @Body() dto: NotionSearchRequestDto,
  ): Promise<NotionSearchPageInfoResponseDto> {
    return this.notionService.searchPageInfoOnly(userId, dto);
  }

  @Post('pages')
  @ApiOperation({ summary: '노션 페이지 추가' })
  @ApiBody({ type: NotionAddPageRequestDto })
  @ApiOkResponse({
    type: NotionPageResponseDto,
    description: '추가한 페이지 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  addPage(
    @CurrentUserId() userId: string,
    @Body() dto: NotionAddPageRequestDto,
  ): Promise<NotionPageResponseDto> {
    return this.notionService.addPage(userId, dto);
  }
}
