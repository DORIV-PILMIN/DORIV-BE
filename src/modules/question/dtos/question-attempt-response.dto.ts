import { ApiProperty } from '@nestjs/swagger';
import { QuestionAttemptResultDto } from './question-attempt-result.dto';

export class QuestionAttemptResponseDto {
  @ApiProperty({ type: () => QuestionAttemptResultDto })
  attempt!: QuestionAttemptResultDto;
}
