import { ApiProperty } from '@nestjs/swagger';
import { NotionPageSummaryDto } from './notion-page-summary.dto';
import { NotionSearchPageInfoDto } from './notion-search-page-info.dto';

export class NotionSearchResponseDto {
  @ApiProperty({ type: [NotionPageSummaryDto] })
  pages!: NotionPageSummaryDto[];

  @ApiProperty({ type: () => NotionSearchPageInfoDto })
  pageInfo!: NotionSearchPageInfoDto;
}
