import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { StudyPlanRequestDto } from './dtos/study-plan-request.dto';
import { StudyPlanResponseDto } from './dtos/study-plan-response.dto';
import { StudyPlanService } from './services/study-plan.service';

@ApiTags('study')
@Controller('study')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudyController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Post('plans')
  @ApiOperation({ summary: 'Create study plan' })
  @ApiBody({ type: StudyPlanRequestDto })
  @ApiOkResponse({
    type: StudyPlanResponseDto,
    description: 'Created study plan.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  createPlan(
    @CurrentUserId() userId: string,
    @Body() dto: StudyPlanRequestDto,
  ): Promise<StudyPlanResponseDto> {
    return this.studyPlanService.createPlan(userId, dto);
  }
}
