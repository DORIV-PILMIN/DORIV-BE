import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NotionSearchParams = {
  query?: string;
  pageSize?: number;
  startCursor?: string;
};

type NotionSearchResponse = {
  results: unknown[];
  next_cursor: string | null;
  has_more: boolean;
};

type NotionBlockChildrenResponse = {
  results: unknown[];
  next_cursor: string | null;
  has_more: boolean;
};

@Injectable()
export class NotionClientService {
  private readonly token: string;
  private readonly version: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseUrl = 'https://api.notion.com/v1';

  constructor(private readonly configService: ConfigService) {
    this.token = configService.get<string>('NOTION_TOKEN') ?? '';
    this.version = configService.get<string>('NOTION_VERSION') ?? '2025-09-03';
    this.timeoutMs = Number(configService.get<string>('NOTION_TIMEOUT_MS') ?? 8000);
    this.maxRetries = Number(configService.get<string>('NOTION_MAX_RETRIES') ?? 2);
  }

  async searchPages(
    token: string | undefined,
    params: NotionSearchParams,
  ): Promise<NotionSearchResponse> {
    const body = {
      query: params.query,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: params.pageSize ?? 10,
      start_cursor: params.startCursor,
    };
    return this.request<NotionSearchResponse>(token, 'POST', '/search', body);
  }

  async retrievePage(token: string | undefined, pageId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(token, 'GET', `/pages/${pageId}`);
  }

  async retrieveAllBlockChildren(
    token: string | undefined,
    blockId: string,
    maxDepth = 2,
  ): Promise<unknown[]> {
    return this.retrieveBlockChildrenRecursive(token, blockId, maxDepth, 0);
  }

  private async retrieveBlockChildrenRecursive(
    token: string | undefined,
    blockId: string,
    maxDepth: number,
    depth: number,
  ): Promise<unknown[]> {
    const blocks: unknown[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const response = await this.retrieveBlockChildren(token, blockId, cursor);
      blocks.push(...response.results);
      cursor = response.has_more ? response.next_cursor : null;
    } while (cursor);

    if (depth < maxDepth) {
      for (const block of blocks as Array<Record<string, unknown>>) {
        if (block?.has_children) {
          const childId = String(block.id);
          const children = await this.retrieveBlockChildrenRecursive(
            token,
            childId,
            maxDepth,
            depth + 1,
          );
          block.children = children;
        }
      }
    }

    return blocks;
  }

  private async retrieveBlockChildren(
    token: string | undefined,
    blockId: string,
    startCursor?: string | null,
  ): Promise<NotionBlockChildrenResponse> {
    const query = new URLSearchParams();
    query.set('page_size', '100');
    if (startCursor) {
      query.set('start_cursor', startCursor);
    }
    const path = `/blocks/${blockId}/children?${query.toString()}`;
    return this.request<NotionBlockChildrenResponse>(token, 'GET', path);
  }

  private async request<T>(
    token: string | undefined,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const effectiveToken = token ?? this.token;
    if (!effectiveToken) {
      throw new InternalServerErrorException('NOTION_TOKEN is required.');
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${effectiveToken}`,
      'Notion-Version': this.version,
      'Content-Type': 'application/json',
    };

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchWithTimeout(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : 1000;
        await this.sleep(waitMs);
        continue;
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      const errorBody = await response.text();
      throw this.toHttpException(response.status, errorBody);
    }

    throw new ServiceUnavailableException('Notion API request exceeded retry limit.');
  }

  private toHttpException(status: number, errorBody: string): Error {
    if (status === 400 || status === 404) {
      return new BadRequestException({
        message: 'Notion API request is invalid.',
        statusCode: status,
        body: errorBody,
      });
    }

    if (status === 401 || status === 403) {
      return new BadRequestException({
        message: 'Notion connection is invalid or expired.',
        statusCode: status,
        body: errorBody,
      });
    }

    if (status === 429) {
      return new ServiceUnavailableException({
        message: 'Notion API is rate limited.',
        statusCode: status,
        body: errorBody,
      });
    }

    if (status >= 500) {
      return new BadGatewayException({
        message: 'Notion API failed.',
        statusCode: status,
        body: errorBody,
      });
    }

    return new BadGatewayException({
      message: 'Notion API request failed.',
      statusCode: status,
      body: errorBody,
    });
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new GatewayTimeoutException('Notion API request timed out.');
      }
      throw new ServiceUnavailableException('Notion API request failed due to a network error.');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
