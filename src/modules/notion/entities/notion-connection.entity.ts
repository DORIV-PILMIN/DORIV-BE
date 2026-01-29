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
export class NotionConnection {
  // 노션 연결 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'notion_connection_id' })
  notionConnectionId!: string;

  // 유저 ID(FK)
  @Index('ix_notion_connections_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 워크스페이스 ID
  @Column({ name: 'workspace_id', type: 'varchar', length: 255 })
  workspaceId!: string;

  // 액세스 토큰
  @Column({ name: 'access_token', type: 'text' })
  accessToken!: string;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 수정 시간
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.notionConnections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
