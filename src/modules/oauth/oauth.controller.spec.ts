import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OauthController } from './oauth.controller';
import { OauthProvider } from './dtos/oauth-provider.enum';
import { OauthAuthorizationSessionService } from './services/oauth-authorization-session.service';
import { OauthCallbackTicketService } from './services/oauth-callback-ticket.service';
import { OauthService } from './services/oauth.service';

describe('OauthController', () => {
  const oauthService = {} as OauthService;
  const callbackTicketService = {} as OauthCallbackTicketService;
  const authorizationSessionService = {
    create: jest.fn().mockReturnValue({
      sessionId: 'session-1',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    }),
  } as unknown as OauthAuthorizationSessionService;
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'GOOGLE_REDIRECT_URI') {
        return 'https://api.example.com/oauth/google/callback';
      }
      if (key === 'GOOGLE_CLIENT_ID') {
        return 'google-client-id';
      }
      throw new Error(`Unexpected key: ${key}`);
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds Google authorize url without offline consent parameters', () => {
    const controller = new OauthController(
      oauthService,
      configService,
      callbackTicketService,
      authorizationSessionService,
    );
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = controller.getAuthorizeUrl(OauthProvider.GOOGLE, response);
    const url = new URL(result.url);

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('google-client-id');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.get('access_type')).toBeNull();
    expect(url.searchParams.get('prompt')).toBeNull();
    expect((response.cookie as jest.Mock).mock.calls[0]?.[0]).toBe(
      'oauth_session_google',
    );
  });
});
