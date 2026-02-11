import { Body, Controller, Delete, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { PushTokenRegisterRequestDto } from './dtos/push-token-register-request.dto';
import { PushTokenRegisterResponseDto } from './dtos/push-token-register-response.dto';
import { PushTokenDeleteRequestDto } from './dtos/push-token-delete-request.dto';
import { PushSendRequestDto } from './dtos/push-send-request.dto';
import { PushSendResponseDto } from './dtos/push-send-response.dto';
import { PushVapidKeyResponseDto } from './dtos/push-vapid-key-response.dto';
import { PushSendLogQueryDto } from './dtos/push-send-log-query.dto';
import { PushSendLogListResponseDto } from './dtos/push-send-log-list-response.dto';
import { PushService } from './push.service';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-key')
  @ApiOperation({ summary: 'FCM Web VAPID 공개키 조회' })
  @ApiOkResponse({ type: PushVapidKeyResponseDto })
  getVapidKey(): PushVapidKeyResponseDto {
    return { vapidPublicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('tokens')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FCM 토큰 등록' })
  @ApiBody({ type: PushTokenRegisterRequestDto })
  @ApiOkResponse({ type: PushTokenRegisterResponseDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  registerToken(
    @CurrentUserId() userId: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Body() dto: PushTokenRegisterRequestDto,
  ): Promise<PushTokenRegisterResponseDto> {
    return this.pushService.registerToken(userId, dto, userAgent ?? null);
  }

  @Delete('tokens')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FCM 토큰 삭제' })
  @ApiBody({ type: PushTokenDeleteRequestDto })
  @ApiOkResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  async deleteToken(
    @CurrentUserId() userId: string,
    @Body() dto: PushTokenDeleteRequestDto,
  ): Promise<void> {
    await this.pushService.deleteToken(userId, dto.token);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 푸시 알림 발송' })
  @ApiBody({ type: PushSendRequestDto })
  @ApiOkResponse({ type: PushSendResponseDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  send(
    @CurrentUserId() userId: string,
    @Body() dto: PushSendRequestDto,
  ): Promise<PushSendResponseDto> {
    return this.pushService.sendToUser(userId, dto);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 푸시 발송 로그 조회' })
  @ApiOkResponse({ type: PushSendLogListResponseDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getLogs(
    @CurrentUserId() userId: string,
    @Query() query: PushSendLogQueryDto,
  ): Promise<PushSendLogListResponseDto> {
    return this.pushService.getLogs(userId, query.page, query.pageSize);
  }
}
