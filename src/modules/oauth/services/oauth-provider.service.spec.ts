import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, sign } from 'node:crypto';
import { OauthProvider } from '../dtos/oauth-provider.enum';
import { OauthProviderService } from './oauth-provider.service';

const GOOGLE_CLIENT_ID = 'google-client-id';

type TestGoogleJwk = JsonWebKey & {
  alg?: string;
  kid?: string;
  use?: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function createGoogleIdToken(privateKey: string): string {
  const header = toBase64Url(
    JSON.stringify({
      alg: 'RS256',
      kid: 'kid-1',
      typ: 'JWT',
    }),
  );
  const payload = toBase64Url(
    JSON.stringify({
      aud: GOOGLE_CLIENT_ID,
      email: 'doriv@example.com',
      exp: Math.floor(Date.now() / 1000) + 60 * 10,
      iss: 'https://accounts.google.com',
      name: 'Doriv User',
      picture: 'https://example.com/profile.png',
      sub: 'google-user-1',
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

describe('OauthProviderService', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') {
        return GOOGLE_CLIENT_ID;
      }
      if (key === 'OAUTH_HTTP_TIMEOUT_MS') {
        return 5000;
      }
      throw new Error(`Unexpected key: ${key}`);
    }),
  } as unknown as ConfigService;

  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses Google id_token claims and skips userinfo when verification succeeds', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: 'jwk' }) as TestGoogleJwk;
    jwk.alg = 'RS256';
    jwk.kid = 'kid-1';
    jwk.use = 'sig';

    const fetchMock = jest.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: {
            'cache-control': 'public, max-age=3600',
            'content-type': 'application/json',
          },
        });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new OauthProviderService(configService);
    const profile = await service.fetchUserProfile(
      OauthProvider.GOOGLE,
      'access-token',
      createGoogleIdToken(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()),
    );

    expect(profile).toEqual({
      providerUserId: 'google-user-1',
      email: 'doriv@example.com',
      name: 'Doriv User',
      profileImage: 'https://example.com/profile.png',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      expect.anything(),
    );
  });

  it('falls back to Google userinfo when id_token validation fails', async () => {
    const fetchMock = jest.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return new Response(
          JSON.stringify({
            sub: 'google-user-2',
            email: 'fallback@example.com',
            name: 'Fallback User',
            picture: 'https://example.com/fallback.png',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new OauthProviderService(configService);
    const profile = await service.fetchUserProfile(
      OauthProvider.GOOGLE,
      'access-token',
      'invalid-token',
    );

    expect(profile).toEqual({
      providerUserId: 'google-user-2',
      email: 'fallback@example.com',
      name: 'Fallback User',
      profileImage: 'https://example.com/fallback.png',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer access-token',
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
