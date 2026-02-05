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
import { Question } from './question.entity';

@Entity({ name: 'question_attempts' })
export class QuestionAttempt {
  // 풀이 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'question_attempt_id' })
  questionAttemptId!: string;

  // 유저 ID(FK)
  @Index('ix_question_attempts_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 질문 ID(FK)
  @Index('ix_question_attempts_question_id')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  // 유저 답변
  @Column({ name: 'user_answer', type: 'text' })
  userAnswer!: string;

  // AI 피드백
  @Column({ name: 'ai_feedback', type: 'text', nullable: true })
  aiFeedback!: string | null;

  // 답변 정확도 점수(0~100)
  @Column({ name: 'score', type: 'int', nullable: true })
  score!: number | null;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.questionAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // 질문(다:1)
  @ManyToOne(() => Question, (question) => question.questionAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;
}
