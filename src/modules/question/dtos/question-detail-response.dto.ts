import { ApiProperty } from '@nestjs/swagger';
import { QuestionViewDto } from './question-view.dto';

export class QuestionDetailResponseDto {
  @ApiProperty({ type: () => QuestionViewDto })
  question!: QuestionViewDto;
}
