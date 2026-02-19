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
import { NotionPage } from '../../notion/entities/notion-page.entity';

@Entity({ name: 'study_plans' })
export class StudyPlan {
  @PrimaryGeneratedColumn('uuid', { name: 'plan_id' })
  planId!: string;

  @Index('ix_study_plans_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('ix_study_plans_page_id')
  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  @Column({ name: 'days', type: 'int' })
  days!: number;

  @Column({ name: 'questions_per_day', type: 'int' })
  questionsPerDay!: number;

  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions!: number;

  // Local date string in plan timezone (YYYY-MM-DD)
  @Column({ name: 'starts_at', type: 'date' })
  startsAt!: string;

  @Column({ name: 'timezone', type: 'varchar', length: 50 })
  timezone!: string;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.userId, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => NotionPage, (page) => page.pageId, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page!: NotionPage;
}
