import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class NotionAddPageRequestDto {
  @ApiPropertyOptional({
    example:
      'https://www.notion.so/your-workspace/Page-Title-0f3c2a1b2c3d4e5f6a7b8c9d0e1f2a3b',
  })
  @IsString()
  @IsUrl(
    { require_protocol: true },
    { message: 'notionUrl must be a valid URL.' },
  )
  @IsOptional()
  @MaxLength(500)
  notionUrl?: string;

  @ApiPropertyOptional({ example: '0f3c2a1b2c3d4e5f6a7b8c9d0e1f2a3b' })
  @IsString()
  @ValidateIf((dto: NotionAddPageRequestDto) => !dto.notionUrl)
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F-]{32,36}$/, {
    message: 'notionPageId must be a valid Notion page id format.',
  })
  @MaxLength(36)
  notionPageId?: string;
}
