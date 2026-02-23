import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { QuestionAttemptRequestDto } from './dtos/question-attempt-request.dto';
import { QuestionAttemptResponseDto } from './dtos/question-attempt-response.dto';
import { QuestionAttemptService } from './services/question-attempt.service';
import { QuestionGenerateRequestDto } from './dtos/question-generate-request.dto';
import { QuestionGenerationService } from './services/question-generation.service';
import { QuestionGenerateResponseDto } from './dtos/question-generate-response.dto';

@ApiTags('question')
@Controller('questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuestionController {
  constructor(
    private readonly questionAttemptService: QuestionAttemptService,
    private readonly questionGenerationService: QuestionGenerationService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: '질문 생성' })
  @ApiBody({ type: QuestionGenerateRequestDto })
  @ApiOkResponse({
    type: QuestionGenerateResponseDto,
    description: '생성한 질문 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  async generate(
    @CurrentUserId() userId: string,
    @Body() dto: QuestionGenerateRequestDto,
  ): Promise<QuestionGenerateResponseDto> {
    const count = dto.questionsCount ?? 5;
    const questions =
      await this.questionGenerationService.generateFromSnapshotForUser({
        snapshotId: dto.snapshotId,
        questionsCount: count,
        userId,
      });
    return {
      questions: questions.map((q) => ({
        questionId: q.questionId,
        prompt: q.prompt,
      })),
    };
  }

  @Post(':questionId/attempts')
  @ApiOperation({ summary: '질문 풀이 제출 및 평가' })
  @ApiBody({ type: QuestionAttemptRequestDto })
  @ApiOkResponse({ type: QuestionAttemptResponseDto, description: '평가 결과' })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  async submitAttempt(
    @CurrentUserId() userId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: QuestionAttemptRequestDto,
  ): Promise<QuestionAttemptResponseDto> {
    const attempt = await this.questionAttemptService.submitAttempt(
      userId,
      questionId,
      dto,
    );
    return { attempt };
  }
}
