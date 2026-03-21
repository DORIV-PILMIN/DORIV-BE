import { Injectable } from '@nestjs/common';
import { MainNotionDomainDto } from './dtos/main-notion-domain.dto';
import { MainQuestionDomainDto } from './dtos/main-question-domain.dto';
import { MainStatsDto } from './dtos/main-stats.dto';
import { MainUserDto } from './dtos/main-user.dto';
import { MainNotionSummaryService } from './services/main-notion-summary.service';
import { MainQuestionSummaryService } from './services/main-question-summary.service';
import { MainStatsService } from './services/main-stats.service';
import { MainUserService } from './services/main-user.service';
import { QuestionQueryService } from '../question/services/question-query.service';
import { QuestionViewDto } from '../question/dtos/question-view.dto';

@Injectable()
export class MainService {
  constructor(
    private readonly mainUserService: MainUserService,
    private readonly mainNotionSummaryService: MainNotionSummaryService,
    private readonly mainQuestionSummaryService: MainQuestionSummaryService,
    private readonly mainStatsService: MainStatsService,
    private readonly questionQueryService: QuestionQueryService,
  ) {}

  async getUser(userId: string): Promise<MainUserDto> {
    return this.mainUserService.getUser(userId);
  }

  async getNotion(userId: string): Promise<MainNotionDomainDto> {
    return this.mainNotionSummaryService.getNotion(userId);
  }

  async getQuestion(userId: string): Promise<MainQuestionDomainDto> {
    return this.mainQuestionSummaryService.getQuestion(userId);
  }

  async getWaitingQuestion(userId: string): Promise<QuestionViewDto | null> {
    return this.questionQueryService.getWaitingQuestion(userId);
  }

  async getStats(userId: string): Promise<MainStatsDto> {
    return this.mainStatsService.getStats(userId);
  }
}
