import { ApiProperty } from '@nestjs/swagger';

export class NotionPageDto {
  @ApiProperty({ example: 'c0f1e2d3...' })
  pageId!: string;

  @ApiProperty({ example: 'b1a2c3d4e5f6...' })
  notionPageId!: string;

  @ApiProperty({ example: '면접 질문 정리' })
  title!: string;

  @ApiProperty({ example: 'https://www.notion.so/...' })
  url!: string;

  @ApiProperty({ example: true })
  isConnected!: boolean;

  @ApiProperty({ example: '2026-02-04T12:34:56.000Z' })
  connectedAt!: Date;
}
