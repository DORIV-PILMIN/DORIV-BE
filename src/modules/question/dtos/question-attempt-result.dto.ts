import { ApiProperty } from '@nestjs/swagger';

export class QuestionAttemptResultDto {
  @ApiProperty({ example: 'attempt-uuid' })
  attemptId!: string;

  @ApiProperty({ example: 'bfa357a3-c251-47ca-aed5-2ed33b99d569' })
  questionId!: string;

  @ApiProperty({ example: 'PASS' })
  result!: 'PASS' | 'WEAK' | 'FAIL';

  @ApiProperty({ example: 82 })
  score!: number;

  @ApiProperty({ example: 'Answer feedback.' })
  feedback!: string;
}
