import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { MainPageResponseDto } from './dtos/main-page-response.dto';
import { MainService } from './main.service';

@ApiTags('main')
@Controller('main')
export class MainController {
  constructor(private readonly mainService: MainService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '메인 페이지 데이터 조회' })
  @ApiOkResponse({
    type: MainPageResponseDto,
    description: '메인 페이지 응답',
  })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  getMain(@CurrentUserId() userId: string): Promise<MainPageResponseDto> {
    return this.mainService.getMainPage(userId);
  }
}
