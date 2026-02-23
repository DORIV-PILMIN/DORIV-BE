import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
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
    return this.generateWithSnapshot(
      snapshot,
      params.questionsCount,
      params.scheduleId,
    );
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
      throw new BadRequestException(
        '생성된 질문 수가 요청된 개수보다 적습니다.',
      );
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
    const snapshot = await this.pageSnapshotRepository.findOne({
      where: { snapshotId },
    });
    if (!snapshot) {
      throw new BadRequestException('스냅샷을 찾을 수 없습니다.');
    }
    return snapshot;
  }

  private buildPrompt(plainText: string, questionsCount: number): string {
    return [
      '너는 직무 중립형 면접 질문 생성기다.',
      `아래 노션 정리 내용을 바탕으로 면접 질문을 정확히 ${questionsCount}개 생성해라.`,
      '질문은 노션 내용에서 드러나는 직무/도메인/업무 맥락을 우선 반영해야 한다.',
      '질문은 학습자의 이해도, 문제 해결력, 실무 적용 능력을 함께 검증해야 한다.',
      '면접관 관점으로, 지원자가 놓치기 쉬운 함정 포인트를 찌르는 질문을 우선하라.',
      '암기형 정의 질문만 반복하지 말고, 원인/영향/대안/트레이드오프를 묻게 만들어라.',
      '예외 상황, 엣지 케이스, 품질/리스크/운영 관점 질문을 반드시 포함하라.',
      '노션 내용에 있는 핵심 요소를 조합해 예상 밖 시나리오 질문을 만들어라.',
      `전체 ${questionsCount}개 중 최소 절반은 "왜/어떻게/만약" 형태의 깊이 질문으로 구성해라.`,
      '질문은 한국어로 작성하고, 각 항목은 문자열 1개(한 문장)여야 한다.',
      '질문들은 서로 중복되거나 표현만 바꾼 유사 질문이면 안 된다.',
      '기초 개념, 동작 원리, 트레이드오프, 실무 시나리오, 품질 개선 관점을 균형 있게 섞어라.',
      '노션에 없는 사실을 지어내지 말고, 제공된 내용 범위 안에서만 질문해라.',
      '정답, 해설, 번호, 마크다운, 코드블록을 절대 포함하지 마라.',
      `출력은 반드시 길이가 ${questionsCount}인 JSON 문자열 배열만 반환해라.`,
      '출력 예시: ["질문1","질문2"]',
      '',
      '노션 내용:',
      plainText,
    ].join('\n');
  }

  private parseQuestions(raw: string): string[] {
    let trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed
        .replace(/^```[a-zA-Z]*\s*/, '')
        .replace(/```$/, '')
        .trim();
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
      .filter(
        (line) =>
          line !== '```json' && line !== '```' && line !== '[' && line !== ']',
      )
      .map((line) => line.replace(/^"+|"+$/g, '').replace(/\\"/g, '"'));
  }

  private extractPlainText(content: Record<string, unknown>): string {
    const plainText = content?.plainText;
    if (typeof plainText === 'string') {
      return plainText.trim();
    }
    return '';
  }
}
