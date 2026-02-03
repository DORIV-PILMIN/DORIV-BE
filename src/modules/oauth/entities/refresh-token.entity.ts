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

@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  // 리프레시 토큰 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'refresh_token_id' })
  refreshTokenId!: string;

  // 유저 ID(FK)
  @Index('ix_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 토큰 해시(UNIQUE)
  @Index('ux_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  // 회전으로 대체된 토큰 ID
  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId!: string | null;

  // 무효화 시간(취소/회전)
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  // 만료 시간
  @Index('ix_refresh_tokens_expires_at')
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
