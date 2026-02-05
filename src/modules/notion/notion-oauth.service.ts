import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes } from 'crypto';
import { NotionConnection } from './entities/notion-connection.entity';

type NotionTokenResponse = {
  access_token: string;
  token_type: string;
  bot_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  workspace_id: string;
  owner?: { type?: string; user?: { id?: string } };
};

@Injectable()
export class NotionOauthService {
  // Notion OAuth URL 생성 및 토큰 교환/저장을 담당
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly version: string;
  private readonly stateSecret: string;
  private readonly stateTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(NotionConnection)
    private readonly notionConnectionRepository: Repository<NotionConnection>,
  ) {
    this.clientId = configService.get<string>('NOTION_OAUTH_CLIENT_ID') ?? '';
    this.clientSecret = configService.get<string>('NOTION_OAUTH_CLIENT_SECRET') ?? '';
    this.redirectUri = configService.get<string>('NOTION_OAUTH_REDIRECT_URI') ?? '';
    this.version = configService.get<string>('NOTION_VERSION') ?? '2025-09-03';
    this.stateSecret =
      configService.get<string>('NOTION_OAUTH_STATE_SECRET') ??
      configService.get<string>('JWT_ACCESS_SECRET') ??
      '';
  }

  buildAuthorizeUrl(userId: string): string {
    // OAuth 승인 화면으로 이동할 URL 생성
    if (!this.clientId || !this.redirectUri) {
      throw new InternalServerErrorException('Notion OAuth 설정이 필요합니다.');
    }

    const state = this.createState(userId);
    const params = new URLSearchParams({
      owner: 'user',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<NotionConnection> {
    // 콜백 처리: state 검증 -> 토큰 교환 -> 연결 저장
    const userId = this.verifyState(state);
    const token = await this.exchangeCodeForToken(code);

    const connection = await this.upsertConnection(userId, token);
    return connection;
  }

  private createState(userId: string): string {
    // CSRF 방지용 state 생성
    if (!this.stateSecret) {
      throw new InternalServerErrorException('NOTION_OAUTH_STATE_SECRET 설정이 필요합니다.');
    }
    const payload = {
      userId,
      ts: Date.now(),
      nonce: randomBytes(8).toString('hex'),
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.stateSecret).update(encoded).digest('hex');
    return `${encoded}.${signature}`;
  }

  private verifyState(state: string): string {
    // state 무결성/만료 검증
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('잘못된 state 값입니다.');
    }
    const [encoded, signature] = parts;
    const expected = createHmac('sha256', this.stateSecret).update(encoded).digest('hex');
    if (expected !== signature) {
      throw new BadRequestException('잘못된 state 값입니다.');
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      userId: string;
      ts: number;
    };
    if (!payload?.userId || !payload?.ts) {
      throw new BadRequestException('잘못된 state 값입니다.');
    }
    if (Date.now() - payload.ts > this.stateTtlMs) {
      throw new BadRequestException('state 값이 만료되었습니다.');
    }
    return payload.userId;
  }

  private async exchangeCodeForToken(code: string): Promise<NotionTokenResponse> {
    // authorization code -> access token 교환
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new InternalServerErrorException('Notion OAuth 설정이 필요합니다.');
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`, 'utf8').toString('base64');
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        'Notion-Version': this.version,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException({
        message: '노션 OAuth 토큰 변경에 실패했습니다.',
        statusCode: response.status,
        body: errorBody,
      });
    }

    return (await response.json()) as NotionTokenResponse;
  }

  private async upsertConnection(
    userId: string,
    token: NotionTokenResponse,
  ): Promise<NotionConnection> {
    // 사용자별 노션 연결 저장/갱신
    const existing = await this.notionConnectionRepository.findOne({ where: { userId } });
    if (existing) {
      existing.accessToken = token.access_token;
      existing.workspaceId = token.workspace_id;
      return this.notionConnectionRepository.save(existing);
    }

    const connection = this.notionConnectionRepository.create({
      userId,
      accessToken: token.access_token,
      workspaceId: token.workspace_id,
    });
    return this.notionConnectionRepository.save(connection);
  }
}
