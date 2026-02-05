import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OauthModule } from './modules/oauth/oauth.module';
import { MainModule } from './modules/main/main.module';
import { NotionModule } from './modules/notion/notion.module';
import { QuestionModule } from './modules/question/question.module';
import { StudyModule } from './modules/study/study.module';
import { User } from './modules/user/entities/user.entity';
import { OauthUser } from './modules/oauth/entities/oauth-user.entity';
import { RefreshToken } from './modules/oauth/entities/refresh-token.entity';
import { NotionConnection } from './modules/notion/entities/notion-connection.entity';
import { NotionPage } from './modules/notion/entities/notion-page.entity';
import { PageSnapshot } from './modules/notion/entities/page-snapshot.entity';
import { Question } from './modules/question/entities/question.entity';
import { QuestionStatus } from './modules/question/entities/question-status.entity';
import { QuestionAttempt } from './modules/question/entities/question-attempt.entity';
import { StudyPlan } from './modules/study/entities/study-plan.entity';
import { StudySchedule } from './modules/study/entities/study-schedule.entity';

const toPositiveNumber = (value: string | undefined, key: string): number => {
  if (value === undefined || value === '') {
    throw new Error(`${key} must be set`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return parsed;
};

const validateEnv = (env: Record<string, string | undefined>) => ({
  ...env,
  ACCESS_TOKEN_MINUTES: toPositiveNumber(env.ACCESS_TOKEN_MINUTES, 'ACCESS_TOKEN_MINUTES'),
  REFRESH_TOKEN_DAYS: toPositiveNumber(env.REFRESH_TOKEN_DAYS, 'REFRESH_TOKEN_DAYS'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const sslEnabled = configService.get<string>('DB_SSL') === 'true';
        const rejectUnauthorized =
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') !== 'false';
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<string>('DB_PORT') ?? 5432),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [
            User,
            OauthUser,
            RefreshToken,
            NotionConnection,
            NotionPage,
            PageSnapshot,
            Question,
            QuestionStatus,
            QuestionAttempt,
            StudyPlan,
            StudySchedule,
          ],
          autoLoadEntities: false,
          synchronize: true,
          ssl: sslEnabled ? { rejectUnauthorized } : undefined,
        };
      },
    }),
    OauthModule,
    MainModule,
    NotionModule,
    QuestionModule,
    StudyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
