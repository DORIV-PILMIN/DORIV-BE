import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotionPage } from './notion-page.entity';

@Entity({ name: 'page_snapshots' })
export class PageSnapshot {
  // 스냅샷 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'snapshot_id' })
  snapshotId!: string;

  // 페이지 ID(FK)
  @Index('ix_page_snapshots_page_id')
  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  // 콘텐츠(JSONB)
  @Column({ name: 'content', type: 'jsonb' })
  content!: Record<string, unknown>;

  // 중복 방지 콘텐츠 해시(UNIQUE)
  @Column({ name: 'content_hash', type: 'varchar', length: 64, unique: true })
  contentHash!: string;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 노션 페이지(다:1)
  @ManyToOne(() => NotionPage, (page) => page.pageSnapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page!: NotionPage;
}
