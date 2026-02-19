import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotionTokenCryptoService } from './notion-token-crypto.service';

describe('NotionTokenCryptoService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'NOTION_TOKEN_ENCRYPTION_KEY') {
        return 'notion-encryption-secret';
      }
      if (key === 'JWT_ACCESS_SECRET') {
        return 'jwt-access-secret';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  it('round-trips encrypted token', () => {
    const service = new NotionTokenCryptoService(configService);
    const encrypted = service.encrypt('plain-token');

    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(service.decrypt(encrypted)).toBe('plain-token');
  });

  it('returns legacy plaintext token as-is', () => {
    const service = new NotionTokenCryptoService(configService);
    expect(service.decrypt('legacy-plain-token')).toBe('legacy-plain-token');
  });

  it('throws for malformed encrypted token format', () => {
    const service = new NotionTokenCryptoService(configService);
    expect(() => service.decrypt('enc:v1:invalid')).toThrow(InternalServerErrorException);
  });
});
