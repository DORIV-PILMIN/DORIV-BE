import { ApiProperty } from '@nestjs/swagger';

export class MainRecentSessionDto {
  // 최근 학습한 질문 제목
  @ApiProperty({ example: 'React Hooks' })
  title!: string;

  // 결과 분류(PASS/WEAK/FAIL)
  @ApiProperty({ example: 'PASS', enum: ['PASS', 'WEAK', 'FAIL'] })
  result!: 'PASS' | 'WEAK' | 'FAIL';

  // 점수(0~100, 없을 수 있음)
  @ApiProperty({ example: 72, nullable: true })
  score!: number | null;

  // 풀이 시각
  @ApiProperty({ example: '2026-02-03T09:10:00.000Z' })
  createdAt!: Date;
}
