import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // Ensure critical indexes exist even when DB synchronize is disabled.
    await this.ensureCriticalIndexes();
  }

  private async ensureCriticalIndexes(): Promise<void> {
    const queries = [
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_question_status_user_question ON question_status (user_id, question_id)',
      'CREATE INDEX IF NOT EXISTS ix_study_schedules_status_scheduled_at ON study_schedules (status, scheduled_at)',
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_oauth_users_provider_provider_user_id ON oauth_users (provider, provider_user_id)',
      'DROP INDEX IF EXISTS ux_oauth_provider_user_id',
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_notion_connections_user_id ON notion_connections (user_id)',
    ];

    for (const query of queries) {
      try {
        await this.dataSource.query(query);
      } catch (error) {
        this.logger.warn(`Failed to apply startup index query: ${query}`);
        this.logger.warn(
          error instanceof Error ? error.message : 'unknown error',
        );
      }
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
