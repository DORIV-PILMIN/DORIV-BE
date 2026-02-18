import { ApiProperty } from '@nestjs/swagger';

export class MainWaitingQuestionDto {
  @ApiProperty({ example: 'bfa357a3-c251-47ca-aed5-2ed33b99d569' })
  questionId!: string;

  @ApiProperty({ example: 'What is the time complexity here?' })
  title!: string;
}
