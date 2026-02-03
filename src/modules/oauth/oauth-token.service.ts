import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { OauthLoginResponseDto } from './dtos/oauth-login-response.dto';
import { RefreshToken } from './entities/refresh-token.entity';

type RefreshTokenPayload = {
  sub: string;
  jti?: string;
  typ: 'refresh';
};

type AccessTokenPayload = {
  sub: string;
  typ: 'access';
};

@Injectable()
export class OauthTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async verifyRefreshToken(rawToken: string): Promise<RefreshTokenPayload> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  buildTokenResponse(params: {
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
    user: OauthLoginResponseDto['user'];
  }): OauthLoginResponseDto {
    const accessTokenMinutes = this.configService.getOrThrow<number>('ACCESS_TOKEN_MINUTES');
    const refreshTokenDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_DAYS');
    const expiresIn = accessTokenMinutes * 60;
    const refreshTokenExpiresIn = refreshTokenDays * 24 * 60 * 60;

    return {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      tokenType: 'bearer',
      expiresIn,
      refreshTokenExpiresIn,
      isNewUser: params.isNewUser,
      user: params.user,
    };
  }

  async createAccessToken(userId: string): Promise<string> {
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const accessTokenMinutes = this.configService.getOrThrow<number>('ACCESS_TOKEN_MINUTES');
    const payload: AccessTokenPayload = { sub: userId, typ: 'access' };
    return this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: `${accessTokenMinutes}m`,
    });
  }

  async createRefreshToken(
    userId: string,
    repository: Repository<RefreshToken> = this.refreshTokenRepository,
  ): Promise<{ rawToken: string; refreshTokenId: string }> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshTokenDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_DAYS');
    const refreshTokenId = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, jti: refreshTokenId, typ: 'refresh' };
    const rawToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: `${refreshTokenDays}d`,
    });
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
    const entity = repository.create({
      refreshTokenId,
      userId,
      tokenHash,
      expiresAt,
    });
    await repository.save(entity);

    return { rawToken, refreshTokenId };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
