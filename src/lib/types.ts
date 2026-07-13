export type Role = "member" | "leader" | "manager" | "admin";
export type PeriodType = "day" | "week" | "month" | "half";
export type ReportType = "daily" | "weekly" | "monthly";
export type TargetScope = "member" | "team" | "division";
export type DealStage =
  | "ap"
  | "meeting"
  | "reclose"
  | "follow_up_later"
  | "contract_planned"
  | "contract"
  | "lost"
  | "appointment_cancelled"
  | "completed";
export type DealRank = "a" | "b" | "c" | "contract_planned" | "contract" | "lost";

export type Team = {
  id: string;
  name: string;
  color: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  teamId: string;
  position: string;
};

export type KpiItem = {
  id: string;
  name: string;
  unit: string;
  description: string;
  active: boolean;
};

export type KpiTarget = {
  id: string;
  scope: TargetScope;
  userId?: string;
  teamId?: string;
  kpiItemId: string;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  updatedAt: string;
};

export type KpiRecord = {
  id: string;
  userId: string;
  kpiItemId: string;
  date: string;
  actualValue: number;
  createdAt: string;
  updatedAt: string;
};

export type KpiRecordHistory = {
  id: string;
  recordId: string;
  previousValue: number;
  nextValue: number;
  changedAt: string;
  changedBy: string;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  date: string;
  attended: boolean;
  updatedAt: string;
};

export type Deal = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  stage: DealStage;
  rank?: DealRank;
  amount: number;
  createdAt: string;
  lastActionDate?: string;
  nextActionDate?: string;
  completedAt?: string;
  updatedAt: string;
};

export type TrainingSession = {
  id: string;
  sessionNumber: number;
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  updatedAt: string;
};

export type TrainingSchedule = {
  id: string;
  dealId: string;
  periodStart: string;
  periodEnd: string;
  sessions: TrainingSession[];
  createdAt: string;
  updatedAt: string;
};

export type ReportContent = {
  activity: string;
  result: string;
  issue: string;
  nextPlan: string;
  insight: string;
};

export type ReportKpiPlan = {
  kpiItemId: string;
  targetValue: number;
};

export type ReportAiFeedback = {
  specificPoints: string[];
  goodPoints: string[];
  missingPoints: string[];
  improvementPoints: string[];
  generatedAt: string;
  source: "ai" | "criteria";
};

export type Report = {
  id: string;
  userId: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  content: ReportContent;
  nextKpis: ReportKpiPlan[];
  aiFeedback?: ReportAiFeedback;
  readByUserIds: string[];
  readByManager?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReportComment = {
  id: string;
  reportId: string;
  commenterId: string;
  comment: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: "report_missing" | "comment_received";
  message: string;
  read: boolean;
  targetDate?: string;
  resolvedAt?: string;
  createdAt: string;
};

export type AnnouncementAttachment = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  authorId: string;
  message: string;
  important?: boolean;
  attachments: AnnouncementAttachment[];
  readByUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetType: "kpi" | "deal" | "training" | "target" | "member" | "team" | "report" | "announcement" | "backup" | "system";
  targetId?: string;
  summary: string;
  before?: string;
  after?: string;
  createdAt: string;
};

export type AppData = {
  users: User[];
  teams: Team[];
  kpiItems: KpiItem[];
  kpiTargets: KpiTarget[];
  kpiRecords: KpiRecord[];
  kpiRecordHistories: KpiRecordHistory[];
  attendanceRecords: AttendanceRecord[];
  deals: Deal[];
  trainingSchedules: TrainingSchedule[];
  reports: Report[];
  reportComments: ReportComment[];
  notifications: AppNotification[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
};
