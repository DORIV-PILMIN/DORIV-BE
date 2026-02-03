import { ApiProperty } from '@nestjs/swagger';

export class MainUserDto {
  // 사용자 ID
  @ApiProperty({ example: 'b7e0d7d1-2d1b-4c5b-8b0f-8c8d1a9f6b2a' })
  userId!: string;

  // 사용자 이름
  @ApiProperty({ example: 'Alex M.' })
  name!: string;

  // 프로필 이미지 URL(없을 수 있음)
  @ApiProperty({ example: 'https://example.com/profile.png', nullable: true })
  profileImage!: string | null;

  // 사용자 뱃지/등급(없을 수 있음)
  @ApiProperty({ example: 'Pro User', nullable: true })
  badge!: string | null;
}
