import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { MainUserDto } from '../dtos/main-user.dto';

@Injectable()
export class MainUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUser(userId: string): Promise<MainUserDto> {
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) {
      return {
        userId,
        name: 'Unknown',
        profileImage: null,
        badge: null,
      };
    }

    return {
      userId: user.userId,
      name: user.name,
      profileImage: user.profileImage,
      badge: null,
    };
  }
}
