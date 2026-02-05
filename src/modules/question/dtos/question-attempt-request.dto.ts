import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QuestionAttemptRequestDto {
  @ApiProperty({ example: 'HTTP 메서드는 GET/POST/PUT/DELETE 등이 있으며...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  answer!: string;
}
