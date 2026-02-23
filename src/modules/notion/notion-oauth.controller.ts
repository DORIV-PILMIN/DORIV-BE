import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Redirect,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
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
  @ApiOperation({ summary: 'Start Notion OAuth' })
  @ApiOkResponse({ description: 'Redirects to Notion authorization page.' })
  @Redirect()
  authorize(@CurrentUserId() userId: string): { url: string } {
    if (!userId) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return { url: this.notionOauthService.buildAuthorizeUrl(userId) };
  }

  @Get('callback')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Notion OAuth callback' })
  @ApiOkResponse({
    description: 'Completes Notion connection or redirects on success.',
  })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state.');
    }

    await this.notionOauthService.handleCallback(code, state);

    const redirectUrl = this.configService.get<string>(
      'NOTION_OAUTH_SUCCESS_REDIRECT_URL',
    );
    if (!redirectUrl) {
      throw new InternalServerErrorException(
        'NOTION_OAUTH_SUCCESS_REDIRECT_URL is required.',
      );
    }

    res.redirect(302, redirectUrl);
  }
}
