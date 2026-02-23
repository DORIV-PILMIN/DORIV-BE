import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionConnection } from '../entities/notion-connection.entity';
import { NotionTokenCryptoService } from './notion-token-crypto.service';

@Injectable()
export class NotionConnectionAccessService {
  constructor(
    @InjectRepository(NotionConnection)
    private readonly notionConnectionRepository: Repository<NotionConnection>,
    private readonly notionTokenCryptoService: NotionTokenCryptoService,
  ) {}

  async getUserAccessTokenOrThrow(userId: string): Promise<string> {
    const connection = await this.notionConnectionRepository.findOne({
      where: { userId },
    });
    if (!connection?.accessToken) {
      throw new BadRequestException('Notion connection is required.');
    }
    return this.notionTokenCryptoService.decrypt(connection.accessToken);
  }
}
