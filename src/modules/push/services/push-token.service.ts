import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushToken } from '../entities/push-token.entity';
import { PushTokenRegisterRequestDto } from '../dtos/push-token-register-request.dto';
import { PushTokenRegisterResponseDto } from '../dtos/push-token-register-response.dto';

@Injectable()
export class PushTokenService {
  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
  ) {}

  async registerToken(
    userId: string,
    dto: PushTokenRegisterRequestDto,
    userAgent: string | null,
  ): Promise<PushTokenRegisterResponseDto> {
    const token = dto.token.trim();
    if (!token) {
      throw new BadRequestException('푸시 토큰이 비어 있습니다.');
    }

    const platform = dto.platform?.trim() || 'WEB';
    const deviceType = dto.deviceType?.trim() || 'UNKNOWN';

    const existing = await this.pushTokenRepository.findOne({
      where: { token },
    });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.deviceType = deviceType;
      existing.userAgent = userAgent;
      const saved = await this.pushTokenRepository.save(existing);
      return {
        pushTokenId: saved.pushTokenId,
        token: saved.token,
        platform: saved.platform,
        deviceType: saved.deviceType,
      };
    }

    const entity = this.pushTokenRepository.create({
      userId,
      token,
      platform,
      deviceType,
      userAgent,
    });
    const saved = await this.pushTokenRepository.save(entity);
    return {
      pushTokenId: saved.pushTokenId,
      token: saved.token,
      platform: saved.platform,
      deviceType: saved.deviceType,
    };
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    await this.pushTokenRepository.delete({ userId, token });
  }

  async findByUserId(userId: string): Promise<PushToken[]> {
    return this.pushTokenRepository.find({ where: { userId } });
  }

  async deleteByTokenValues(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.pushTokenRepository.delete({ token: In(tokens) });
  }
}
