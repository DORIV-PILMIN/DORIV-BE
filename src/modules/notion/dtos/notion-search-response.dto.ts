import { ApiProperty } from '@nestjs/swagger';
import { NotionPageSummaryDto } from './notion-page-summary.dto';

export class NotionSearchResponseDto {
  @ApiProperty({ type: [NotionPageSummaryDto] })
  pages!: NotionPageSummaryDto[];

}
