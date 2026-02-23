import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PageSnapshot } from './page-snapshot.entity';

@Entity({ name: 'notion_pages' })
export class NotionPage {
  // 노션 페이지 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'page_id' })
  pageId!: string;

  // 유저 ID(FK)
  @Index('ix_notion_pages_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 노션 페이지 ID(UNIQUE)
  @Column({ name: 'notion_page_id', type: 'varchar', length: 50, unique: true })
  notionPageId!: string;

  // 제목
  @Column({ name: 'title', type: 'text' })
  title!: string;

  // URL
  @Column({ name: 'url', type: 'text' })
  url!: string;

  // 연결 상태
  @Column({ name: 'is_connected', type: 'boolean' })
  isConnected!: boolean;

  // 연결 시간
  @Column({ name: 'connected_at', type: 'timestamp' })
  connectedAt!: Date;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.notionPages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  // 페이지 스냅샷 목록(1:N)
  @OneToMany(() => PageSnapshot, (pageSnapshot) => pageSnapshot.page)
  pageSnapshots!: PageSnapshot[];
}
