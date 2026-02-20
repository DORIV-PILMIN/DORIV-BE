import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MainController } from './main.controller';
import { MainService } from './main.service';
import { NotionPage } from '../notion/entities/notion-page.entity';
import { QuestionStatus } from '../question/entities/question-status.entity';
import { Question } from '../question/entities/question.entity';
import { QuestionAttempt } from '../question/entities/question-attempt.entity';
import { User } from '../user/entities/user.entity';
import { MainNotionSummaryService } from './services/main-notion-summary.service';
import { MainQuestionSummaryService } from './services/main-question-summary.service';
import { MainStatsService } from './services/main-stats.service';
import { MainUserService } from './services/main-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotionPage, QuestionStatus, Question, QuestionAttempt, User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [MainController],
  providers: [
    MainService,
    MainUserService,
    MainNotionSummaryService,
    MainQuestionSummaryService,
    MainStatsService,
  ],
})
export class MainModule {}
