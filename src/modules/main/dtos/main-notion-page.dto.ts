import { ApiProperty } from '@nestjs/swagger';

export class MainNotionPageDto {
  // 내부 페이지 ID
  @ApiProperty({ example: 'b7e0d7d1-2d1b-4c5b-8b0f-8c8d1a9f6b2a' })
  pageId!: string;

  // 노션 페이지 ID
  @ApiProperty({ example: 'notion-page-id' })
  notionPageId!: string;

  // 페이지 제목
  @ApiProperty({ example: 'Algorithm Notes' })
  title!: string;

  // 노션 페이지 URL
  @ApiProperty({ example: 'https://www.notion.so/...' })
  url!: string;

  // 연동 상태
  @ApiProperty({ example: true })
  isConnected!: boolean;

  // 동기화 결과(OK/FAIL)
  @ApiProperty({ example: 'OK', enum: ['OK', 'FAIL'] })
  syncStatus!: 'OK' | 'FAIL';
}
