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
import { PushToken } from './push-token.entity';

@Entity({ name: 'push_send_logs' })
export class PushSendLog {
  @PrimaryGeneratedColumn('uuid', { name: 'push_send_log_id' })
  pushSendLogId!: string;

  @Index('ix_push_send_logs_user_id')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Index('ix_push_send_logs_token_id')
  @Column({ name: 'push_token_id', type: 'uuid', nullable: true })
  pushTokenId!: string | null;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'body', type: 'varchar', length: 2000 })
  body!: string;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data!: Record<string, string> | null;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.userId, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @ManyToOne(() => PushToken, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'push_token_id' })
  pushToken!: PushToken | null;
}
