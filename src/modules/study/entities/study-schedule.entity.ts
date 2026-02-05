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
import { StudyPlan } from './study-plan.entity';

@Entity({ name: 'study_schedules' })
export class StudySchedule {
  // 스케줄 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'schedule_id' })
  scheduleId!: string;

  // 플랜 ID(FK)
  @Index('ix_study_schedules_plan_id')
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // n일차(0부터 시작)
  @Column({ name: 'day_index', type: 'int' })
  dayIndex!: number;

  // 발송 예정 시각(UTC)
  @Column({ name: 'scheduled_at', type: 'timestamp' })
  scheduledAt!: Date;

  // 생성에 사용한 스냅샷 ID(옵션)
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId!: string | null;

  // 질문 생성 완료 시각(UTC)
  @Column({ name: 'generated_at', type: 'timestamp', nullable: true })
  generatedAt!: Date | null;

  // 상태(PENDING/SENT)
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  // 생성/수정 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // 플랜(다:1)
  @ManyToOne(() => StudyPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: StudyPlan;
}
