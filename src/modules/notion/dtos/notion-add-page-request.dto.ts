import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class NotionAddPageRequestDto {
  @ApiPropertyOptional({
    example:
      'https://www.notion.so/your-workspace/Page-Title-0f3c2a1b2c3d4e5f6a7b8c9d0e1f2a3b',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notionUrl?: string;

  @ApiPropertyOptional({ example: '0f3c2a1b2c3d4e5f6a7b8c9d0e1f2a3b' })
  @IsString()
  @ValidateIf((dto) => !dto.notionUrl)
  @IsNotEmpty()
  @MaxLength(36)
  notionPageId?: string;
}
