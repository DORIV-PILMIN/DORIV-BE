import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OauthProvider } from './dtos/oauth-provider.enum';
import { OauthUser } from './entities/oauth-user.entity';
import { User } from '../user/entities/user.entity';
import { ProviderUserProfile } from './oauth-provider.service';

@Injectable()
export class OauthUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OauthUser)
    private readonly oauthUserRepository: Repository<OauthUser>,
  ) {}

  async upsertUser(params: {
    provider: OauthProvider;
    profile: ProviderUserProfile;
  }): Promise<{ user: User; isNewUser: boolean }> {
    const { provider, profile } = params;

    return this.userRepository.manager.transaction(async (manager) => {
      const oauthRepo = manager.getRepository(OauthUser);
      const userRepo = manager.getRepository(User);

      let oauthUser = await oauthRepo.findOne({
        where: { provider, providerUserId: profile.providerUserId },
        relations: ['user'],
      });

      let user: User;
      let isNewUser = false;

      if (!oauthUser) {
        isNewUser = true;
        user = userRepo.create({
          email: profile.email,
          name: profile.name,
          profileImage: profile.profileImage,
        });
        await userRepo.save(user);

        oauthUser = oauthRepo.create({
          userId: user.userId,
          provider,
          providerUserId: profile.providerUserId,
          providerEmail: profile.email,
        });
        await oauthRepo.save(oauthUser);
      } else {
        user = oauthUser.user;
        const needsUpdate =
          user.email !== profile.email ||
          user.name !== profile.name ||
          user.profileImage !== profile.profileImage;
        if (needsUpdate) {
          user.email = profile.email;
          user.name = profile.name;
          user.profileImage = profile.profileImage;
          await userRepo.save(user);
        }
      }

      return { user, isNewUser };
    });
  }
}
