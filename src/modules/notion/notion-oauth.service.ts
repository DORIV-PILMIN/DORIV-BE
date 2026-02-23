import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes } from 'crypto';
import { NotionConnection } from './entities/notion-connection.entity';
import { NotionTokenCryptoService } from './services/notion-token-crypto.service';

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
    private readonly notionTokenCryptoService: NotionTokenCryptoService,
  ) {
    this.clientId = configService.get<string>('NOTION_OAUTH_CLIENT_ID') ?? '';
    this.clientSecret =
      configService.get<string>('NOTION_OAUTH_CLIENT_SECRET') ?? '';
    this.redirectUri =
      configService.get<string>('NOTION_OAUTH_REDIRECT_URI') ?? '';
    this.version = configService.get<string>('NOTION_VERSION') ?? '2025-09-03';
    this.stateSecret =
      configService.get<string>('NOTION_OAUTH_STATE_SECRET') ??
      configService.get<string>('JWT_ACCESS_SECRET') ??
      '';
  }

  buildAuthorizeUrl(userId: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new InternalServerErrorException(
        'Notion OAuth configuration is required.',
      );
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
    const userId = this.verifyState(state);
    const token = await this.exchangeCodeForToken(code);
    return this.upsertConnection(userId, token);
  }

  private createState(userId: string): string {
    if (!this.stateSecret) {
      throw new InternalServerErrorException(
        'NOTION_OAUTH_STATE_SECRET is required.',
      );
    }

    const payload = {
      userId,
      ts: Date.now(),
      nonce: randomBytes(8).toString('hex'),
    };

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.stateSecret)
      .update(encoded)
      .digest('hex');
    return `${encoded}.${signature}`;
  }

  private verifyState(state: string): string {
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid state value.');
    }

    const [encoded, signature] = parts;
    const expected = createHmac('sha256', this.stateSecret)
      .update(encoded)
      .digest('hex');
    if (expected !== signature) {
      throw new BadRequestException('Invalid state value.');
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as {
      userId: string;
      ts: number;
    };

    if (!payload?.userId || !payload?.ts) {
      throw new BadRequestException('Invalid state value.');
    }

    if (Date.now() - payload.ts > this.stateTtlMs) {
      throw new BadRequestException('State value is expired.');
    }

    return payload.userId;
  }

  private async exchangeCodeForToken(
    code: string,
  ): Promise<NotionTokenResponse> {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new InternalServerErrorException(
        'Notion OAuth configuration is required.',
      );
    }

    const basic = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
      'utf8',
    ).toString('base64');
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
        message: 'Failed to exchange Notion OAuth token.',
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
    const encryptedToken = this.notionTokenCryptoService.encrypt(
      token.access_token,
    );

    await this.notionConnectionRepository.upsert(
      {
        userId,
        accessToken: encryptedToken,
        workspaceId: token.workspace_id,
      },
      ['userId'],
    );

    const saved = await this.notionConnectionRepository.findOne({
      where: { userId },
    });
    if (!saved) {
      throw new InternalServerErrorException(
        'Failed to persist Notion connection.',
      );
    }

    return saved;
  }
}
