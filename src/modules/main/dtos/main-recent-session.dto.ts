import { ApiProperty } from '@nestjs/swagger';

export class MainRecentSessionDto {
  @ApiProperty({ example: '0a77fe66-0dc3-443b-879b-1a9b12345678' })
  attemptId!: string;

  @ApiProperty({ example: 'bfa357a3-c251-47ca-aed5-2ed33b99d569' })
  questionId!: string;

  @ApiProperty({ example: 'React Hooks' })
  title!: string;

  @ApiProperty({ example: 'PASS', enum: ['PASS', 'WEAK', 'FAIL'] })
  result!: 'PASS' | 'WEAK' | 'FAIL';

  @ApiProperty({ example: 72, nullable: true })
  score!: number | null;

  @ApiProperty({ example: '2026-02-03T09:10:00.000Z' })
  createdAt!: Date;
}
