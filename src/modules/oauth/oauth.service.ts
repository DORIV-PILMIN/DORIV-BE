import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OauthLoginRequestDto } from './dtos/oauth-login-request.dto';
import { OauthLoginResponseDto } from './dtos/oauth-login-response.dto';
import { OauthRefreshRequestDto } from './dtos/oauth-refresh-request.dto';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OauthProviderService } from './oauth-provider.service';
import { OauthUserService } from './oauth-user.service';
import { OauthTokenService } from './oauth-token.service';

@Injectable()
export class OauthService {
  constructor(
    private readonly providerService: OauthProviderService,
    private readonly userService: OauthUserService,
    private readonly tokenService: OauthTokenService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async login(dto: OauthLoginRequestDto): Promise<OauthLoginResponseDto> {
    const provider = dto.provider;
    const tokenResponse = await this.providerService.exchangeCodeForToken(dto);
    const profile = await this.providerService.fetchUserProfile(
      provider,
      tokenResponse.accessToken,
    );

    const result = await this.userService.upsertUser({ provider, profile });
    const accessToken = await this.tokenService.createAccessToken(result.user.userId);
    const refreshToken = await this.tokenService.createRefreshToken(result.user.userId);

    return this.tokenService.buildTokenResponse({
      accessToken,
      refreshToken: refreshToken.rawToken,
      isNewUser: result.isNewUser,
      user: {
        userId: result.user.userId,
        email: result.user.email,
        name: result.user.name,
        profileImage: result.user.profileImage,
      },
    });
  }

  async refresh(dto: OauthRefreshRequestDto): Promise<OauthLoginResponseDto> {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.tokenService.hashToken(dto.refreshToken);

    const tokens = await this.userRepository.manager.transaction(async (manager) => {
      const refreshRepo = manager.getRepository(RefreshToken);
      const userRepo = manager.getRepository(User);

      const existing = await refreshRepo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        throw new UnauthorizedException('Refresh token not found');
      }

      if (existing.revokedAt) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      if (existing.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      if (payload.jti && payload.jti !== existing.refreshTokenId) {
        throw new UnauthorizedException('Refresh token mismatch');
      }

      if (payload.sub !== existing.userId) {
        throw new UnauthorizedException('Refresh token mismatch');
      }

      const user = await userRepo.findOne({ where: { userId: existing.userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const next = await this.tokenService.createRefreshToken(user.userId, refreshRepo);
      existing.revokedAt = new Date();
      existing.replacedByTokenId = next.refreshTokenId;
      await refreshRepo.save(existing);

      const accessToken = await this.tokenService.createAccessToken(user.userId);
      return { accessToken, refreshToken: next.rawToken, user };
    });

    return this.tokenService.buildTokenResponse({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser: false,
      user: {
        userId: tokens.user.userId,
        email: tokens.user.email,
        name: tokens.user.name,
        profileImage: tokens.user.profileImage,
      },
    });
  }
}
