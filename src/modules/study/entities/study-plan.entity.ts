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
  // 플랜 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'plan_id' })
  planId!: string;

  // 유저 ID(FK)
  @Index('ix_study_plans_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 노션 페이지 ID(FK)
  @Index('ix_study_plans_page_id')
  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  // 학습 일수(1~5)
  @Column({ name: 'days', type: 'int' })
  days!: number;

  // 하루 문제 수(3~7)
  @Column({ name: 'questions_per_day', type: 'int' })
  questionsPerDay!: number;

  // 총 문제 수
  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions!: number;

  // 시작일(로컬 기준)
  @Column({ name: 'starts_at', type: 'date' })
  startsAt!: string;

  // 타임존
  @Column({ name: 'timezone', type: 'varchar', length: 50 })
  timezone!: string;

  // 상태(PENDING/ACTIVE/DONE)
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.userId, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // 노션 페이지(다:1)
  @ManyToOne(() => NotionPage, (page) => page.pageId, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page!: NotionPage;
}
