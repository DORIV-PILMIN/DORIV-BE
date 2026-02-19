import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QuestionAttemptRequestDto {
  @ApiProperty({ example: 'HTTP methods include GET/POST/PUT/DELETE and ...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  answer!: string;
}
