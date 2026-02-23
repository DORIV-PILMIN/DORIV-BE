import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotionPage } from '../notion/entities/notion-page.entity';
import { PageSnapshot } from '../notion/entities/page-snapshot.entity';
import { QuestionModule } from '../question/question.module';
import { PushModule } from '../push/push.module';
import { Question } from '../question/entities/question.entity';
import { StudyPlan } from './entities/study-plan.entity';
import { StudySchedule } from './entities/study-schedule.entity';
import { StudyPlanService } from './services/study-plan.service';
import { StudySchedulerService } from './services/study-scheduler.service';
import { StudyController } from './study.controller';
import { StudyPlanCreationService } from './services/study-plan-creation.service';
import { StudyScheduleBuilderService } from './services/study-schedule-builder.service';
import { StudyScheduleClaimService } from './services/study-schedule-claim.service';
import { StudyScheduleProcessingService } from './services/study-schedule-processing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudyPlan,
      StudySchedule,
      NotionPage,
      PageSnapshot,
      Question,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    QuestionModule,
    PushModule,
  ],
  providers: [
    StudyPlanService,
    StudyPlanCreationService,
    StudyScheduleBuilderService,
    StudyScheduleClaimService,
    StudyScheduleProcessingService,
    StudySchedulerService,
  ],
  controllers: [StudyController],
})
export class StudyModule {}
