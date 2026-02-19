import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;

  const makeContext = (headers: Record<string, string | undefined>, user?: { userId: string }) => {
    const request: { headers: Record<string, string | undefined>; user?: { userId: string } } = {
      headers,
      user,
    };

    return {
      request,
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when Authorization header is missing', async () => {
    const guard = new JwtAuthGuard(jwtService, configService);
    const { context } = makeContext({});

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when payload sub is missing', async () => {
    const guard = new JwtAuthGuard(jwtService, configService);
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ typ: 'access' });

    const { context } = makeContext({ authorization: 'Bearer token' });

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('injects userId when token is valid', async () => {
    const guard = new JwtAuthGuard(jwtService, configService);
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', typ: 'access' });

    const { context, request } = makeContext({ authorization: 'Bearer token' });

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1' });
  });
});
