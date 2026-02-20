import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotionPage } from './entities/notion-page.entity';
import { PageSnapshot } from './entities/page-snapshot.entity';
import { NotionConnection } from './entities/notion-connection.entity';
import { NotionController } from './notion.controller';
import { NotionOauthController } from './notion-oauth.controller';
import { NotionService } from './services/notion.service';
import { NotionClientService } from './services/notion-client.service';
import { NotionParsingService } from './services/notion-parsing.service';
import { NotionTokenCryptoService } from './services/notion-token-crypto.service';
import { NotionOauthService } from './notion-oauth.service';
import { NotionConnectionAccessService } from './services/notion-connection-access.service';
import { NotionPageSearchService } from './services/notion-page-search.service';
import { NotionPageConnectService } from './services/notion-page-connect.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotionPage, PageSnapshot, NotionConnection]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [NotionController, NotionOauthController],
  providers: [
    NotionService,
    NotionClientService,
    NotionParsingService,
    NotionTokenCryptoService,
    NotionOauthService,
    NotionConnectionAccessService,
    NotionPageSearchService,
    NotionPageConnectService,
  ],
})
export class NotionModule {}
