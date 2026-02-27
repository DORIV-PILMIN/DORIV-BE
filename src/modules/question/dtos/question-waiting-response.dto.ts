import { ApiProperty } from '@nestjs/swagger';
import { QuestionViewDto } from './question-view.dto';

export class QuestionWaitingResponseDto {
  @ApiProperty({ type: () => QuestionViewDto, nullable: true })
  waitingQuestion!: QuestionViewDto | null;
}
