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
      throw new InternalServerErrorException('GEMINI_API_KEY is required.');
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
        message: 'Gemini request failed.',
        statusCode: response.status,
        body: errorBody,
      });
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new BadRequestException('Gemini response is empty.');
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
        throw new BadRequestException('Gemini request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
