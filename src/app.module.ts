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
import { PushToken } from './modules/push/entities/push-token.entity';
import { PushSendLog } from './modules/push/entities/push-send-log.entity';
import { PushModule } from './modules/push/push.module';

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

const requireEnv = (env: Record<string, string | number | undefined>, key: string): void => {
  const value = env[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${key} must be set`);
  }
};

const resolveSynchronize = (env: Record<string, string | undefined>): boolean => {
  if (env.DB_SYNCHRONIZE) {
    return env.DB_SYNCHRONIZE === 'true';
  }
  return env.NODE_ENV !== 'production';
};

const validateRequiredConfig = (env: Record<string, string | number | undefined>): void => {
  requireEnv(env, 'JWT_ACCESS_SECRET');
  requireEnv(env, 'JWT_REFRESH_SECRET');

  if (env.DATABASE_URL) {
    return;
  }

  requireEnv(env, 'DB_HOST');
  requireEnv(env, 'DB_PORT');
  requireEnv(env, 'DB_USERNAME');
  requireEnv(env, 'DB_PASSWORD');
  requireEnv(env, 'DB_NAME');
};

const validateEnv = (env: Record<string, string | undefined>) => ({
  ...env,
  ACCESS_TOKEN_MINUTES: toPositiveNumber(env.ACCESS_TOKEN_MINUTES, 'ACCESS_TOKEN_MINUTES'),
  REFRESH_TOKEN_DAYS: toPositiveNumber(env.REFRESH_TOKEN_DAYS, 'REFRESH_TOKEN_DAYS'),
  DB_SYNCHRONIZE: String(resolveSynchronize(env)),
});

const parseDatabaseUrl = (databaseUrl: string) => {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode');
  const sslEnabledByUrl = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    sslEnabledByUrl,
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        const validated = validateEnv(env);
        validateRequiredConfig(validated);
        return validated;
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const sslEnabled = configService.get<string>('DB_SSL') === 'true';
        const rejectUnauthorized =
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') !== 'false';
        const synchronize = configService.get<string>('DB_SYNCHRONIZE') === 'true';
        const dbFromUrl = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;
        const useSsl = dbFromUrl ? dbFromUrl.sslEnabledByUrl || sslEnabled : sslEnabled;

        return {
          type: 'postgres',
          host: dbFromUrl?.host ?? configService.get<string>('DB_HOST'),
          port: dbFromUrl?.port ?? Number(configService.get<string>('DB_PORT') ?? 5432),
          username: dbFromUrl?.username ?? configService.get<string>('DB_USERNAME'),
          password: dbFromUrl?.password ?? configService.get<string>('DB_PASSWORD'),
          database: dbFromUrl?.database ?? configService.get<string>('DB_NAME'),
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
            PushToken,
            PushSendLog,
          ],
          autoLoadEntities: false,
          synchronize,
          ssl: useSsl ? { rejectUnauthorized } : undefined,
        };
      },
    }),
    OauthModule,
    MainModule,
    NotionModule,
    QuestionModule,
    StudyModule,
    PushModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
