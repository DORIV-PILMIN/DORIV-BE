import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushToken } from './entities/push-token.entity';
import { PushSendLog } from './entities/push-send-log.entity';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { FcmAuthService } from './services/fcm-auth.service';
import { FcmMessageService } from './services/fcm-message.service';
import { PushLogService } from './services/push-log.service';
import { PushTokenService } from './services/push-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushToken, PushSendLog]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [PushController],
  providers: [
    PushService,
    PushTokenService,
    PushLogService,
    FcmAuthService,
    FcmMessageService,
  ],
  exports: [PushService],
})
export class PushModule {}
