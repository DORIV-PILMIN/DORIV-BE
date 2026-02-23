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
import type { Relation } from 'typeorm';
import { StudyPlan } from './study-plan.entity';

@Entity({ name: 'study_schedules' })
export class StudySchedule {
  // Schedule ID (PK)
  @PrimaryGeneratedColumn('uuid', { name: 'schedule_id' })
  scheduleId!: string;

  // Plan ID (FK)
  @Index('ix_study_schedules_plan_id')
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // Day index (0-based)
  @Column({ name: 'day_index', type: 'int' })
  dayIndex!: number;

  // Scheduled time (UTC)
  @Column({ name: 'scheduled_at', type: 'timestamp' })
  scheduledAt!: Date;

  // Snapshot ID used for generation (optional)
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId!: string | null;

  // Generated time (UTC)
  @Column({ name: 'generated_at', type: 'timestamp', nullable: true })
  generatedAt!: Date | null;

  // Status (PENDING/SENT/FAILED)
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  // Failure reason (optional)
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  // Created time
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // Plan (N:1)
  @ManyToOne(() => StudyPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<StudyPlan>;
}
