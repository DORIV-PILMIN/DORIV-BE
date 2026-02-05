import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // 기본 헬스체크/샘플 응답 제공
  getHello(): string {
    return 'Hello World!';
  }
}
