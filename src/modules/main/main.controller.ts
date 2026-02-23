import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { MainNotionDomainDto } from './dtos/main-notion-domain.dto';
import { MainPageResponseDto } from './dtos/main-page-response.dto';
import { MainQuestionDomainDto } from './dtos/main-question-domain.dto';
import { MainStatsDto } from './dtos/main-stats.dto';
import { MainUserDto } from './dtos/main-user.dto';
import { MainService } from './main.service';

@ApiTags('main')
@Controller('main')
@ApiExtraModels(
  MainPageResponseDto,
  MainUserDto,
  MainNotionDomainDto,
  MainQuestionDomainDto,
  MainStatsDto,
)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MainController {
  constructor(private readonly mainService: MainService) {}

  @Get()
  @ApiOperation({ summary: '메인 페이지 데이터 조회' })
  @ApiOkResponse({
    description: '메인 페이지 응답(도메인별 섹션)',
    schema: {
      type: 'object',
      properties: {
        user: { $ref: getSchemaPath(MainUserDto) },
        notion: { $ref: getSchemaPath(MainNotionDomainDto) },
        question: { $ref: getSchemaPath(MainQuestionDomainDto) },
        stats: { $ref: getSchemaPath(MainStatsDto) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getMain(@CurrentUserId() userId: string): Promise<MainPageResponseDto> {
    return this.mainService.getMainPage(userId);
  }

  @Get('user')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '메인 사용자 정보' })
  @ApiOkResponse({ type: MainUserDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getUser(@CurrentUserId() userId: string): Promise<MainUserDto> {
    return this.mainService.getUser(userId);
  }

  @Get('notion')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '메인 노션 요약' })
  @ApiOkResponse({ type: MainNotionDomainDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getNotion(@CurrentUserId() userId: string): Promise<MainNotionDomainDto> {
    return this.mainService.getNotion(userId);
  }

  @Get('question')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '메인 질문 요약' })
  @ApiOkResponse({ type: MainQuestionDomainDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getQuestion(@CurrentUserId() userId: string): Promise<MainQuestionDomainDto> {
    return this.mainService.getQuestion(userId);
  }

  @Get('stats')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '메인 학습 통계' })
  @ApiOkResponse({ type: MainStatsDto })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getStats(@CurrentUserId() userId: string): Promise<MainStatsDto> {
    return this.mainService.getStats(userId);
  }
}
