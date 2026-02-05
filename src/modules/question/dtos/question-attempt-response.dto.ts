import { ApiProperty } from '@nestjs/swagger';

export class QuestionAttemptResponseDto {
  @ApiProperty({ example: 'attempt-uuid' })
  attemptId!: string;

  @ApiProperty({ example: 'PASS' })
  result!: 'PASS' | 'WEAK' | 'FAIL';

  @ApiProperty({ example: 82 })
  score!: number;

  @ApiProperty({ example: '핵심 개념 설명이 명확합니다. 다만 예시를 조금 더 보완해보세요.' })
  feedback!: string;
}
