import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OauthUser } from '../../oauth/entities/oauth-user.entity';
import { NotionConnection } from '../../notion/entities/notion-connection.entity';
import { NotionPage } from '../../notion/entities/notion-page.entity';
import { QuestionStatus } from '../../question/entities/question-status.entity';
import { QuestionAttempt } from '../../question/entities/question-attempt.entity';
import { RefreshToken } from '../../oauth/entities/refresh-token.entity';
import { PushToken } from '../../push/entities/push-token.entity';
import { PushSendLog } from '../../push/entities/push-send-log.entity';

@Entity({ name: 'user' })
export class User {
  // 유저 ID(PK)
  @PrimaryGeneratedColumn('uuid', { name: 'user_id' })
  userId!: string;

  // 이메일(UNIQUE)
  @Column({
    name: 'email',
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
  })
  email!: string | null;

  // 이름
  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  // 프로필 이미지
  @Column({ name: 'profile_image', type: 'text', nullable: true })
  profileImage!: string | null;

  // 생성 시간
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // OAuth 유저 목록(1:N)
  @OneToMany(() => OauthUser, (oauthUser) => oauthUser.user)
  oauthUsers!: OauthUser[];

  // 노션 연동 목록(1:N)
  @OneToMany(
    () => NotionConnection,
    (notionConnection) => notionConnection.user,
  )
  notionConnections!: NotionConnection[];

  // 노션 페이지 목록(1:N)
  @OneToMany(() => NotionPage, (notionPage) => notionPage.user)
  notionPages!: NotionPage[];

  // 질문 상태 목록(1:N)
  @OneToMany(() => QuestionStatus, (questionStatus) => questionStatus.user)
  questionStatuses!: QuestionStatus[];

  // 풀이 로그 목록(1:N)
  @OneToMany(() => QuestionAttempt, (questionAttempt) => questionAttempt.user)
  questionAttempts!: QuestionAttempt[];

  // 리프레시 토큰 목록(1:N)
  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens!: RefreshToken[];

  // 푸시 토큰 목록(1:N)
  @OneToMany(() => PushToken, (pushToken) => pushToken.user)
  pushTokens!: PushToken[];

  // 푸시 발송 로그 목록(1:N)
  @OneToMany(() => PushSendLog, (log) => log.user)
  pushSendLogs!: PushSendLog[];
}
