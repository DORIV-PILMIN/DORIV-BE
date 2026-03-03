import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OauthCallbackExchangeRequestDto {
  @ApiProperty({ example: 'b5d75343-ac4b-42f8-b933-985f17f4a85f' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  ticket!: string;
}
