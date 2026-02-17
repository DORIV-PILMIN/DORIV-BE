import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { NotionPage } from '../../notion/entities/notion-page.entity';
import { Question } from '../entities/question.entity';
import { GeminiClientService } from '../../ai/gemini-client.service';

@Injectable()
export class QuestionGenerationService {
  // 스냅샷 기반 질문 생성과 저장 처리
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
      throw new ForbiddenException('해당 사용자의 질문 생성 권한이 없습니다.');
    }
    return this.generateWithSnapshot(snapshot, params.questionsCount, params.scheduleId);
  }

  private async generateWithSnapshot(
    snapshot: PageSnapshot,
    questionsCount: number,
    scheduleId?: string | null,
  ): Promise<Question[]> {
    const snapshotId = snapshot.snapshotId;
    if (scheduleId) {
      const existing = await this.questionRepository.find({
        where: { scheduleId, snapshotId },
        order: { createdAt: 'ASC' },
      });
      if (existing.length >= questionsCount) {
        return existing.slice(0, questionsCount);
      }
      if (existing.length > 0) {
        await this.questionRepository.delete({ scheduleId, snapshotId });
      }
    }

    const plainText = this.extractPlainText(snapshot.content);
    if (!plainText) {
      throw new BadRequestException('스냅샷 텍스트 내용이 비어 있습니다.');
    }

    const prompt = this.buildPrompt(plainText, questionsCount);
    let raw = await this.geminiClient.generateText(prompt);
    let questions = this.parseQuestions(raw);

    // 1차 생성 개수가 부족하면 한 번 더 보정 요청
    if (questions.length < questionsCount) {
      raw = await this.geminiClient.generateText(
        `${prompt}\n\n반드시 ${questionsCount}개의 질문을 JSON 배열로만 반환하세요.`,
      );
      questions = this.parseQuestions(raw);
    }

    if (questions.length < questionsCount) {
      throw new BadRequestException('생성된 질문 수가 요청된 개수보다 적습니다.');
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
      throw new BadRequestException('스냅샷을 찾을 수 없습니다.');
    }
    return snapshot;
  }

  private buildPrompt(plainText: string, questionsCount: number): string {
    return [
      '너는 면접 질문 생성기다.',
      `아래 노션 정리 내용을 바탕으로 면접 질문을 정확히 ${questionsCount}개 생성해라.`,
      '질문은 학습자가 내용을 실제로 이해했는지 검증할 수 있는 형태로 작성해라.',
      '출력은 JSON 배열만 반환해라. 예: ["질문1","질문2"]',
      '',
      '노션 내용:',
      plainText,
    ].join('\n');
  }

  private parseQuestions(raw: string): string[] {
    let trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }

    // JSON 배열 구간만 추출해서 파싱 시도
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

    // JSON 파싱 실패 시 줄 단위 fallback
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
