import { BadRequestException, Injectable } from '@nestjs/common';
import { GeminiClientService } from '../../ai/gemini-client.service';

type EvaluationResult = {
  score: number;
  feedback: string;
};

@Injectable()
export class QuestionEvaluationService {
  // 사용자 답변 평가 전담(Gemini 호출)
  constructor(private readonly geminiClient: GeminiClientService) {}

  async evaluate(question: string, answer: string): Promise<EvaluationResult> {
    const prompt = this.buildPrompt(question, answer);
    const raw = await this.geminiClient.generateText(prompt);
    const parsed = this.parseEvaluation(raw);

    if (parsed.score < 0 || parsed.score > 100) {
      throw new BadRequestException('평가 점수 범위가 올바르지 않습니다.');
    }
    if (!parsed.feedback) {
      throw new BadRequestException('피드백이 비어있습니다.');
    }

    return parsed;
  }

  private buildPrompt(question: string, answer: string): string {
    return [
      '너는 면접 답변 평가자다.',
      '질문과 답변을 보고 0~100 점수와 피드백을 JSON으로만 출력해라.',
      '출력 형식: {"score": 0-100, "feedback": "..."}',
      '',
      '질문:',
      question,
      '',
      '답변:',
      answer,
    ].join('\n');
  }

  private parseEvaluation(raw: string): EvaluationResult {
    let trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }

    // JSON 객체 구간만 추출 시도
    const startIdx = trimmed.indexOf('{');
    const endIdx = trimmed.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const slice = trimmed.slice(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(slice) as EvaluationResult;
        if (typeof parsed.score === 'number' && typeof parsed.feedback === 'string') {
          return { score: parsed.score, feedback: parsed.feedback.trim() };
        }
      } catch {
        // fallthrough
      }
    }

    throw new BadRequestException('AI 평가 결과 파싱에 실패했습니다.');
  }
}
