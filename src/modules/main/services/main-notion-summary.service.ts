import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionPage } from '../../notion/entities/notion-page.entity';
import { MainNotionDomainDto } from '../dtos/main-notion-domain.dto';
import { MainNotionPageDto } from '../dtos/main-notion-page.dto';

@Injectable()
export class MainNotionSummaryService {
  constructor(
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
  ) {}

  async getNotion(userId: string): Promise<MainNotionDomainDto> {
    const notionPages = await this.notionPageRepository.find({
      where: { userId },
      order: { connectedAt: 'DESC' },
      take: 5,
    });

    const pages: MainNotionPageDto[] = notionPages.map((page) => ({
      pageId: page.pageId,
      notionPageId: page.notionPageId,
      title: page.title,
      url: page.url,
      isConnected: page.isConnected,
      syncStatus: page.isConnected ? 'OK' : 'FAIL',
    }));

    return { pages };
  }
}
