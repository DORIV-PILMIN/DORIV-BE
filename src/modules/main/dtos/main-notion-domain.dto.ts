import { ApiProperty } from '@nestjs/swagger';
import { MainNotionPageDto } from './main-notion-page.dto';

export class MainNotionDomainDto {
  @ApiProperty({ type: () => MainNotionPageDto, isArray: true })
  pages!: MainNotionPageDto[];
}
