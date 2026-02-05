import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QuestionGenerateRequestDto {
  @ApiProperty({ example: 'snapshot-uuid' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  snapshotId!: string;

  @ApiProperty({ example: 5, minimum: 3, maximum: 7, required: false })
  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(7)
  questionsCount?: number;
}
