import { ApiProperty } from '@nestjs/swagger';

export class MainWaitingQuestionDto {
  // 풀어야 하는 질문 제목
  @ApiProperty({ example: 'What is the time complexity here?' })
  title!: string;
}
