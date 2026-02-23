import { BadGatewayException, Injectable } from '@nestjs/common';
import { GeminiClientService } from '../../ai/gemini-client.service';

type EvaluationResult = {
  score: number;
  feedback: string;
};

@Injectable()
export class QuestionEvaluationService {
  constructor(private readonly geminiClient: GeminiClientService) {}

  async evaluate(question: string, answer: string): Promise<EvaluationResult> {
    const prompt = this.buildPrompt(question, answer);
    const raw = await this.geminiClient.generateText(prompt);
    const parsed = this.parseEvaluation(raw);

    if (parsed.score < 0 || parsed.score > 100) {
      throw new BadGatewayException('AI evaluation score is out of allowed range.');
    }
    if (!parsed.feedback) {
      throw new BadGatewayException('AI evaluation feedback is empty.');
    }

    return parsed;
  }

  private buildPrompt(question: string, answer: string): string {
    return [
      'You are an interview answer evaluator.',
      'Read the question and answer, then output score and feedback as JSON only.',
      'Output format: {"score": 0-100, "feedback": "..."}',
      '',
      'Question:',
      question,
      '',
      'Answer:',
      answer,
    ].join('\n');
  }

  private parseEvaluation(raw: string): EvaluationResult {
    let trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }

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

    throw new BadGatewayException('Failed to parse AI evaluation response.');
  }
}
