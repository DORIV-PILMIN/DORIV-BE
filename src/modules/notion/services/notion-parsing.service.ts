import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class NotionParsingService {
  extractTitleFromPage(page: Record<string, any>): string {
    const properties = page?.properties ?? {};
    const titleProperty = Object.values(properties).find(
      (prop: any) => prop?.type === 'title' && Array.isArray(prop?.title),
    ) as { title?: Array<{ plain_text?: string }> } | undefined;

    const title = titleProperty?.title
      ?.map((item) => item.plain_text ?? '')
      .join('')
      .trim();

    return title && title.length > 0 ? title : 'Untitled';
  }

  extractPlainTextFromBlocks(blocks: unknown[]): string {
    const lines: string[] = [];

    const walk = (items: unknown[]) => {
      for (const item of items as Array<Record<string, any>>) {
        const type = item?.type;
        if (type && item[type]) {
          const value = item[type];
          const richText = Array.isArray(value?.rich_text)
            ? value.rich_text
            : Array.isArray(value?.title)
              ? value.title
              : [];
          const text = richText
            .map((rt: any) => rt?.plain_text ?? '')
            .join('')
            .trim();
          if (text) {
            lines.push(text);
          }
        }
        if (Array.isArray(item?.children)) {
          walk(item.children);
        }
      }
    };

    walk(blocks);
    return lines.join('\n');
  }

  createContentHash(
    notionPageId: string,
    content: Record<string, unknown>,
  ): string {
    const raw = `${notionPageId}:${JSON.stringify(content)}`;
    return createHash('sha256').update(raw).digest('hex');
  }
}
