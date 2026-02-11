import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PushSendLog } from './push-send-log.entity';

@Entity({ name: 'push_tokens' })
export class PushToken {
  @PrimaryGeneratedColumn('uuid', { name: 'push_token_id' })
  pushTokenId!: string;

  @Index('ix_push_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('ux_push_tokens_token', { unique: true })
  @Column({ name: 'token', type: 'text' })
  token!: string;

  @Column({ name: 'platform', type: 'varchar', length: 20 })
  platform!: string;

  @Column({ name: 'device_type', type: 'varchar', length: 30, default: 'UNKNOWN' })
  deviceType!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.userId, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => PushSendLog, (log) => log.pushToken)
  pushSendLogs!: PushSendLog[];
}
