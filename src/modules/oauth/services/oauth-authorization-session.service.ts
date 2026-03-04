import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

  constructor() {
    const cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), 60_000);
    cleanupTimer.unref();
  }

  create(
    provider: OauthProvider,
    redirectUri: string,
  ): OauthAuthorizationPayload {
    const sessionId = randomUUID();
    const state = randomUUID();
    const expiresAt = Date.now() + this.sessionTtlMs;

    if (provider === OauthProvider.GOOGLE) {
      const codeVerifier = this.generateCodeVerifier();
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
    this.deleteSession(sessionId, session);

    if (!session || session.expiresAt <= Date.now()) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

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
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }
    return this.consume(provider, sessionId, state);
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
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
}
