import { ApiProperty } from '@nestjs/swagger';
import { NotionPageSummaryDto } from './notion-page-summary.dto';

export class NotionSearchPagesResponseDto {
  @ApiProperty({ type: [NotionPageSummaryDto] })
  pages!: NotionPageSummaryDto[];
}
