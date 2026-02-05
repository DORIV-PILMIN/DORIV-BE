import { ApiProperty } from '@nestjs/swagger';
import { NotionSearchPageInfoDto } from './notion-search-page-info.dto';

export class NotionSearchPageInfoResponseDto {
  @ApiProperty({ type: () => NotionSearchPageInfoDto })
  pageInfo!: NotionSearchPageInfoDto;
}
