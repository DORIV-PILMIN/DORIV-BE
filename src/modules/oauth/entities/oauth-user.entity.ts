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
@Index('ux_oauth_users_provider_provider_user_id', ['provider', 'providerUserId'], {
  unique: true,
})
export class OauthUser {
  @PrimaryGeneratedColumn('uuid', { name: 'oauth_user_id' })
  oauthUserId!: string;

  @Index('ix_oauth_users_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'provider', type: 'varchar', length: 30 })
  provider!: string;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId!: string;

  @Column({ name: 'provider_email', type: 'varchar', length: 255, nullable: true })
  providerEmail!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.oauthUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
