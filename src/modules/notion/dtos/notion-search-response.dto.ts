import { ApiProperty } from '@nestjs/swagger';
import { NotionPageSummaryDto } from './notion-page-summary.dto';

export class NotionSearchResponseDto {
  @ApiProperty({ type: [NotionPageSummaryDto] })
  pages!: NotionPageSummaryDto[];

  @ApiProperty({ example: false })
  hasMore!: boolean;

  @ApiProperty({ example: 'next-cursor', nullable: true })
  nextCursor!: string | null;
}
