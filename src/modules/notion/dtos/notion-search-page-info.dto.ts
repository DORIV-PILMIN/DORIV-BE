import { ApiProperty } from '@nestjs/swagger';

export class NotionSearchPageInfoDto {
  @ApiProperty({ example: false })
  hasMore!: boolean;

  @ApiProperty({ example: 'next-cursor', nullable: true })
  nextCursor!: string | null;
}
