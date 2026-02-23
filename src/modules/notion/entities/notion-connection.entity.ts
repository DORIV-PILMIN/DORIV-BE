import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'notion_connections' })
@Index('ux_notion_connections_user_id', ['userId'], { unique: true })
export class NotionConnection {
  @PrimaryGeneratedColumn('uuid', { name: 'notion_connection_id' })
  notionConnectionId!: string;

  @Index('ix_notion_connections_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'workspace_id', type: 'varchar', length: 255 })
  workspaceId!: string;

  // Encrypted token at rest (aes-256-gcm)
  @Column({ name: 'access_token', type: 'text' })
  accessToken!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.notionConnections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
