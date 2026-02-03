import { ApiProperty } from '@nestjs/swagger';

export class MainStatsDto {
  // 누적 플래시카드(질문) 개수
  @ApiProperty({ example: 1240, nullable: true })
  flashcardCount!: number | null;

  // 기억 유지율 평균(%)
  @ApiProperty({ example: 84, nullable: true })
  retentionRate!: number | null;
}
