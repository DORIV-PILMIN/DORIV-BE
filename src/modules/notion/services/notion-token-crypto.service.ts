import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class NotionTokenCryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawSecret =
      this.configService.get<string>('NOTION_TOKEN_ENCRYPTION_KEY') ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      '';

    if (!rawSecret) {
      throw new InternalServerErrorException(
        'Token encryption key is not configured.',
      );
    }

    this.key = createHash('sha256').update(rawSecret).digest();
  }

  encrypt(plainToken: string): string {
    if (!plainToken) {
      return plainToken;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainToken, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      'enc',
      'v1',
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decrypt(storedToken: string): string {
    if (!storedToken) {
      return storedToken;
    }

    // Backward compatibility for existing plaintext tokens.
    if (!storedToken.startsWith('enc:v1:')) {
      return storedToken;
    }

    const parts = storedToken.split(':');
    if (parts.length !== 5) {
      throw new InternalServerErrorException(
        'Stored Notion token format is invalid.',
      );
    }

    const [, , ivPart, tagPart, cipherPart] = parts;

    try {
      const iv = Buffer.from(ivPart, 'base64url');
      const authTag = Buffer.from(tagPart, 'base64url');
      const encrypted = Buffer.from(cipherPart, 'base64url');

      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt stored Notion token.',
      );
    }
  }
}
