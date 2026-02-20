import { Injectable } from '@nestjs/common';
import { StudyPlanRequestDto } from '../dtos/study-plan-request.dto';
import { StudyPlanResponseDto } from '../dtos/study-plan-response.dto';
import { StudyPlanCreationService } from './study-plan-creation.service';

@Injectable()
export class StudyPlanService {
  constructor(private readonly studyPlanCreationService: StudyPlanCreationService) {}

  async createPlan(userId: string, dto: StudyPlanRequestDto): Promise<StudyPlanResponseDto> {
    return this.studyPlanCreationService.createPlan(userId, dto);
  }
}
