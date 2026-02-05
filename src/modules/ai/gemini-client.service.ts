import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

@Injectable()
export class GeminiClientService {
  // Gemini API 호출 전담(모델/타임아웃/응답 파싱)
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = configService.get<string>('GEMINI_API_KEY') ?? '';
    this.model = configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    this.timeoutMs = Number(configService.get<string>('GEMINI_TIMEOUT_MS') ?? 15000);
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY 설정이 필요합니다.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException({
        message: 'Gemini 질문 생성 요청에 실패했습니다.',
        statusCode: response.status,
        body: errorBody,
      });
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new BadRequestException('Gemini 응답이 비어있습니다.');
    }
    return text;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('Gemini 요청이 시간 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
