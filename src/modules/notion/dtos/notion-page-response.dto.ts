import { ApiProperty } from '@nestjs/swagger';
import { NotionPageDto } from './notion-page.dto';

export class NotionPageResponseDto {
  @ApiProperty({ type: () => NotionPageDto })
  page!: NotionPageDto;
}
