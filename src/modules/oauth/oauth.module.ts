import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';
import { OauthProviderService } from './oauth-provider.service';
import { OauthUserService } from './oauth-user.service';
import { OauthTokenService } from './oauth-token.service';
import { User } from '../user/entities/user.entity';
import { OauthUser } from './entities/oauth-user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OauthUser, RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [OauthController],
  providers: [OauthService, OauthProviderService, OauthUserService, OauthTokenService],
  exports: [OauthService],
})
export class OauthModule {}
