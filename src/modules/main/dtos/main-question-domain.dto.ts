import { ApiProperty } from '@nestjs/swagger';
import { MainRecentSessionDto } from './main-recent-session.dto';
import { MainWaitingQuestionDto } from './main-waiting-question.dto';

export class MainQuestionDomainDto {
  @ApiProperty({ type: () => MainWaitingQuestionDto, nullable: true })
  waitingQuestion!: MainWaitingQuestionDto | null;

  @ApiProperty({ type: () => MainRecentSessionDto, isArray: true })
  recentSessions!: MainRecentSessionDto[];
}
