import { ApiProperty } from '@nestjs/swagger';

export class QuestionAttemptResultDto {
  @ApiProperty({ example: 'attempt-uuid' })
  attemptId!: string;

  @ApiProperty({ example: 'PASS' })
  result!: 'PASS' | 'WEAK' | 'FAIL';

  @ApiProperty({ example: 82 })
  score!: number;

  @ApiProperty({ example: 'Answer feedback.' })
  feedback!: string;
}
