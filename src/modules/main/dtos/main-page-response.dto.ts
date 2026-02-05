import { ApiProperty } from '@nestjs/swagger';
import { MainNotionDomainDto } from './main-notion-domain.dto';
import { MainQuestionDomainDto } from './main-question-domain.dto';
import { MainStatsDto } from './main-stats.dto';
import { MainUserDto } from './main-user.dto';

export class MainPageResponseDto {
  @ApiProperty({ type: () => MainUserDto })
  user!: MainUserDto;

  @ApiProperty({ type: () => MainNotionDomainDto })
  notion!: MainNotionDomainDto;

  @ApiProperty({ type: () => MainQuestionDomainDto })
  question!: MainQuestionDomainDto;

  @ApiProperty({ type: () => MainStatsDto })
  stats!: MainStatsDto;
}
