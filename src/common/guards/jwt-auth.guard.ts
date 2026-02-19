import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

type AccessTokenPayload = {
  sub: string;
  typ?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { userId: string };
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Authorization header format is invalid.');
    }

    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Access token is invalid.');
    }

    if (!payload?.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      throw new UnauthorizedException('Access token is invalid.');
    }

    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Access token is invalid.');
    }

    request.user = { userId: payload.sub };
    return true;
  }
}
