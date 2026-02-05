import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NotionAddPageRequestDto {
  @ApiProperty({ example: 'b1a2c3d4e5f6...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  notionPageId!: string;
}
