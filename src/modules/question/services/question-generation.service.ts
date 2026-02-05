import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { NotionPage } from '../../notion/entities/notion-page.entity';
import { Question } from '../entities/question.entity';
import { GeminiClientService } from '../../ai/gemini-client.service';

@Injectable()
export class QuestionGenerationService {
  // ?ㅻ깄??湲곕컲 吏덈Ц ?앹꽦 諛?????꾨떞
  constructor(
    @InjectRepository(PageSnapshot)
    private readonly pageSnapshotRepository: Repository<PageSnapshot>,
    @InjectRepository(NotionPage)
    private readonly notionPageRepository: Repository<NotionPage>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    private readonly geminiClient: GeminiClientService,
  ) {}

  async generateFromSnapshot(
    snapshotId: string,
    questionsCount: number,
    scheduleId?: string | null,
  ): Promise<Question[]> {
    const snapshot = await this.getSnapshotOrThrow(snapshotId);
    return this.generateWithSnapshot(snapshot, questionsCount, scheduleId);
  }

  async generateFromSnapshotForUser(params: {
    snapshotId: string;
    questionsCount: number;
    userId: string;
    scheduleId?: string | null;
  }): Promise<Question[]> {
    const snapshot = await this.getSnapshotOrThrow(params.snapshotId);
    const page = await this.notionPageRepository.findOne({
      where: { pageId: snapshot.pageId },
    });
    if (!page || page.userId !== params.userId) {
      throw new ForbiddenException('?щ엺??吏덈Ц?앹꽦 ?쉶?먯엯?덈떎.');
    }
    return this.generateWithSnapshot(snapshot, params.questionsCount, params.scheduleId);
  }

  private async generateWithSnapshot(
    snapshot: PageSnapshot,
    questionsCount: number,
    scheduleId?: string | null,
  ): Promise<Question[]> {
    const snapshotId = snapshot.snapshotId;
    const plainText = this.extractPlainText(snapshot.content);
    if (!plainText) {
      throw new BadRequestException('?ㅻ깄???댁슜??鍮꾩뼱?덉뒿?덈떎.');
    }

    const prompt = this.buildPrompt(plainText, questionsCount);
    let raw = await this.geminiClient.generateText(prompt);
    let questions = this.parseQuestions(raw);

    // 1???ъ떆?? ?덈T ?곴쾶 ?앹꽦??寃쎌슦 蹂댁젙
    if (questions.length < questionsCount) {
      raw = await this.geminiClient.generateText(
        `${prompt}\n\n諛섎뱶??${questionsCount}媛쒖쓽 吏덈Ц??JSON 諛곗뿴濡쒕쭔 諛섑솚?대씪.`,
      );
      questions = this.parseQuestions(raw);
    }

    if (questions.length < questionsCount) {
      throw new BadRequestException('吏덈Ц 媛쒖닔媛 ?ㅼ젙??媛쒖닔蹂대떎 ?곸뒿?덈떎.');
    }

    if (questions.length > questionsCount) {
      questions = questions.slice(0, questionsCount);
    }

    const entities = questions.map((q) =>
      this.questionRepository.create({
        snapshotId,
        scheduleId: scheduleId ?? null,
        prompt: q,
      }),
    );
    return this.questionRepository.save(entities);
  }

  private async getSnapshotOrThrow(snapshotId: string): Promise<PageSnapshot> {
    const snapshot = await this.pageSnapshotRepository.findOne({ where: { snapshotId } });
    if (!snapshot) {
      throw new BadRequestException('?ㅻ깄?룹쓣 李얠쓣 ???놁뒿?덈떎.');
    }
    return snapshot;
  }

  private buildPrompt(plainText: string, questionsCount: number): string {
    return [
      '?덈뒗 硫댁젒 吏덈Ц ?앹꽦湲곕떎.',
      `?꾨옒 ?몄뀡 ?댁슜???쎄퀬 硫댁젒 吏덈Ц???뺥솗??${questionsCount}媛??앹꽦?대씪.`,
      '諛섎뱶??"???щ엺???몄뀡 ?뺣━ ?댁슜??????댄빐 ?щ? ?뺤씤"??愿??吏덈Ц?쇰줈 援ъ꽦?댁쨾.',
      '異쒕젰? JSON 諛곗뿴 ?뺤떇留?諛섑솚?대씪. ?? ["吏덈Ц1","吏덈Ц2"]',
      '',
      '?몄뀡 ?댁슜:',
      plainText,
    ].join('\n');
  }

  private parseQuestions(raw: string): string[] {
    let trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }

    // JSON 諛곗뿴 援ш컙留?異붿텧?댁꽌 ?뚯떛 ?쒕룄
    const startIdx = trimmed.indexOf('[');
    const endIdx = trimmed.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const slice = trimmed.slice(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(slice);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fallthrough
      }
    }

    // JSON ?뚯떛 ?ㅽ뙣 ??以꾨컮轅?湲곕컲 fallback
    return trimmed
      .split('\n')
      .map((line) => line.replace(/^\s*[\d-]+\s*[.)]?\s*/, '').trim())
      .filter(Boolean)
      .filter((line) => line !== '```json' && line !== '```' && line !== '[' && line !== ']')
      .map((line) => line.replace(/^"+|"+$/g, '').replace(/\\\"/g, '"'));
  }

  private extractPlainText(content: Record<string, unknown>): string {
    const plainText = content?.plainText;
    if (typeof plainText === 'string') {
      return plainText.trim();
    }
    return '';
  }
}
