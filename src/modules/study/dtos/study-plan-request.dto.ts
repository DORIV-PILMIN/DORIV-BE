import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export class StudyPlanRequestDto {
  @ApiProperty({ example: 'uuid-of-notion-page' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  pageId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  days!: number;

  @ApiProperty({ example: 7, minimum: 3, maximum: 7 })
  @IsInt()
  @Min(3)
  @Max(7)
  questionsPerDay!: number;
}
