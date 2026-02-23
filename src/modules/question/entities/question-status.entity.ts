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

@Entity({ name: 'question_status' })
@Index('ux_question_status_user_question', ['userId', 'questionId'], {
  unique: true,
})
export class QuestionStatus {
  // 질문 상태 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'question_status_id' })
  questionStatusId!: string;

  // 유저 ID(FK)
  @Index('ix_question_status_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // 질문 ID(FK)
  @Index('ix_question_status_question_id')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  // 상태
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // 유저(다:1)
  @ManyToOne(() => User, (user) => user.questionStatuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // 질문(다:1)
  @ManyToOne(() => Question, (question) => question.questionStatuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question!: Question;
}
