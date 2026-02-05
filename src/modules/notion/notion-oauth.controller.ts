import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Query,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { NotionOauthService } from './notion-oauth.service';

@ApiTags('notion')
@Controller('notion/oauth')
export class NotionOauthController {
  constructor(
    private readonly notionOauthService: NotionOauthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Notion OAuth 시작' })
  @ApiOkResponse({ description: 'Notion 승인 페이지로 리다이렉트' })
  @Redirect()
  authorize(@CurrentUserId() userId: string): { url: string } {
    if (!userId) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }
    return { url: this.notionOauthService.buildAuthorizeUrl(userId) };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Notion OAuth 콜백' })
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Notion 연결 완료 또는 성공 리다이렉트',
  })
  @Redirect()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
  ): Promise<{ url?: string; message?: string }> {
    if (!code || !state) {
      throw new BadRequestException('code 또는 state가 없습니다.');
    }
    await this.notionOauthService.handleCallback(code, state);
    const redirectUrl = this.configService.get<string>('NOTION_OAUTH_SUCCESS_REDIRECT_URL');
    if (redirectUrl) {
      return { url: redirectUrl };
    }
    return { message: 'Notion 연결 완료' };
  }
}
