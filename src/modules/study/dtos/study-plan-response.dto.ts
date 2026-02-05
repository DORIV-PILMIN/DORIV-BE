import { ApiProperty } from '@nestjs/swagger';
import { StudyPlanDto } from './study-plan.dto';

export class StudyPlanResponseDto {
  @ApiProperty({ type: () => StudyPlanDto })
  plan!: StudyPlanDto;
}
