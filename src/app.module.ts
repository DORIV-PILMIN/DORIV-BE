import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OauthModule } from './modules/oauth/oauth.module';
import { OAUTH_TOKEN_DEFAULTS } from './modules/oauth/oauth.constants';
import { MainModule } from './modules/main/main.module';
import { User } from './modules/user/entities/user.entity';
import { OauthUser } from './modules/oauth/entities/oauth-user.entity';
import { RefreshToken } from './modules/oauth/entities/refresh-token.entity';
import { NotionConnection } from './modules/notion/entities/notion-connection.entity';
import { NotionPage } from './modules/notion/entities/notion-page.entity';
import { PageSnapshot } from './modules/notion/entities/page-snapshot.entity';
import { Question } from './modules/question/entities/question.entity';
import { QuestionStatus } from './modules/question/entities/question-status.entity';
import { QuestionAttempt } from './modules/question/entities/question-attempt.entity';

const toPositiveNumber = (value: string | undefined, fallback: number, key: string): number => {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return parsed;
};

const validateEnv = (env: Record<string, string | undefined>) => ({
  ...env,
  ACCESS_TOKEN_MINUTES: toPositiveNumber(
    env.ACCESS_TOKEN_MINUTES,
    OAUTH_TOKEN_DEFAULTS.accessTokenMinutes,
    'ACCESS_TOKEN_MINUTES',
  ),
  REFRESH_TOKEN_DAYS: toPositiveNumber(
    env.REFRESH_TOKEN_DAYS,
    OAUTH_TOKEN_DEFAULTS.refreshTokenDays,
    'REFRESH_TOKEN_DAYS',
  ),
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
          ],
          autoLoadEntities: false,
          synchronize: true,
          ssl: sslEnabled ? { rejectUnauthorized } : undefined,
        };
      },
    }),
    OauthModule,
    MainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
