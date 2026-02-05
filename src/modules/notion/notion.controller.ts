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
import { NotionAddPageRequestDto } from './dtos/notion-add-page-request.dto';
import { NotionPageDto } from './dtos/notion-page.dto';
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

  @Post('pages')
  @ApiOperation({ summary: '노션 페이지 추가' })
  @ApiBody({ type: NotionAddPageRequestDto })
  @ApiOkResponse({
    type: NotionPageDto,
    description: '추가된 페이지 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  addPage(
    @CurrentUserId() userId: string,
    @Body() dto: NotionAddPageRequestDto,
  ): Promise<NotionPageDto> {
    return this.notionService.addPage(userId, dto);
  }
}
