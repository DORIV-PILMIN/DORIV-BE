import { ApiProperty } from '@nestjs/swagger';

export class QuestionGenerateResponseDto {
  @ApiProperty({ isArray: true, example: ['Question 1', 'Question 2'] })
  questions!: string[];
}
