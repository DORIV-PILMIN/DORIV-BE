import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { OauthProvider } from '../dtos/oauth-provider.enum';

type OauthAuthorizationSession = {
  provider: OauthProvider;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
  expiresAt: number;
};

export type OauthAuthorizationPayload = {
  sessionId: string;
  state: string;
  codeChallenge?: string;
};

@Injectable()
export class OauthAuthorizationSessionService {
  private readonly sessions = new Map<string, OauthAuthorizationSession>();
  private readonly stateIndex = new Map<string, string>();
  private readonly sessionTtlMs = 10 * 60 * 1000;
  private readonly stateSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.stateSecret =
      this.configService.get<string>('OAUTH_STATE_SECRET') ??
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    if (!this.stateSecret.trim()) {
      throw new InternalServerErrorException(
        'OAUTH_STATE_SECRET (or JWT_ACCESS_SECRET) must not be empty.',
      );
    }

    const cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), 60_000);
    cleanupTimer.unref();
  }

  create(
    provider: OauthProvider,
    redirectUri: string,
  ): OauthAuthorizationPayload {
    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.sessionTtlMs;
    const state = this.createSignedState({
      provider,
      redirectUri,
      expiresAt,
      nonce: randomUUID(),
    });

    if (provider === OauthProvider.GOOGLE) {
      const codeVerifier = this.deriveGoogleCodeVerifier(state);
      const codeChallenge = this.createCodeChallenge(codeVerifier);
      this.sessions.set(sessionId, {
        provider,
        state,
        redirectUri,
        codeVerifier,
        expiresAt,
      });
      this.stateIndex.set(state, sessionId);
      return { sessionId, state, codeChallenge };
    }

    this.sessions.set(sessionId, {
      provider,
      state,
      redirectUri,
      expiresAt,
    });
    this.stateIndex.set(state, sessionId);
    return { sessionId, state };
  }

  consume(
    provider: OauthProvider,
    sessionId: string,
    state: string,
  ): { redirectUri: string; codeVerifier?: string } {
    const session = this.sessions.get(sessionId);

    if (!session || session.expiresAt <= Date.now()) {
      return this.consumeFromSignedState(provider, state);
    }

    this.deleteSession(sessionId, session);

    if (session.provider !== provider) {
      throw new BadRequestException('OAuth state/provider mismatch.');
    }

    if (session.state !== state) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    if (provider === OauthProvider.GOOGLE && !session.codeVerifier) {
      throw new UnauthorizedException('OAuth code verifier is missing.');
    }

    return {
      redirectUri: session.redirectUri,
      codeVerifier: session.codeVerifier,
    };
  }

  consumeByState(
    provider: OauthProvider,
    state: string,
  ): { redirectUri: string; codeVerifier?: string } {
    const sessionId = this.stateIndex.get(state);
    if (!sessionId) {
      return this.consumeFromSignedState(provider, state);
    }
    return this.consume(provider, sessionId, state);
  }

  private createCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.deleteSession(sessionId, session);
      }
    }
  }

  private deleteSession(
    sessionId: string,
    session: OauthAuthorizationSession | undefined,
  ): void {
    this.sessions.delete(sessionId);
    if (session) {
      this.stateIndex.delete(session.state);
    }
  }

  private consumeFromSignedState(
    provider: OauthProvider,
    state: string,
  ): { redirectUri: string; codeVerifier?: string } {
    const payload = this.parseSignedState(state);
    if (payload.provider !== provider) {
      throw new BadRequestException('OAuth state/provider mismatch.');
    }

    return {
      redirectUri: payload.redirectUri,
      codeVerifier:
        provider === OauthProvider.GOOGLE
          ? this.deriveGoogleCodeVerifier(state)
          : undefined,
    };
  }

  private createSignedState(payload: {
    provider: OauthProvider;
    redirectUri: string;
    expiresAt: number;
    nonce: string;
  }): string {
    const encodedPayload = Buffer.from(
      JSON.stringify({
        p: payload.provider,
        r: payload.redirectUri,
        e: payload.expiresAt,
        n: payload.nonce,
      }),
    ).toString('base64url');

    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private parseSignedState(state: string): {
    provider: OauthProvider;
    redirectUri: string;
    expiresAt: number;
  } {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    const expectedSignature = this.sign(encodedPayload);
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (
      signatureBuf.length !== expectedBuf.length ||
      !timingSafeEqual(signatureBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    let payload: { p: string; r: string; e: number; n: string };
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as { p: string; r: string; e: number; n: string };
    } catch {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    if (
      (payload.p !== OauthProvider.GOOGLE && payload.p !== OauthProvider.KAKAO) ||
      typeof payload.r !== 'string' ||
      !payload.r.startsWith('http') ||
      typeof payload.e !== 'number' ||
      payload.e <= Date.now()
    ) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    return {
      provider: payload.p,
      redirectUri: payload.r,
      expiresAt: payload.e,
    };
  }

  private sign(input: string): string {
    return createHmac('sha256', this.stateSecret)
      .update(input)
      .digest('base64url');
  }

  private deriveGoogleCodeVerifier(state: string): string {
    // PKCE verifier is deterministically derived from signed state.
    return createHmac('sha256', this.stateSecret)
      .update(`google-pkce:${state}`)
      .digest('base64url');
  }
}
