import { ApiProperty } from '@nestjs/swagger';
import { MainNotionPageDto } from './main-notion-page.dto';
import { MainRecentSessionDto } from './main-recent-session.dto';
import { MainStatsDto } from './main-stats.dto';
import { MainUserDto } from './main-user.dto';
import { MainWaitingQuestionDto } from './main-waiting-question.dto';

export class MainPageResponseDto {
  // 사용자 요약 정보
  @ApiProperty({ type: () => MainUserDto })
  user!: MainUserDto;

  // 연결된 노션 페이지 목록
  @ApiProperty({ type: () => MainNotionPageDto, isArray: true })
  notionPages!: MainNotionPageDto[];

  // 풀어야 하는 질문(없을 수 있음)
  @ApiProperty({ type: () => MainWaitingQuestionDto, nullable: true })
  waitingQuestion!: MainWaitingQuestionDto | null;

  // 최근 문제 기록(최대 6개)
  @ApiProperty({ type: () => MainRecentSessionDto, isArray: true })
  recentSessions!: MainRecentSessionDto[];

  // 요약 통계
  @ApiProperty({ type: () => MainStatsDto })
  stats!: MainStatsDto;
}
