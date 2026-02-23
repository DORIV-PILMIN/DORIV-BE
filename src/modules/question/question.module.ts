import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PageSnapshot } from '../notion/entities/page-snapshot.entity';
import { NotionPage } from '../notion/entities/notion-page.entity';
import { Question } from './entities/question.entity';
import { QuestionGenerationService } from './services/question-generation.service';
import { GeminiClientService } from '../ai/gemini-client.service';
import { QuestionController } from './question.controller';
import { QuestionAttempt } from './entities/question-attempt.entity';
import { QuestionStatus } from './entities/question-status.entity';
import { QuestionAttemptService } from './services/question-attempt.service';
import { QuestionEvaluationService } from './services/question-evaluation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PageSnapshot,
      NotionPage,
      Question,
      QuestionAttempt,
      QuestionStatus,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [
    GeminiClientService,
    QuestionGenerationService,
    QuestionEvaluationService,
    QuestionAttemptService,
  ],
  controllers: [QuestionController],
  exports: [QuestionGenerationService],
})
export class QuestionModule {}
