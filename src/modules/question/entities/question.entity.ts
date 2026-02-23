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
import { PageSnapshot } from '../../notion/entities/page-snapshot.entity';
import { QuestionStatus } from './question-status.entity';
import { QuestionAttempt } from './question-attempt.entity';

@Entity({ name: 'questions' })
export class Question {
  // 질문 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'question_id' })
  questionId!: string;

  // 스냅샷 ID(FK)
  @Index('ix_questions_snapshot_id')
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  // 스케줄 ID(FK, 선택)
  @Index('ix_questions_schedule_id')
  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId!: string | null;

  // 프롬프트
  @Column({ name: 'prompt', type: 'text' })
  prompt!: string;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 페이지 스냅샷(다:1)
  @ManyToOne(() => PageSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snapshot_id' })
  snapshot!: PageSnapshot;

  // 질문 상태 목록(1:N)
  @OneToMany(() => QuestionStatus, (questionStatus) => questionStatus.question)
  questionStatuses!: QuestionStatus[];

  // 풀이 로그 목록(1:N)
  @OneToMany(
    () => QuestionAttempt,
    (questionAttempt) => questionAttempt.question,
  )
  questionAttempts!: QuestionAttempt[];
}
