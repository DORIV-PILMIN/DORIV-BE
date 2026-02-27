import { ApiProperty } from '@nestjs/swagger';

export class QuestionViewDto {
  @ApiProperty({ example: '682f2160-abc1-4cc3-ab28-b0ad9f6239b4' })
  questionId!: string;

  @ApiProperty({
    example: '비트 연산자와 시프트 연산자를 실무에서 어떻게 활용할 수 있나요?',
  })
  prompt!: string;

  @ApiProperty({ example: '2026-02-27T08:46:00.000Z' })
  createdAt!: Date;
}
