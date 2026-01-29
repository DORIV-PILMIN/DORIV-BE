import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'oauth_users' })
export class OauthUser {
  // OAuth ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'oauth_user_id' })
  oauthUserId!: string;

  // 유저 ID(FK)
  @Index('ix_oauth_users_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 공급자(google/kakao)
  @Column({ name: 'provider', type: 'varchar', length: 30 })
  provider!: string;

  // 공급자 유저 ID(UNIQUE)
  @Index('ux_oauth_provider_user_id', { unique: true })
  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId!: string;

  // OAuth 이메일
  @Column({ name: 'provider_email', type: 'varchar', length: 255, nullable: true })
  providerEmail!: string | null;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.oauthUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
