import { ApiProperty } from '@nestjs/swagger';

export class StudyPlanResponseDto {
  @ApiProperty({ example: 'plan-uuid' })
  planId!: string;

  @ApiProperty({ example: 'uuid-of-notion-page' })
  pageId!: string;

  @ApiProperty({ example: 5 })
  days!: number;

  @ApiProperty({ example: 7 })
  questionsPerDay!: number;

  @ApiProperty({ example: 35 })
  totalQuestions!: number;

  @ApiProperty({ example: '2026-02-04' })
  startsAt!: string;

  @ApiProperty({ example: 'Asia/Seoul' })
  timezone!: string;
}
