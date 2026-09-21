import type { AppData, KpiTarget, PeriodType, TargetScope } from "./types";

const now = "2026-05-24T09:00:00.000Z";
const targetMonths = ["2026-05", "2026-06", "2026-07"] as const;

const kpiTargetItems = [
  { kpiItemId: "kpi-meetings", targetValue: 60 },
  { kpiItemId: "kpi-orders", targetValue: 10 },
  { kpiItemId: "kpi-sales", targetValue: 1080 },
  { kpiItemId: "kpi-ap", targetValue: 80 },
];

const memberMonthlyTargets = [
  {
    userId: "u-murakami-rin",
    values: { "kpi-meetings": 20, "kpi-orders": 4, "kpi-sales": 360, "kpi-ap": 28 },
  },
  {
    userId: "u-nojiri-kota",
    values: { "kpi-meetings": 20, "kpi-orders": 3, "kpi-sales": 360, "kpi-ap": 26 },
  },
  {
    userId: "u-kanemitsu-keita",
    values: { "kpi-meetings": 20, "kpi-orders": 3, "kpi-sales": 360, "kpi-ap": 26 },
  },
] as const;

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const endDay = new Date(year, monthNumber, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(endDay).padStart(2, "0")}` };
}

function target(
  scope: TargetScope,
  periodType: PeriodType,
  month: string,
  kpiItemId: string,
  targetValue: number,
  owner: { teamId?: string; userId?: string } = {},
): KpiTarget {
  const range = monthRange(month);
  const ownerId = owner.teamId ?? owner.userId ?? "all";
  return {
    id: `target-${scope}-${ownerId}-${kpiItemId}-${month}`,
    scope,
    teamId: owner.teamId,
    userId: owner.userId,
    kpiItemId,
    periodType,
    periodStart: range.start,
    periodEnd: range.end,
    targetValue,
    updatedAt: now,
  };
}

function monthlyTargets() {
  return targetMonths.flatMap((month) => [
    ...kpiTargetItems.map((item) => target("division", "month", month, item.kpiItemId, item.targetValue)),
    ...kpiTargetItems.map((item) => target("team", "month", month, item.kpiItemId, item.targetValue, { teamId: "team-saiteki-ai" })),
    ...memberMonthlyTargets.flatMap((member) =>
      Object.entries(member.values).map(([kpiItemId, targetValue]) =>
        target("member", "month", month, kpiItemId, targetValue, { userId: member.userId }),
      ),
    ),
  ]);
}

export const seedData: AppData = {
  teams: [{ id: "team-saiteki-ai", name: "最適AI", color: "#2563eb" }],
  users: [
    {
      id: "u-murakami-rin",
      name: "村上 輪",
      email: "r.murakami@saitekidenki.jp",
      password: "Pass3205",
      role: "admin",
      teamId: "team-saiteki-ai",
      position: "管理者",
    },
    {
      id: "u-nojiri-kota",
      name: "野尻 晃太",
      email: "nojiri@example.com",
      password: "nojiri123",
      role: "member",
      teamId: "team-saiteki-ai",
      position: "メンバー",
    },
    {
      id: "u-kanemitsu-keita",
      name: "金光 慶大",
      email: "kanemitsu@example.com",
      password: "kanemitsu123",
      role: "member",
      teamId: "team-saiteki-ai",
      position: "メンバー",
    },
  ],
  kpiItems: [
    { id: "kpi-calls", name: "架電数", unit: "件", description: "電話による接触数", active: true },
    { id: "kpi-ap", name: "AP数", unit: "件", description: "日次入力ベースのAP数", active: true },
    { id: "kpi-meetings", name: "初回商談数", unit: "件", description: "日次入力ベースの初回商談数", active: true },
    { id: "kpi-reclose", name: "再クロ数", unit: "件", description: "日次入力ベースの再クロ数", active: true },
    { id: "kpi-orders", name: "契約数", unit: "件", description: "案件ベースの契約数", active: true },
    { id: "kpi-sales", name: "売上", unit: "万円", description: "税抜売上", active: true },
    { id: "kpi-utilization", name: "稼働率", unit: "%", description: "出勤チェックへ移行済み", active: false },
  ],
  kpiTargets: monthlyTargets(),
  kpiRecords: [],
  kpiRecordHistories: [],
  attendanceRecords: [],
  deals: [],
  trainingSchedules: [],
  reports: [
    {
      id: "report-demo-daily-murakami",
      userId: "u-murakami-rin",
      reportType: "daily",
      periodStart: "2026-05-24",
      periodEnd: "2026-05-24",
      content: {
        activity: "KPI入力画面と案件登録の動作確認を実施。",
        result: "案件一覧の表示改善と日報入力の折り畳み方針を整理。",
        issue: "スマートフォンで一覧が詰まりやすい箇所を追加確認する必要あり。",
        nextPlan: "案件の横一線表示と編集導線を本番環境で確認する。",
        insight: "入力項目は常時見せるより、必要なときだけ開く構成のほうが迷いにくい。",
      },
      nextKpis: [
        { kpiItemId: "kpi-ap", targetValue: 3 },
        { kpiItemId: "kpi-meetings", targetValue: 2 },
        { kpiItemId: "kpi-reclose", targetValue: 1 },
        { kpiItemId: "kpi-orders", targetValue: 1 },
      ],
      readByUserIds: ["u-murakami-rin"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "report-demo-weekly-nojiri",
      userId: "u-nojiri-kota",
      reportType: "weekly",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10",
      content: {
        activity: "新規リストへの初回接点作りと既存案件のフォローを実施。",
        result: "次週に初回商談化できそうな候補を複数抽出。",
        issue: "失注理由の分類がまだ粗く、分析に使いにくい。",
        nextPlan: "案件ごとの状態を細かく更新し、再クロ候補を洗い出す。",
        insight: "アポキャン後の再接触タイミングを決めておくと取りこぼしが減りそう。",
      },
      nextKpis: [
        { kpiItemId: "kpi-ap", targetValue: 6 },
        { kpiItemId: "kpi-meetings", targetValue: 4 },
        { kpiItemId: "kpi-reclose", targetValue: 2 },
        { kpiItemId: "kpi-orders", targetValue: 1 },
      ],
      readByUserIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "report-demo-monthly-kanemitsu",
      userId: "u-kanemitsu-keita",
      reportType: "monthly",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      content: {
        activity: "PoC検討中企業への提案整理と追加相談対応を実施。",
        result: "提案金額と導入範囲の確認が進み、契約予定案件の見通しが立った。",
        issue: "導入後の運用体制について、顧客側の意思決定者確認が必要。",
        nextPlan: "6月は契約予定案件を完了へ進め、APと初回商談の母数も維持する。",
        insight: "売上だけでなく、案件ステータスの進み方を見ると次の打ち手が決めやすい。",
      },
      nextKpis: [
        { kpiItemId: "kpi-ap", targetValue: 26 },
        { kpiItemId: "kpi-meetings", targetValue: 20 },
        { kpiItemId: "kpi-reclose", targetValue: 8 },
        { kpiItemId: "kpi-orders", targetValue: 3 },
        { kpiItemId: "kpi-sales", targetValue: 360 },
      ],
      readByUserIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  reportComments: [
    {
      id: "comment-demo-daily",
      reportId: "report-demo-daily-murakami",
      commenterId: "u-murakami-rin",
      comment: "この方向で、スマホ表示を優先して整えていきましょう。",
      createdAt: now,
    },
  ],
  notifications: [],
  announcements: [
    {
      id: "announcement-1",
      authorId: "u-murakami-rin",
      message: "全体連絡や共有資料は右上のベルから確認できます。",
      attachments: [],
      readByUserIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  qualitativeInsights: [],
  auditLogs: [],
};
