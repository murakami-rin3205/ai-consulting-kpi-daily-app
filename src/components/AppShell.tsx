"use client";

import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Edit3,
  Eye,
  FileText,
  Gauge,
  GraduationCap,
  HelpCircle,
  History,
  Lightbulb,
  LineChart as LineChartIcon,
  LogOut,
  MessageSquare,
  Paperclip,
  PieChart as PieChartIcon,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { MessageResponse } from "@/components/ai-elements/message";
import { addDays, eachDate, formatDateJa, getPeriodRange, getReportRange, parseDateKey, toDateKey } from "@/lib/periods";
import { buildCriteriaReportFeedback, normalizeReportFeedback } from "@/lib/report-feedback";
import { seedData } from "@/lib/seed";
import type {
  AppData,
  AppNotification,
  Announcement,
  AnnouncementAttachment,
  AuditLog,
  AttendanceRecord,
  Deal,
  DealRank,
  DealStage,
  KpiItem,
  KpiRecord,
  KpiRecordHistory,
  KpiTarget,
  PeriodType,
  QualitativeInsightCategory,
  Report,
  ReportAiFeedback,
  ReportComment,
  ReportContent,
  ReportKpiPlan,
  ReportType,
  Role,
  TargetScope,
  TrainingSchedule,
  TrainingSession,
  User,
} from "@/lib/types";

type View = "dashboard" | "kpi" | "reports" | "insights" | "targets" | "deals" | "training" | "members" | "analysis";
type Drill = { scope: TargetScope; teamId?: string; userId?: string };
type FilterPeriodType = PeriodType | "all";
type SyncCollection = keyof Pick<
  AppData,
  | "users"
  | "teams"
  | "kpiItems"
  | "kpiTargets"
  | "kpiRecords"
  | "kpiRecordHistories"
  | "attendanceRecords"
  | "deals"
  | "trainingSchedules"
  | "reports"
  | "reportComments"
  | "notifications"
  | "announcements"
  | "qualitativeInsights"
  | "auditLogs"
>;
type AppDataChangesResponse = {
  revision: string;
  collections: Partial<Pick<AppData, SyncCollection>>;
  replaceCollections?: SyncCollection[];
  collectionRevisions?: Partial<Record<SyncCollection, string>>;
};
type AppDataPatch = {
  baseRevision: string;
  collections: Partial<Pick<AppData, SyncCollection>>;
  deletedIds: Partial<Record<SyncCollection, string[]>>;
};
type DealActionAlert = { id: string; dealId: string; status: "overdue" | "today" | "week"; message: string };
type GlobalSearchResult = {
  id: string;
  targetId: string;
  kind: "案件" | "日報" | "定性情報" | "操作履歴";
  title: string;
  summary: string;
  meta: string;
  view: View;
};
type AnalysisCategory = "manager" | "personal" | "deals";
type AnalysisBreakdownRow = {
  id: string;
  kind: string;
  date: string;
  owner: string;
  title: string;
  value: string;
  note?: string;
  source?: AnalysisSource;
};
type AnalysisBreakdown = {
  title: string;
  description: string;
  rows: AnalysisBreakdownRow[];
};
type AnalysisSource =
  | { type: "deal"; id: string }
  | { type: "report"; id: string }
  | { type: "kpi"; date: string; userId: string }
  | { type: "attendance"; date: string; userId: string }
  | { type: "report-date"; date: string };

const navItems: { id: View; label: string; shortLabel?: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "進捗", icon: Gauge },
  { id: "kpi", label: "KPI入力", icon: Edit3 },
  { id: "reports", label: "日報", icon: FileText },
  { id: "insights", label: "定性情報共有", shortLabel: "定性", icon: Lightbulb },
  { id: "targets", label: "目標", icon: Target },
  { id: "deals", label: "案件管理", shortLabel: "案件", icon: BriefcaseBusiness },
  { id: "training", label: "研修スケジュール", shortLabel: "研修", icon: GraduationCap },
  { id: "members", label: "設定", icon: Settings },
  { id: "analysis", label: "分析", icon: BarChart3 },
];

const periodLabels: Record<PeriodType, string> = { day: "日", week: "週", month: "月", half: "半期" };
const reportLabels: Record<ReportType, string> = { daily: "日報", weekly: "週報", monthly: "月報" };
const roleLabels: Record<Role, string> = { member: "メンバー", leader: "リーダー", manager: "上長", admin: "管理者" };
const dealStageLabels: Record<DealStage, string> = {
  ap: "AP",
  meeting: "商談",
  reclose: "再クロ",
  follow_up_later: "後返",
  contract_planned: "契約予定",
  contract: "契約",
  lost: "失注",
  appointment_cancelled: "アポキャン",
  completed: "完了",
};
const dealRankLabels: Record<DealRank, string> = {
  a: "A",
  b: "B",
  c: "C",
  contract_planned: "契約予定",
  contract: "契約",
  lost: "失注",
};
const insightCategories: QualitativeInsightCategory[] = ["customer_voice", "competitor", "service_issue", "market_need"];
const insightCategoryLabels: Record<QualitativeInsightCategory, string> = {
  customer_voice: "①顧客の声・要望",
  competitor: "②競合動向",
  service_issue: "③サービス不備・改善提案",
  market_need: "④新規市場ニーズの兆し",
};
const insightCategoryGuides: Record<QualitativeInsightCategory, { description: string; sourceLabel: string; detailPlaceholder: string }> = {
  customer_voice: {
    description: "商談・架電・研修などで聞いた、顧客の生の声や要望を共有します。",
    sourceLabel: "顧客名・案件名",
    detailPlaceholder: "誰が・どの場面で・何と言っていたか。背景や温度感もあわせて記入",
  },
  competitor: {
    description: "競合の提案内容・価格・新サービスや、顧客から聞いた比較コメントを共有します。",
    sourceLabel: "競合名・情報源",
    detailPlaceholder: "競合の動き、価格や提案内容、顧客の反応、自社への影響など",
  },
  service_issue: {
    description: "自社サービス・資料・運用で気づいた不備と、その改善案を共有します。",
    sourceLabel: "対象サービス・場面",
    detailPlaceholder: "何が起きたか、どこに不備があるか、どう改善するとよいか",
  },
  market_need: {
    description: "新しい業界・用途・課題など、今後の需要につながりそうな兆しを共有します。",
    sourceLabel: "業界・情報源",
    detailPlaceholder: "どの業界・どんな課題で、なぜニーズがありそうと感じたか",
  },
};
function insightSourceParts(source?: string) {
  return (source ?? "").split(" / ").map((part) => part.trim()).filter(Boolean);
}

function insightChipColor(text: string) {
  const index = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

type InsightInput = { category: QualitativeInsightCategory; date: string; title: string; detail: string; source: string };
const forecastRankOptions: DealRank[] = ["c", "b", "a", "contract_planned"];
const dealRankSortScore: Record<DealRank, number> = {
  contract: 5,
  contract_planned: 4,
  a: 3,
  b: 2,
  c: 1,
  lost: 0,
};
const dailyInputKpiIds = ["kpi-calls", "kpi-ap", "kpi-meetings", "kpi-reclose"];
const allDataKpiId = "__all-data";
const heatmapKpiIds = ["kpi-calls", "kpi-ap", "kpi-meetings", "kpi-reclose", "kpi-orders", "kpi-sales"];
const progressTrendKpiIds = ["kpi-calls", "kpi-ap", "kpi-meetings", "kpi-reclose", "kpi-orders", "kpi-sales"];
const palette = ["#2563eb", "#0f766e", "#f59e0b", "#db2777", "#7c3aed", "#0891b2"];
const funnelDefinitions = [
  { id: "kpi-calls", name: "架電数" },
  { id: "kpi-ap", name: "AP数" },
  { id: "kpi-meetings", name: "初回商談数" },
  { id: "kpi-reclose", name: "再クロ数" },
  { id: "kpi-orders", name: "契約数" },
];
const funnelShapeRows = [
  { points: "20,0 400,0 361,80 59,80", labelY: 45 },
  { points: "59,80 361,80 325,155 95,155", labelY: 123 },
  { points: "95,155 325,155 288,230 132,230", labelY: 198 },
  { points: "132,230 288,230 254,300 166,300", labelY: 270 },
  { points: "166,300 254,300 210,390", labelY: 334 },
];
const syncCollections: SyncCollection[] = [
  "users",
  "teams",
  "kpiItems",
  "kpiTargets",
  "kpiRecords",
  "kpiRecordHistories",
  "attendanceRecords",
  "deals",
  "trainingSchedules",
  "reports",
  "reportComments",
  "notifications",
  "announcements",
  "qualitativeInsights",
  "auditLogs",
];
const viewSyncCollections: Record<View, SyncCollection[]> = {
  dashboard: ["users", "teams", "kpiItems", "kpiTargets", "kpiRecords", "kpiRecordHistories", "attendanceRecords", "deals", "reports"],
  kpi: ["users", "teams", "kpiItems", "kpiTargets", "kpiRecords", "kpiRecordHistories", "attendanceRecords"],
  reports: ["users", "teams", "reports", "reportComments", "notifications"],
  insights: ["users", "teams", "qualitativeInsights", "auditLogs"],
  targets: ["users", "teams", "kpiItems", "kpiTargets", "auditLogs"],
  deals: ["users", "teams", "deals", "auditLogs"],
  training: ["users", "teams", "deals", "trainingSchedules", "auditLogs"],
  members: ["users", "teams", "auditLogs"],
  analysis: syncCollections,
};
const clientStorageKey = "ai-consulting-kpi-daily-app-data-v7";
const previousClientStorageKeys = ["ai-consulting-kpi-daily-app-data-v6", "ai-consulting-kpi-daily-app-data-v5"];
const sessionStorageKey = "ai-consulting-kpi-daily-app-session";
const sessionPasswordKey = "ai-consulting-kpi-daily-app-session-password";
const tabSyncChannelName = "ai-consulting-kpi-daily-app-tab-sync";
const tabSyncLeaderKeyPrefix = "ai-consulting-kpi-daily-app-sync-leader";
const tabPresenceStorageKey = "ai-consulting-kpi-daily-app-tab-presence";
const tabLeaderTtlMs = 12000;
const tabPresenceTtlMs = 15000;

type TabPresence = { userId: string; view: View; expiresAt: number };
type TabSnapshot = { data: AppData; revision: string; collectionRevisions: Record<SyncCollection, string> };
type TabSyncMessage =
  | { type: "changes"; senderTabId: string; userId: string; changes: AppDataChangesResponse }
  | { type: "snapshot-request"; senderTabId: string; userId: string }
  | {
      type: "snapshot";
      senderTabId: string;
      targetTabId: string;
      userId: string;
      data: AppData;
      revision: string;
      collectionRevisions: Record<SyncCollection, string>;
    };

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
}

function contributionPieLabel(props: PieLabelRenderProps, unit: string) {
  const cx = Number(props.cx);
  const cy = Number(props.cy);
  const midAngle = Number(props.midAngle);
  const outerRadius = Number(props.outerRadius);
  const value = Number(props.value);

  if (![cx, cy, midAngle, outerRadius, value].every(Number.isFinite)) return null;

  const radians = (-midAngle * Math.PI) / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(radians);
  const y = cy + radius * Math.sin(radians);

  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      fontSize={12}
      fontWeight={850}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {numberFormat(value)} {unit}
    </text>
  );
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function blankContent(): ReportContent {
  return { activity: "", result: "", issue: "", nextPlan: "", insight: "" };
}

function todayDateKey() {
  return toDateKey(new Date());
}

function clearClientCachedData() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(clientStorageKey);
    previousClientStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

function tabSyncSupported() {
  return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" && typeof window.localStorage !== "undefined";
}

function syncLeaderKey(userId: string) {
  return `${tabSyncLeaderKeyPrefix}:${userId}`;
}

function readJsonFromLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJsonToLocalStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readTabPresenceStore() {
  return readJsonFromLocalStorage<Record<string, TabPresence>>(tabPresenceStorageKey) ?? {};
}

function writeTabPresenceStore(store: Record<string, TabPresence>) {
  writeJsonToLocalStorage(tabPresenceStorageKey, store);
}

function refreshTabPresence(tabId: string, userId: string, view: View) {
  if (!tabSyncSupported() || !userId) return;
  const store = readTabPresenceStore();
  const now = Date.now();
  Object.entries(store).forEach(([entryTabId, presence]) => {
    if (presence.expiresAt <= now) delete store[entryTabId];
  });
  store[tabId] = { userId, view, expiresAt: now + tabPresenceTtlMs };
  writeTabPresenceStore(store);
}

function removeTabPresence(tabId: string) {
  if (!tabSyncSupported()) return;
  const store = readTabPresenceStore();
  if (!(tabId in store)) return;
  delete store[tabId];
  writeTabPresenceStore(store);
}

function activeSyncCollectionsFor(userId: string, fallbackView: View) {
  const collections = new Set<SyncCollection>(viewSyncCollections[fallbackView]);
  if (!tabSyncSupported() || !userId) return Array.from(collections);
  const store = readTabPresenceStore();
  const now = Date.now();
  let changed = false;
  Object.entries(store).forEach(([entryTabId, presence]) => {
    if (presence.expiresAt <= now) {
      delete store[entryTabId];
      changed = true;
      return;
    }
    if (presence.userId !== userId || !viewSyncCollections[presence.view]) return;
    viewSyncCollections[presence.view].forEach((collection) => collections.add(collection));
  });
  if (changed) writeTabPresenceStore(store);
  return Array.from(collections);
}

function releaseSyncLeadership(tabId: string, userId: string) {
  if (!tabSyncSupported() || !userId) return;
  const key = syncLeaderKey(userId);
  const leader = readJsonFromLocalStorage<{ tabId: string; userId: string; expiresAt: number }>(key);
  if (leader?.tabId !== tabId) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function claimSyncLeadership(tabId: string, userId: string) {
  if (!tabSyncSupported()) return true;
  if (!userId) return false;
  if (typeof document !== "undefined" && document.hidden) {
    releaseSyncLeadership(tabId, userId);
    return false;
  }
  const now = Date.now();
  const key = syncLeaderKey(userId);
  const currentLeader = readJsonFromLocalStorage<{ tabId: string; userId: string; expiresAt: number }>(key);
  if (!currentLeader || currentLeader.userId !== userId || currentLeader.tabId === tabId || currentLeader.expiresAt <= now) {
    return writeJsonToLocalStorage(key, { tabId, userId, expiresAt: now + tabLeaderTtlMs });
  }
  return false;
}

function hasChangedCollections(changes: AppDataChangesResponse) {
  return Object.keys(changes.collections ?? {}).length > 0;
}

function requestTabSnapshot(tabId: string, userId: string, signal?: AbortSignal) {
  if (!tabSyncSupported() || !userId) return Promise.resolve<TabSnapshot | null>(null);
  return new Promise<TabSnapshot | null>((resolve) => {
    const channel = new BroadcastChannel(tabSyncChannelName);
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
      channel.close();
    };
    const finish = (snapshot: TabSnapshot | null) => {
      cleanup();
      resolve(snapshot);
    };
    const abort = () => finish(null);
    const timeoutId = window.setTimeout(() => finish(null), 450);
    signal?.addEventListener("abort", abort, { once: true });
    channel.onmessage = (event) => {
      const message = event.data as TabSyncMessage | undefined;
      if (!message || message.type !== "snapshot" || message.targetTabId !== tabId || message.userId !== userId) return;
      finish({ data: message.data, revision: message.revision, collectionRevisions: message.collectionRevisions });
    };
    channel.postMessage({ type: "snapshot-request", senderTabId: tabId, userId } satisfies TabSyncMessage);
  });
}

type AppAuth = { userId: string; password: string };

function authHeaders(auth: AppAuth | null): Record<string, string> {
  if (!auth?.userId || !auth.password) return {};
  return {
    "x-app-user-id": auth.userId,
    "x-app-password": auth.password,
  };
}

async function fetchSharedAppData(signal?: AbortSignal, auth: AppAuth | null = null) {
  const response = await fetch("/api/app-data", {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", ...authHeaders(auth) },
    signal,
  });
  if (!response.ok) throw new Error("Failed to load shared app data.");
  return (await response.json()) as AppData;
}

async function fetchAppDataChanges(options: {
  signal?: AbortSignal;
  auth: AppAuth | null;
  revisions: Record<SyncCollection, string>;
  collections: SyncCollection[];
}) {
  const params = new URLSearchParams({ mode: "changes", since: "" });
  options.collections.forEach((collection) => {
    params.append("collection", collection);
    params.append(`${collection}Since`, options.revisions[collection] ?? "");
  });
  const response = await fetch("/api/app-data?" + params.toString(), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", ...authHeaders(options.auth) },
    signal: options.signal,
  });
  if (!response.ok) throw new Error("Failed to load app data changes.");
  return (await response.json()) as AppDataChangesResponse;
}

async function fetchNotificationChanges(options: { signal?: AbortSignal; auth: AppAuth | null; revisions: Record<SyncCollection, string> }) {
  const notificationCollections: SyncCollection[] = ["notifications", "announcements", "deals", "reports"];
  const params = new URLSearchParams({ mode: "notifications", since: "" });
  notificationCollections.forEach((collection) => params.append(`${collection}Since`, options.revisions[collection] ?? ""));
  const response = await fetch("/api/app-data?" + params.toString(), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", ...authHeaders(options.auth) },
    signal: options.signal,
  });
  if (!response.ok) throw new Error("Failed to load notification data.");
  return (await response.json()) as AppDataChangesResponse;
}

function readSessionUserId() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(sessionStorageKey) ?? "";
}

function readSessionPassword() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(sessionPasswordKey) ?? "";
}

function collectionTimestamp(collection: SyncCollection, item: { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }) {
  if (collection === "notifications") return item.resolvedAt ?? item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
  return item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
}

function collectionRevision(data: AppData, collection: SyncCollection) {
  if (collection === "users" || collection === "teams" || collection === "kpiItems") return "";
  return (data[collection] as { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }[]).reduce((latest, item) => {
    const timestamp = collectionTimestamp(collection, item);
    return timestamp > latest ? timestamp : latest;
  }, "");
}

function computeAppDataCollectionRevisions(data: AppData) {
  return Object.fromEntries(syncCollections.map((collection) => [collection, collectionRevision(data, collection)])) as Record<SyncCollection, string>;
}

function computeAppDataRevision(data: AppData) {
  return syncCollections
    .map((collection) => collectionRevision(data, collection))
    .reduce((latest, timestamp) => (timestamp > latest ? timestamp : latest), "");
}

function dateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function reportMissingNotificationDate(notification: AppNotification) {
  return notification.targetDate ?? notification.message.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function isReportMissingNotificationResolved(appData: AppData, notification: AppNotification) {
  if (notification.type !== "report_missing") return false;
  if (notification.resolvedAt) return true;
  const targetDate = reportMissingNotificationDate(notification);
  if (!targetDate) return false;
  return appData.reports.some(
    (report) => report.userId === notification.userId && report.reportType === "daily" && report.periodStart === targetDate,
  );
}

function weekOfMonth(dateKey: string) {
  return Math.max(1, Math.ceil(dateParts(dateKey).day / 7));
}

function reportPeriodLabel(report: Report) {
  const { year, month } = dateParts(report.periodStart);
  if (report.reportType === "monthly") return `${year}年${month}月 月報`;
  if (report.reportType === "weekly") return `${year}年${month}月 第${weekOfMonth(report.periodStart)}週`;
  return report.periodStart;
}

function mergeCollection<T extends { id: string }>(currentItems: T[], incomingItems: T[]) {
  if (incomingItems.length === 0) return currentItems;
  const incomingById = new Map(incomingItems.map((item) => [item.id, item]));
  const merged = currentItems.map((item) => incomingById.get(item.id) ?? item);
  incomingItems.forEach((item) => {
    if (!currentItems.some((currentItem) => currentItem.id === item.id)) merged.push(item);
  });
  return merged;
}

function mergeAppDataCollections(current: AppData, collections: Partial<Pick<AppData, SyncCollection>>, replaceCollections: SyncCollection[] = []) {
  const next: AppData = { ...current };
  const replaceSet = new Set(replaceCollections);
  syncCollections.forEach((collection) => {
    const incoming = collections[collection] as { id: string }[] | undefined;
    if (!incoming) return;
    const replaceWholeCollection = replaceSet.has(collection) || collection === "users" || collection === "teams" || collection === "kpiItems";
    (next[collection] as { id: string }[]) = replaceWholeCollection
      ? incoming
      : mergeCollection(next[collection] as { id: string }[], incoming);
  });
  return next;
}

function buildAppDataPatch(current: AppData, next: AppData, baseRevision: string): AppDataPatch {
  const patch: AppDataPatch = { baseRevision, collections: {}, deletedIds: {} };
  syncCollections.forEach((collection) => {
    const currentItems = current[collection] as { id: string }[];
    const nextItems = next[collection] as { id: string }[];
    if (JSON.stringify(currentItems) === JSON.stringify(nextItems)) return;
    const currentById = new Map(currentItems.map((item) => [item.id, item]));
    const nextById = new Map(nextItems.map((item) => [item.id, item]));
    const changedItems = nextItems.filter((item) => JSON.stringify(currentById.get(item.id)) !== JSON.stringify(item));
    const deletedIds = currentItems.filter((item) => !nextById.has(item.id)).map((item) => item.id);
    if (changedItems.length > 0) patch.collections[collection] = changedItems as never;
    if (deletedIds.length > 0) patch.deletedIds[collection] = deletedIds;
  });
  return patch;
}

function appDataPatchHasChanges(patch: AppDataPatch) {
  return Object.values(patch.collections).some((items) => (items?.length ?? 0) > 0) || Object.values(patch.deletedIds).some((ids) => (ids?.length ?? 0) > 0);
}

function reportExactPeriod(report: Report) {
  return report.periodStart === report.periodEnd ? report.periodStart : `${report.periodStart} - ${report.periodEnd}`;
}

type ReportSortKey = "updated_desc" | "period_desc" | "period_asc" | "member_asc" | "unread_first" | "comments_desc";

function sortedReports(
  reports: Report[],
  sortKey: ReportSortKey,
  users: User[],
  comments: ReportComment[],
  currentUserId: string,
) {
  return [...reports].sort((a, b) => {
    if (sortKey === "period_desc") return b.periodStart.localeCompare(a.periodStart) || b.updatedAt.localeCompare(a.updatedAt);
    if (sortKey === "period_asc") return a.periodStart.localeCompare(b.periodStart) || b.updatedAt.localeCompare(a.updatedAt);
    if (sortKey === "member_asc") {
      const aUser = users.find((user) => user.id === a.userId)?.name ?? "";
      const bUser = users.find((user) => user.id === b.userId)?.name ?? "";
      return aUser.localeCompare(bUser, "ja") || b.periodStart.localeCompare(a.periodStart);
    }
    if (sortKey === "unread_first") {
      const aRead = isReportRead(a, currentUserId) ? 1 : 0;
      const bRead = isReportRead(b, currentUserId) ? 1 : 0;
      return aRead - bRead || b.updatedAt.localeCompare(a.updatedAt);
    }
    if (sortKey === "comments_desc") {
      const aComments = comments.filter((comment) => comment.reportId === a.id).length;
      const bComments = comments.filter((comment) => comment.reportId === b.id).length;
      return bComments - aComments || b.updatedAt.localeCompare(a.updatedAt);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}年${monthNumber}月`;
}

function monthEndKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateKey(new Date(year, monthNumber, 0));
}

function monthOffset(fromMonth: string, toMonth: string) {
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNumber] = toMonth.split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonthNumber - fromMonthNumber;
}

function trainingMonthKeys(startDate: string, endDate: string) {
  if (!startDate || !endDate || startDate > endDate) return [];
  const startMonth = monthKey(startDate);
  const endMonth = monthKey(endDate);
  const count = Math.min(Math.max(monthOffset(startMonth, endMonth) + 1, 0), 120);
  const start = parseDateKey(startMonth + "-01");
  return Array.from({ length: count }, (_, index) => monthKey(toDateKey(addMonths(start, index))));
}

function trainingDateLabel(dateKey: string) {
  if (!dateKey) return "未設定";
  return parseDateKey(dateKey).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
}

function nextTrainingSessionNumber(sessions: TrainingSession[]) {
  return sessions.reduce((highest, session) => Math.max(highest, session.sessionNumber || 0), 0) + 1;
}

function monthOptions(dateKey: string) {
  const { year } = dateParts(dateKey);
  return [year - 1, year, year + 1].flatMap((optionYear) =>
    Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const value = `${optionYear}-${String(monthNumber).padStart(2, "0")}`;
      return { value, label: `${optionYear}年${monthNumber}月` };
    }),
  );
}

function weekdayIndexFromMonday(dateKey: string) {
  return (parseDateKey(dateKey).getDay() + 6) % 7;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function nextReportRange(reportType: ReportType, dateKey: string) {
  if (reportType === "daily") {
    const nextDate = toDateKey(addDays(parseDateKey(dateKey), 1));
    return { start: nextDate, end: nextDate, periodType: "day" as PeriodType };
  }
  if (reportType === "weekly") {
    const current = getReportRange("weekly", dateKey);
    return {
      start: toDateKey(addDays(parseDateKey(current.start), 7)),
      end: toDateKey(addDays(parseDateKey(current.end), 7)),
      periodType: "week" as PeriodType,
    };
  }
  return { ...getReportRange("monthly", toDateKey(addMonths(parseDateKey(dateKey), 1))), periodType: "month" as PeriodType };
}

function nextKpiTitle(reportType: ReportType) {
  if (reportType === "daily") return "翌日の個人目標KPI";
  if (reportType === "weekly") return "翌週の個人目標KPI";
  return "翌月の個人目標KPI";
}

function isReportRead(report: Report, userId: string) {
  return report.readByUserIds?.includes(userId) ?? false;
}

function visibleUsers(data: AppData, currentUser: User) {
  if (currentUser.role === "admin" || currentUser.role === "manager") return data.users;
  if (currentUser.role === "leader") return data.users.filter((user) => user.teamId === currentUser.teamId);
  return data.users.filter((user) => user.id === currentUser.id);
}

function usersForDrill(data: AppData, drill: Drill) {
  if (drill.scope === "member" && drill.userId) return data.users.filter((user) => user.id === drill.userId);
  if (drill.scope === "team" && drill.teamId) return data.users.filter((user) => user.teamId === drill.teamId);
  return data.users;
}

function sumRecords(records: KpiRecord[], userIds: string[], kpiItemId: string, start: string, end: string) {
  return records
    .filter((record) => userIds.includes(record.userId) && record.kpiItemId === kpiItemId && inRange(record.date, start, end))
    .reduce((sum, record) => sum + record.actualValue, 0);
}

function dealDate(deal: Deal) {
  return (deal.lastActionDate ?? deal.completedAt ?? deal.createdAt).slice(0, 10);
}

function nextActionDate(deal: Deal) {
  return deal.nextActionDate?.slice(0, 10) ?? "";
}

function dealRank(deal: Deal): DealRank {
  if (deal.rank) return deal.rank;
  if (deal.stage === "contract_planned" || deal.stage === "contract" || deal.stage === "lost") return deal.stage;
  return "a";
}

function achievementColor(achievement: number) {
  if (achievement <= 50) return "#dc2626";
  if (achievement <= 99) return "#f59e0b";
  return "#2563eb";
}

function confirmDelete(label = "この項目") {
  if (typeof window === "undefined") return false;
  return window.confirm(label + "を削除します。本当に削除しますか？");
}

function countDeals(deals: Deal[], userIds: string[], stage: DealStage, start: string, end: string) {
  return deals.filter((deal) => userIds.includes(deal.userId) && deal.stage === stage && inRange(dealDate(deal), start, end)).length;
}

function sumDealAmounts(deals: Deal[], userIds: string[], stage: DealStage, start: string, end: string) {
  return deals
    .filter((deal) => userIds.includes(deal.userId) && deal.stage === stage && inRange(dealDate(deal), start, end))
    .reduce((sum, deal) => sum + deal.amount, 0);
}

function attendanceStats(records: AttendanceRecord[], userIds: string[], start: string, end: string) {
  const scoped = records.filter((record) => userIds.includes(record.userId) && inRange(record.date, start, end));
  const checked = scoped.length;
  const attended = scoped.filter((record) => record.attended).length;
  return { checked, attended, rate: checked > 0 ? Math.round((attended / checked) * 100) : 0 };
}

function actualForKpi(data: AppData, userIds: string[], kpiItemId: string, start: string, end: string) {
  if (kpiItemId === "kpi-orders") return countDeals(data.deals, userIds, "contract", start, end);
  if (kpiItemId === "kpi-sales") return sumDealAmounts(data.deals, userIds, "contract", start, end);
  if (kpiItemId === "kpi-utilization") return attendanceStats(data.attendanceRecords, userIds, start, end).rate;
  return sumRecords(data.kpiRecords, userIds, kpiItemId, start, end);
}

function kpiFunnelValues(data: AppData, userIds: string[], start: string, end: string) {
  return funnelDefinitions.map((definition, index) => {
    const item = data.kpiItems.find((kpi) => kpi.id === definition.id);
    const actual = actualForKpi(data, userIds, definition.id, start, end);
    const previous = index > 0 ? actualForKpi(data, userIds, funnelDefinitions[index - 1].id, start, end) : 0;
    return {
      id: definition.id,
      name: item?.name ?? definition.name,
      unit: item?.unit ?? "件",
      actual,
      conversion: index === 0 ? null : previous > 0 ? Math.round((actual / previous) * 100) : 0,
    };
  });
}

function targetFor(data: AppData, drill: Drill, kpiItemId: string, periodType: PeriodType, start: string, end: string) {
  const candidates = data.kpiTargets.filter(
    (target) =>
      target.kpiItemId === kpiItemId &&
      target.periodType === periodType &&
      target.periodStart === start &&
      target.periodEnd === end,
  );
  const exact =
    drill.scope === "member"
      ? candidates.find((target) => target.scope === "member" && target.userId === drill.userId)
      : drill.scope === "team"
        ? candidates.find((target) => target.scope === "team" && target.teamId === drill.teamId)
        : candidates.find((target) => target.scope === "division");
  if (exact && exact.targetValue > 0) return exact.targetValue;
  if (drill.scope === "team" || drill.scope === "division") {
    const memberIds =
      drill.scope === "team"
        ? data.users.filter((user) => user.teamId === drill.teamId).map((user) => user.id)
        : data.users.map((user) => user.id);
    const memberTotal = candidates
      .filter((target) => target.scope === "member" && target.userId && memberIds.includes(target.userId))
      .reduce((sum, target) => sum + target.targetValue, 0);
    if (memberTotal > 0) return memberTotal;
  }
  if (exact) return exact.targetValue;
  if (drill.scope === "member" && drill.userId) {
    const user = data.users.find((item) => item.id === drill.userId);
    const teamTarget = candidates.find((target) => target.scope === "team" && target.teamId === user?.teamId);
    if (teamTarget && teamTarget.targetValue > 0) return teamTarget.targetValue;
  }
  if (drill.scope === "team") {
    const divisionTarget = candidates.find((target) => target.scope === "division");
    if (divisionTarget && divisionTarget.targetValue > 0) return divisionTarget.targetValue;
  }
  return 0;
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function StatCard({
  label,
  value,
  sub,
  rate,
  valueRate,
  targetLabel,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  rate?: number | null;
  valueRate?: number | null;
  targetLabel?: string | null;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  const valueToneRate = valueRate ?? rate;
  const valueClassName =
    valueToneRate === undefined || valueToneRate === null
      ? undefined
      : valueToneRate >= 100
        ? "metric-value-achieved"
        : "metric-value-behind";
  return (
    <Tag className={onClick ? "metric metric-button" : "metric"} type={onClick ? "button" : undefined} onClick={onClick}>
      <span>{label}</span>
      <div className="metric-value-row">
        <strong className={valueClassName}>{value}</strong>
        {targetLabel ? <em>{targetLabel}</em> : null}
      </div>
      <small>{sub}</small>
      {rate !== undefined && rate !== null && (
        <em className="metric-rate">達成率 {numberFormat(rate)}%</em>
      )}
    </Tag>
  );
}

function ProgressGoalCard({
  label,
  actual,
  target,
  unit,
  rate,
  color,
  onClick,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
  rate: number;
  color: string;
  onClick?: () => void;
}) {
  const barRate = Math.min(Math.max(rate, 0), 100);
  const content = (
    <>
      <span>{label}（実績 / 目標）</span>
      <strong style={{ color }}>
        {numberFormat(actual)} <em>{unit}</em>
      </strong>
      <div className="progress-goal-bar">
        <i style={{ width: barRate + "%", background: color }} />
      </div>
      <div className="progress-goal-meta">
        <small>達成率</small>
        <b style={{ color }}>{numberFormat(rate)}%</b>
      </div>
      <p>目標 {numberFormat(target)} {unit}</p>
    </>
  );

  if (onClick) {
    return (
      <button className="progress-goal-card progress-goal-button" type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="progress-goal-card">{content}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function MeasuredChart({ children }: { children: (size: { width: number; height: number }) => ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 280 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="chart-box" ref={ref}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}

function FoldablePanel({
  title,
  description,
  open,
  onToggle,
  icon,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ElementType;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <section className={open ? "panel foldable-panel open" : "panel foldable-panel"}>
      <button className="foldable-toggle" type="button" onClick={onToggle}>
        <span>
          <Icon size={18} />
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        <ChevronDown size={18} />
      </button>
      {open && <div className="foldable-body">{children}</div>}
    </section>
  );
}

export function AppShell() {
  const [tabId] = useState(() => id("tab"));
  const tabIdRef = useRef(tabId);
  const [data, setData] = useState<AppData>(seedData);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const dataRef = useRef<AppData>(seedData);
  const dataRevisionRef = useRef(computeAppDataRevision(seedData));
  const collectionRevisionsRef = useRef(computeAppDataCollectionRevisions(seedData));
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const currentUserIdRef = useRef("");
  const loadingRef = useRef(true);
  const applyServerChangesRef = useRef<(changes: AppDataChangesResponse, options?: { broadcast?: boolean }) => void>(() => undefined);
  const [view, setView] = useState<View>("dashboard");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saveError, setSaveError] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [dealPeriodType, setDealPeriodType] = useState<FilterPeriodType>("month");
  const [activeDate, setActiveDate] = useState(() => todayDateKey());
  const [activeKpiId, setActiveKpiId] = useState("kpi-sales");
  const [drill, setDrill] = useState<Drill>({ scope: "team", teamId: "team-saiteki-ai" });
  const [search, setSearch] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dealStageFocus, setDealStageFocus] = useState<DealStage | "all">("all");
  const [dealForecastFocus, setDealForecastFocus] = useState<{ ranks: DealRank[]; includeContract: boolean } | null>(null);
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null);
  const [focusedReportId, setFocusedReportId] = useState<string | null>(null);
  const [focusedAuditId, setFocusedAuditId] = useState<string | null>(null);
  const [focusedInsightId, setFocusedInsightId] = useState<string | null>(null);
  const [focusedKpiUserId, setFocusedKpiUserId] = useState<string | null>(null);
  const [dealFocusKey, setDealFocusKey] = useState(0);
  const [dealActionFocusKey, setDealActionFocusKey] = useState(0);

  const currentUser = data.users.find((user) => user.id === currentUserId);
  const activeKpi =
    data.kpiItems.find((item) => item.id === activeKpiId) ??
    data.kpiItems.find((item) => item.id === "kpi-sales") ??
    data.kpiItems[0];
  const showAllData = activeKpiId === allDataKpiId;
  const period = getPeriodRange(periodType, activeDate);
  const accessibleUsers = currentUser ? visibleUsers(data, currentUser) : [];
  const globalSearchQueryText = globalSearchQuery.trim().toLowerCase();
  const canSearchAllAuditLogs = currentUser ? ["admin", "manager", "leader"].includes(currentUser.role) : false;
  const globalSearchResults: GlobalSearchResult[] =
    currentUser && globalSearchQueryText
      ? [
          ...data.deals
            .filter((deal) => {
              const user = data.users.find((item) => item.id === deal.userId);
              const text = [
                deal.title,
                deal.description ?? "",
                dealStageLabels[deal.stage],
                dealRankLabels[dealRank(deal)],
                user?.name ?? "",
                dealDate(deal),
                nextActionDate(deal),
                deal.amount,
              ].join(" ");
              return text.toLowerCase().includes(globalSearchQueryText);
            })
            .slice(0, 12)
            .map((deal) => {
              const user = data.users.find((item) => item.id === deal.userId);
              return {
                id: "deal-" + deal.id,
                targetId: deal.id,
                kind: "案件" as const,
                title: deal.title,
                summary: deal.description || dealStageLabels[deal.stage] + " / " + numberFormat(deal.amount) + "万円",
                meta: (user?.name ?? "未設定") + " / " + dealDate(deal) + " / " + dealStageLabels[deal.stage],
                view: "deals" as const,
              };
            }),
          ...data.reports
            .filter((report) => {
              const user = data.users.find((item) => item.id === report.userId);
              const text = [
                user?.name ?? "",
                report.reportType,
                report.periodStart,
                report.periodEnd,
                report.content.activity,
                report.content.result,
                report.content.issue,
                report.content.nextPlan,
                report.content.insight,
              ].join(" ");
              return text.toLowerCase().includes(globalSearchQueryText);
            })
            .slice(0, 12)
            .map((report) => {
              const user = data.users.find((item) => item.id === report.userId);
              return {
                id: "report-" + report.id,
                targetId: report.id,
                kind: "日報" as const,
                title: (user?.name ?? "未設定") + "の日報",
                summary: report.content.result || report.content.activity || "本文未入力",
                meta: report.periodStart + " - " + report.periodEnd,
                view: "reports" as const,
              };
            }),
          ...data.qualitativeInsights
            .filter((insight) => {
              const user = data.users.find((item) => item.id === insight.userId);
              const text = [insightCategoryLabels[insight.category], insight.title, insight.detail, insight.source ?? "", user?.name ?? "", insight.date].join(" ");
              return text.toLowerCase().includes(globalSearchQueryText);
            })
            .slice(0, 12)
            .map((insight) => {
              const user = data.users.find((item) => item.id === insight.userId);
              return {
                id: "insight-" + insight.id,
                targetId: insight.id,
                kind: "定性情報" as const,
                title: insight.title,
                summary: insight.detail,
                meta: insightCategoryLabels[insight.category] + " / " + (user?.name ?? "未設定") + " / " + insight.date,
                view: "insights" as const,
              };
            }),
          ...data.auditLogs
            .filter((log) => canSearchAllAuditLogs || log.actorId === currentUser.id || log.targetId === currentUser.id)
            .filter((log) => {
              const actor = data.users.find((user) => user.id === log.actorId);
              const text = [log.action, log.summary, log.targetType, actor?.name ?? "", log.createdAt].join(" ");
              return text.toLowerCase().includes(globalSearchQueryText);
            })
            .slice(0, 12)
            .map((log) => {
              const actor = data.users.find((user) => user.id === log.actorId);
              return {
                id: "audit-" + log.id,
                targetId: log.id,
                kind: "操作履歴" as const,
                title: log.action,
                summary: log.summary,
                meta: (actor?.name ?? "不明なユーザー") + " / " + new Date(log.createdAt).toLocaleString("ja-JP"),
                view: "members" as const,
              };
            }),
        ].slice(0, 30)
      : [];

  function broadcastTabChanges(changes: AppDataChangesResponse) {
    if (!tabSyncSupported() || !currentUserIdRef.current || !hasChangedCollections(changes)) return;
    syncChannelRef.current?.postMessage({
      type: "changes",
      senderTabId: tabIdRef.current,
      userId: currentUserIdRef.current,
      changes,
    } satisfies TabSyncMessage);
  }

  function broadcastTabSnapshot(targetTabId: string) {
    if (!tabSyncSupported() || !currentUserIdRef.current) return;
    syncChannelRef.current?.postMessage({
      type: "snapshot",
      senderTabId: tabIdRef.current,
      targetTabId,
      userId: currentUserIdRef.current,
      data: dataRef.current,
      revision: dataRevisionRef.current,
      collectionRevisions: collectionRevisionsRef.current,
    } satisfies TabSyncMessage);
  }

  function applyServerData(
    nextData: AppData,
    meta?: { revision?: string; collectionRevisions?: Partial<Record<SyncCollection, string>> },
  ) {
    nextData = { ...nextData, qualitativeInsights: nextData.qualitativeInsights ?? [] };
    dataRef.current = nextData;
    dataRevisionRef.current = meta?.revision ?? computeAppDataRevision(nextData);
    collectionRevisionsRef.current = { ...computeAppDataCollectionRevisions(nextData), ...(meta?.collectionRevisions ?? {}) };
    setData(nextData);
  }

  function applyServerChanges(changes: AppDataChangesResponse, options: { broadcast?: boolean } = {}) {
    dataRevisionRef.current = changes.revision || dataRevisionRef.current;
    setData((currentData) => {
      const nextData = mergeAppDataCollections(currentData, changes.collections, changes.replaceCollections ?? []);
      const computedRevisions = computeAppDataCollectionRevisions(nextData);
      const nextRevisions = { ...collectionRevisionsRef.current };
      (Object.keys(changes.collections) as SyncCollection[]).forEach((collection) => {
        nextRevisions[collection] = computedRevisions[collection];
      });
      collectionRevisionsRef.current = { ...nextRevisions, ...(changes.collectionRevisions ?? {}) };
      dataRef.current = nextData;
      return nextData;
    });
    if (options.broadcast) broadcastTabChanges(changes);
  }

  useEffect(() => {
    applyServerChangesRef.current = applyServerChanges;
  });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!tabSyncSupported()) return;
    const channel = new BroadcastChannel(tabSyncChannelName);
    syncChannelRef.current = channel;
    channel.onmessage = (event) => {
      const message = event.data as TabSyncMessage | undefined;
      if (!message || message.senderTabId === tabIdRef.current) return;
      if (!message.userId || message.userId !== currentUserIdRef.current) return;
      if (message.type === "changes") {
        if (!loadingRef.current) applyServerChangesRef.current(message.changes);
        return;
      }
      if (message.type === "snapshot-request") {
        if (!loadingRef.current) broadcastTabSnapshot(message.senderTabId);
        return;
      }
      if (message.type === "snapshot" && message.targetTabId === tabIdRef.current) {
        applyServerData(message.data, { revision: message.revision, collectionRevisions: message.collectionRevisions });
        setLoading(false);
      }
    };
    return () => {
      if (syncChannelRef.current === channel) syncChannelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    if (loading || !currentUserId || !tabSyncSupported()) return;
    const tabId = tabIdRef.current;
    const updatePresence = () => {
      if (document.hidden) {
        releaseSyncLeadership(tabId, currentUserId);
        removeTabPresence(tabId);
        return;
      }
      refreshTabPresence(tabId, currentUserId, view);
    };
    updatePresence();
    const intervalId = window.setInterval(updatePresence, 4000);
    window.addEventListener("visibilitychange", updatePresence);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", updatePresence);
      removeTabPresence(tabId);
    };
  }, [loading, currentUserId, view]);

  useEffect(() => {
    if (!tabSyncSupported()) return;
    const release = () => {
      const userId = currentUserIdRef.current;
      releaseSyncLeadership(tabIdRef.current, userId);
      removeTabPresence(tabIdRef.current);
    };
    window.addEventListener("pagehide", release);
    window.addEventListener("beforeunload", release);
    return () => {
      window.removeEventListener("pagehide", release);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const sessionUserId = readSessionUserId();
    const sessionPassword = readSessionPassword();
    clearClientCachedData();
    if (!sessionUserId || !sessionPassword) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
      return () => {
        controller.abort();
      };
    }
    requestTabSnapshot(tabIdRef.current, sessionUserId, controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return null;
        if (snapshot) {
          applyServerData(snapshot.data, { revision: snapshot.revision, collectionRevisions: snapshot.collectionRevisions });
          return null;
        }
        return fetchSharedAppData(controller.signal, { userId: sessionUserId, password: sessionPassword });
      })
      .then((nextData: AppData | null) => {
        if (controller.signal.aborted) return;
        if (nextData) applyServerData(nextData);
        setCurrentUserId(sessionUserId);
        setCurrentPassword(sessionPassword);
      })
      .catch(() => {
        applyServerData(seedData);
        window.sessionStorage.removeItem(sessionStorageKey);
        window.sessionStorage.removeItem(sessionPasswordKey);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (loading || !currentUserId || !currentPassword) return;
    let cancelled = false;
    const syncVisibleView = () => {
      if (syncingRef.current || document.hidden) return;
      if (!claimSyncLeadership(tabIdRef.current, currentUserId)) return;
      fetchAppDataChanges({
        auth: { userId: currentUserId, password: currentPassword },
        revisions: collectionRevisionsRef.current,
        collections: activeSyncCollectionsFor(currentUserId, view),
      })
        .then((changes) => {
          if (!cancelled) applyServerChangesRef.current(changes, { broadcast: true });
        })
        .catch(() => undefined);
    };
    syncVisibleView();
    const intervalId = window.setInterval(syncVisibleView, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loading, currentUserId, currentPassword, view]);

  useEffect(() => {
    if (loading || !currentUserId || !currentPassword) return;
    let cancelled = false;
    const syncNotifications = () => {
      if (syncingRef.current || document.hidden) return;
      if (!claimSyncLeadership(tabIdRef.current, currentUserId)) return;
      fetchNotificationChanges({ auth: { userId: currentUserId, password: currentPassword }, revisions: collectionRevisionsRef.current })
        .then((changes) => {
          if (!cancelled) applyServerChangesRef.current(changes, { broadcast: true });
        })
        .catch(() => undefined);
    };
    syncNotifications();
    const intervalId = window.setInterval(syncNotifications, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loading, currentUserId, currentPassword]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  async function persist(nextData: AppData, currentData: AppData = data) {
    const auth = { userId: currentUserId, password: currentPassword };
    if (!auth.userId || !auth.password) {
      setSaveError("保存できませんでした。ログインしてから再試行してください。");
      return;
    }
    const baseRevision = dataRevisionRef.current;
    const patch = buildAppDataPatch(currentData, nextData, baseRevision);
    if (!appDataPatchHasChanges(patch)) {
      dataRef.current = nextData;
      setData(nextData);
      return;
    }
    syncingRef.current = true;
    dataRef.current = nextData;
    setData(nextData);
    setSyncing(true);
    setSaveError("");
    try {
      const response = await fetch("/api/app-data", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json; charset=utf-8", "x-app-data-revision": baseRevision, ...authHeaders(auth) },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "Failed to persist app data.");
      }
      applyServerChanges((await response.json()) as AppDataChangesResponse, { broadcast: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setSaveError(message ? "保存できませんでした。" + message : "保存できませんでした。通信状況を確認して、再試行してください。");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  function auditLog(action: string, targetType: AuditLog["targetType"], summary: string, options?: { targetId?: string; before?: string; after?: string; baseLogs?: AuditLog[] }) {
    if (!currentUser) return options?.baseLogs ?? data.auditLogs ?? [];
    return [
      {
        id: id("audit"),
        actorId: currentUser.id,
        action,
        targetType,
        targetId: options?.targetId,
        summary,
        before: options?.before,
        after: options?.after,
        createdAt: new Date().toISOString(),
      },
      ...(options?.baseLogs ?? data.auditLogs ?? []),
    ].slice(0, 500);
  }

  function withAudit(nextData: AppData, action: string, targetType: AuditLog["targetType"], summary: string, options?: { targetId?: string; before?: string; after?: string }) {
    return { ...nextData, auditLogs: auditLog(action, targetType, summary, { ...options, baseLogs: nextData.auditLogs }) };
  }

  function resolveSubmittedReportNotifications(notifications: AppNotification[], userId: string, reportType: ReportType, periodStart: string, now: string) {
    if (reportType !== "daily") return notifications;
    return notifications.map((notification) => {
      if (notification.type !== "report_missing" || notification.userId !== userId) return notification;
      if (reportMissingNotificationDate(notification) !== periodStart) return notification;
      return { ...notification, read: true, targetDate: periodStart, resolvedAt: notification.resolvedAt ?? now };
    });
  }

  async function login(email: string, password: string) {
    const cleanedPassword = password.trim();
    const response = await fetch("/api/login", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ email, password: cleanedPassword }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { userId: string; data: AppData };
    applyServerData(result.data);
    setCurrentUserId(result.userId);
    setCurrentPassword(cleanedPassword);
    setSaveError("");
    window.sessionStorage.setItem(sessionStorageKey, result.userId);
    window.sessionStorage.setItem(sessionPasswordKey, cleanedPassword);
    return true;
  }

  function logout() {
    releaseSyncLeadership(tabIdRef.current, currentUserId);
    removeTabPresence(tabIdRef.current);
    setCurrentUserId("");
    setCurrentPassword("");
    window.sessionStorage.removeItem(sessionStorageKey);
    window.sessionStorage.removeItem(sessionPasswordKey);
  }

  function openNoticePanel() {
    if (!currentUser) return;
    setNoticeOpen(true);
  }

  function markNotificationRead(notificationId: string) {
    if (!currentUser) return;
    const target = data.notifications.find((notice) => notice.id === notificationId && notice.userId === currentUser.id);
    if (!target || target.read) return;
    persist({ ...data, notifications: data.notifications.map((notice) => (notice.id === notificationId ? { ...notice, read: true } : notice)) });
  }

  function addAnnouncement(message: string, attachments: AnnouncementAttachment[], important = false) {
    if (!currentUser || (!message.trim() && attachments.length === 0)) return;
    const now = new Date().toISOString();
    persist({
      ...data,
      announcements: [
        {
          id: id("announcement"),
          authorId: currentUser.id,
          message: message.trim(),
          important,
          attachments,
          readByUserIds: [currentUser.id],
          createdAt: now,
          updatedAt: now,
        },
        ...data.announcements,
      ],
    });
  }

  function updateAnnouncement(announcementId: string, message: string, attachments: AnnouncementAttachment[], important = false) {
    if (!currentUser || (!message.trim() && attachments.length === 0)) return;
    const target = data.announcements.find((announcement) => announcement.id === announcementId);
    if (!target || (currentUser.role !== "admin" && target.authorId !== currentUser.id)) return;
    const now = new Date().toISOString();
    persist({
      ...data,
      announcements: data.announcements.map((announcement) =>
        announcement.id === announcementId ? { ...announcement, message: message.trim(), important, attachments, updatedAt: now } : announcement,
      ),
    });
  }

  function deleteAnnouncement(announcementId: string) {
    if (!currentUser) return;
    const target = data.announcements.find((announcement) => announcement.id === announcementId);
    if (!target || (currentUser.role !== "admin" && target.authorId !== currentUser.id)) return;
    if (!confirmDelete("謚慕ｨｿ")) return;
    persist({ ...data, announcements: data.announcements.filter((announcement) => announcement.id !== announcementId) });
  }

  function saveInsight(input: InsightInput, insightId?: string) {
    if (!currentUser || !input.title.trim() || !input.detail.trim()) return;
    const now = new Date().toISOString();
    const fields = { category: input.category, date: input.date, title: input.title.trim(), detail: input.detail.trim(), source: input.source.trim() };
    if (!insightId) {
      persist({
        ...data,
        qualitativeInsights: [{ id: id("insight"), userId: currentUser.id, ...fields, createdAt: now, updatedAt: now }, ...data.qualitativeInsights],
      });
      return;
    }
    const target = data.qualitativeInsights.find((insight) => insight.id === insightId);
    if (!target || (currentUser.role !== "admin" && target.userId !== currentUser.id)) return;
    persist({
      ...data,
      qualitativeInsights: data.qualitativeInsights.map((insight) => (insight.id === insightId ? { ...insight, ...fields, updatedAt: now } : insight)),
    });
  }

  function deleteInsight(insightId: string) {
    if (!currentUser) return;
    const target = data.qualitativeInsights.find((insight) => insight.id === insightId);
    if (!target || (currentUser.role !== "admin" && target.userId !== currentUser.id)) return;
    if (!confirmDelete("「" + target.title + "」")) return;
    persist(
      withAudit(
        { ...data, qualitativeInsights: data.qualitativeInsights.filter((insight) => insight.id !== insightId) },
        "定性情報削除",
        "insight",
        insightCategoryLabels[target.category] + "「" + target.title + "」を削除",
        { targetId: insightId, before: target.detail },
      ),
    );
  }

  function markAnnouncementRead(announcementId: string) {
    if (!currentUser) return;
    const target = data.announcements.find((announcement) => announcement.id === announcementId);
    if (!target || target.readByUserIds.includes(currentUser.id)) return;
    persist({
      ...data,
      announcements: data.announcements.map((announcement) =>
        announcement.id === announcementId
          ? { ...announcement, readByUserIds: Array.from(new Set([...announcement.readByUserIds, currentUser.id])) }
          : announcement,
      ),
    });
  }

  const drillUsers = usersForDrill(data, drill);
  const drillUserIds = drillUsers.map((user) => user.id);
  const kpiActual = activeKpi ? actualForKpi(data, drillUserIds, activeKpi.id, period.start, period.end) : 0;
  const kpiTarget = activeKpi ? targetFor(data, drill, activeKpi.id, periodType, period.start, period.end) : 0;
  const achievement = kpiTarget > 0 ? Math.round((kpiActual / kpiTarget) * 100) : 0;
  const attendance = attendanceStats(data.attendanceRecords, drillUserIds, period.start, period.end);
  const announcementUnreadCount = currentUser ? data.announcements.filter((notice) => !notice.readByUserIds.includes(currentUser.id)).length : 0;
  const dealActionAlertUserIds = currentUser
    ? currentUser.role === "admin"
      ? data.users.map((user) => user.id)
      : [currentUser.id]
    : [];
  const dealActionAlerts: DealActionAlert[] = currentUser
    ? data.deals
        .filter((deal) => dealActionAlertUserIds.includes(deal.userId))
        .filter((deal) => !["contract", "lost", "completed"].includes(deal.stage))
        .map((deal) => {
          const actionDate = nextActionDate(deal);
          if (!actionDate) return null;
          const today = todayDateKey();
          const week = getPeriodRange("week", today);
          const status: DealActionAlert["status"] | null = actionDate < today ? "overdue" : actionDate === today ? "today" : actionDate <= week.end ? "week" : null;
          if (!status) return null;
          const user = data.users.find((item) => item.id === deal.userId);
          const label = status === "overdue" ? "期限切れ" : status === "today" ? "今日対応" : "今週対応";
          return { id: "deal-action-" + deal.id, dealId: deal.id, status, message: label + ": " + deal.title + "（" + (user?.name ?? "未設定") + " / " + actionDate + "）" };
        })
        .filter((item): item is DealActionAlert => Boolean(item))
    : [];
  const unreadCount = currentUser
    ? data.notifications.filter((notice) => notice.userId === currentUser.id && !notice.read && !isReportMissingNotificationResolved(data, notice)).length + announcementUnreadCount + dealActionAlerts.length
    : 0;
  function openDealsFromProgress(stage: DealStage | "all") {
    setDealStageFocus(stage);
    setDealForecastFocus(null);
    setFocusedDealId(null);
    setDealActionFocusKey(0);
    setDealFocusKey((value) => value + 1);
    setDealPeriodType(periodType);
    setView("deals");
  }

  function openForecastDeals(ranks: DealRank[], includeContract: boolean) {
    setDealStageFocus("all");
    setDealForecastFocus({ ranks, includeContract });
    setFocusedDealId(null);
    setDealActionFocusKey(0);
    setDealFocusKey((value) => value + 1);
    setDealPeriodType(periodType);
    setView("deals");
  }

  function openDealActionList() {
    setDealStageFocus("all");
    setDealForecastFocus(null);
    setFocusedDealId(null);
    setDealActionFocusKey((value) => value + 1);
    setDealPeriodType("all");
    setView("deals");
    setNoticeOpen(false);
  }

  function openGlobalSearchResult(result: GlobalSearchResult) {
    if (result.view === "deals") {
      setDealStageFocus("all");
      setDealForecastFocus(null);
      setDealActionFocusKey(0);
      setFocusedDealId(result.targetId);
      setDealFocusKey((value) => value + 1);
      setDealPeriodType("all");
    }
    if (result.view === "reports") setFocusedReportId(result.targetId);
    if (result.view === "members") setFocusedAuditId(result.targetId);
    if (result.view === "insights") setFocusedInsightId(result.targetId);
    setView(result.view);
    setGlobalSearchOpen(false);
  }

  function openDealsDefault() {
    setDealStageFocus("all");
    setDealForecastFocus(null);
    setFocusedDealId(null);
    setDealActionFocusKey(0);
    setDealFocusKey((value) => value + 1);
    setDealPeriodType("month");
    setView("deals");
  }

  function openAnalysisSource(source: AnalysisSource) {
    if (source.type === "deal") {
      setDealStageFocus("all");
      setDealForecastFocus(null);
      setDealActionFocusKey(0);
      setFocusedDealId(source.id);
      setDealFocusKey((value) => value + 1);
      setDealPeriodType("all");
      setView("deals");
      return;
    }
    if (source.type === "report") {
      setFocusedReportId(source.id);
      setView("reports");
      return;
    }
    if (source.type === "report-date") {
      setActiveDate(source.date);
      setFocusedReportId(null);
      setView("reports");
      return;
    }
    setActiveDate(source.date);
    setFocusedKpiUserId(source.userId);
    setView("kpi");
  }

  function notifyMissingReportUser(userId: string, date: string) {
    if (!currentUser) return;
    const user = data.users.find((item) => item.id === userId);
    const now = new Date().toISOString();
    persist(
      withAudit(
        {
          ...data,
          notifications: [
            {
              id: id("notice"),
              userId,
              type: "report_missing",
              message: date + " の日報が未提出です。提出をお願いします。",
              read: false,
              targetDate: date,
              createdAt: now,
            },
            ...data.notifications,
          ],
        },
        "日報催促",
        "report",
        "日報未提出の催促を送信（" + (user?.name ?? userId) + " / " + date + "）",
        { targetId: userId },
      ),
    );
  }

  function updateRecord(userId: string, kpiItemId: string, value: number, date = activeDate) {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const existing = data.kpiRecords.find((record) => record.userId === userId && record.kpiItemId === kpiItemId && record.date === date);
    let histories = data.kpiRecordHistories;
    const nextRecords = existing
      ? data.kpiRecords.map((record) => {
          if (record.id !== existing.id) return record;
          if (record.actualValue !== value) {
            histories = [
              { id: id("history"), recordId: existing.id, previousValue: existing.actualValue, nextValue: value, changedAt: now, changedBy: currentUser.id },
              ...histories,
            ];
          }
          return { ...record, actualValue: value, updatedAt: now };
        })
      : [...data.kpiRecords, { id: id("record"), userId, kpiItemId, date, actualValue: value, createdAt: now, updatedAt: now }];
    persist(withAudit({ ...data, kpiRecords: nextRecords, kpiRecordHistories: histories }, "KPI更新", "kpi", (data.users.find((user) => user.id === userId)?.name ?? "未設定") + "の" + (data.kpiItems.find((item) => item.id === kpiItemId)?.name ?? "KPI") + "を" + value + "に更新"));
  }

  function setAttendance(userId: string, date: string, attended: boolean) {
    const now = new Date().toISOString();
    const existing = data.attendanceRecords.find((record) => record.userId === userId && record.date === date);
    const nextRecords = existing
      ? data.attendanceRecords.map((record) => (record.id === existing.id ? { ...record, attended, updatedAt: now } : record))
      : [...data.attendanceRecords, { id: id("attendance"), userId, date, attended, updatedAt: now }];
    persist(withAudit({ ...data, attendanceRecords: nextRecords }, "出勤更新", "kpi", (data.users.find((user) => user.id === userId)?.name ?? "未設定") + "の出勤を" + (attended ? "出勤" : "未出勤") + "に更新"));
  }

  function saveDeal(form: FormData) {
    const title = String(form.get("title") || "").trim();
    const userId = String(form.get("userId") || currentUser?.id || "");
    if (!title || !userId) return;
    const now = new Date().toISOString();
    const stage = form.get("stage") as DealStage;
    const rank = form.get("rank") as DealRank;
    const lastActionDate = String(form.get("lastActionDate") || activeDate);
    const nextDate = String(form.get("nextActionDate") || "");
    const deal: Deal = {
      id: id("deal"),
      userId,
      title,
      description: String(form.get("description") || "").trim(),
      stage,
      rank,
      amount: Number(form.get("amount") || 0),
      createdAt: lastActionDate,
      lastActionDate,
      nextActionDate: nextDate || undefined,
      completedAt: stage === "completed" ? lastActionDate : undefined,
      updatedAt: now,
    };
    persist(withAudit({ ...data, deals: [deal, ...data.deals] }, "案件登録", "deal", "案件「" + deal.title + "」を登録", { targetId: deal.id }));
  }

  function updateDeal(dealId: string, patch: Partial<Deal>) {
    const now = new Date().toISOString();
    const currentDeal = data.deals.find((deal) => deal.id === dealId);
    const summaryParts = [];
    if (currentDeal && patch.amount !== undefined && patch.amount !== currentDeal.amount) summaryParts.push("金額 " + currentDeal.amount + "→" + patch.amount + "万円");
    if (currentDeal && patch.stage !== undefined && patch.stage !== currentDeal.stage) summaryParts.push("状態 " + dealStageLabels[currentDeal.stage] + "→" + dealStageLabels[patch.stage]);
    if (currentDeal && patch.userId !== undefined && patch.userId !== currentDeal.userId) summaryParts.push("担当変更");
    if (currentDeal && patch.title !== undefined && patch.title !== currentDeal.title) summaryParts.push("案件名変更");
    persist(withAudit({
      ...data,
      deals: data.deals.map((deal) => {
        if (deal.id !== dealId) return deal;
        const nextStage = patch.stage ?? deal.stage;
        const completedAt = nextStage === "completed" ? patch.completedAt ?? deal.completedAt ?? activeDate : undefined;
        return { ...deal, ...patch, lastActionDate: patch.lastActionDate ?? deal.lastActionDate ?? dealDate(deal), completedAt, updatedAt: now };
      }),
    }, "案件更新", "deal", "案件「" + (currentDeal?.title ?? dealId) + "」を更新" + (summaryParts.length ? "（" + summaryParts.join(" / ") + "）" : ""), {
      targetId: dealId,
      before: currentDeal ? JSON.stringify(currentDeal) : undefined,
      after: JSON.stringify(patch),
    }));
  }

  function saveTrainingSchedule(dealId: string, periodStart: string, periodEnd: string, sessions: TrainingSession[]) {
    const deal = data.deals.find((item) => item.id === dealId);
    if (!deal || !periodStart || !periodEnd || periodStart > periodEnd) return;
    const now = new Date().toISOString();
    const currentSchedule = data.trainingSchedules.find((schedule) => schedule.dealId === dealId);
    const nextSchedule: TrainingSchedule = {
      id: currentSchedule?.id ?? id("training"),
      dealId,
      periodStart,
      periodEnd,
      sessions: [...sessions].sort(
        (left, right) =>
          left.startDate.localeCompare(right.startDate) ||
          left.sessionNumber - right.sessionNumber ||
          left.title.localeCompare(right.title, "ja"),
      ),
      createdAt: currentSchedule?.createdAt ?? now,
      updatedAt: now,
    };
    const trainingSchedules = currentSchedule
      ? data.trainingSchedules.map((schedule) => (schedule.id === currentSchedule.id ? nextSchedule : schedule))
      : [nextSchedule, ...data.trainingSchedules];
    persist(withAudit(
      { ...data, trainingSchedules },
      currentSchedule ? "研修スケジュール更新" : "研修スケジュール登録",
      "training",
      "案件「" + deal.title + "」の研修スケジュールを保存",
      {
        targetId: nextSchedule.id,
        before: currentSchedule ? JSON.stringify(currentSchedule) : undefined,
        after: JSON.stringify(nextSchedule),
      },
    ));
  }

  function deleteTrainingSchedule(dealId: string) {
    const currentSchedule = data.trainingSchedules.find((schedule) => schedule.dealId === dealId);
    const deal = data.deals.find((item) => item.id === dealId);
    if (!currentSchedule || !deal) return;
    persist(withAudit(
      { ...data, trainingSchedules: data.trainingSchedules.filter((schedule) => schedule.id !== currentSchedule.id) },
      "研修スケジュール削除",
      "training",
      "案件「" + deal.title + "」の研修スケジュールを削除",
      {
        targetId: currentSchedule.id,
        before: JSON.stringify(currentSchedule),
      },
    ));
  }

  function upsertTarget(form: FormData) {
    const now = new Date().toISOString();
    const scope = form.get("scope") as TargetScope;
    const type = form.get("periodType") as PeriodType;
    const date = String(form.get("date"));
    const range = getPeriodRange(type, date);
    const teamId = String(form.get("teamId") || "");
    const userId = String(form.get("userId") || "");
    const nextTargets = data.kpiItems
      .filter((item) => form.has("targetValue-" + item.id))
      .map((item) => {
        const existing = data.kpiTargets.find(
          (target) =>
            target.scope === scope &&
            target.kpiItemId === item.id &&
            target.periodType === type &&
            target.periodStart === range.start &&
            target.periodEnd === range.end &&
            (scope !== "team" || target.teamId === teamId) &&
            (scope !== "member" || target.userId === userId),
        );
        return {
          id: existing?.id ?? id("target"),
          scope,
          teamId: scope === "team" ? teamId : undefined,
          userId: scope === "member" ? userId : undefined,
          kpiItemId: item.id,
          periodType: type,
          periodStart: range.start,
          periodEnd: range.end,
          targetValue: Number(form.get("targetValue-" + item.id) || 0),
          updatedAt: now,
        } satisfies KpiTarget;
      });
    const nextKeys = new Set(nextTargets.map((target) => [target.scope, target.teamId ?? "", target.userId ?? "", target.kpiItemId, target.periodType, target.periodStart].join("-")));
    persist(withAudit({
      ...data,
      kpiTargets: [
        ...nextTargets,
        ...data.kpiTargets.filter(
          (target) => !nextKeys.has([target.scope, target.teamId ?? "", target.userId ?? "", target.kpiItemId, target.periodType, target.periodStart].join("-")),
        ),
      ],
    }, "目標更新", "target", periodLabels[type] + "次目標を" + nextTargets.length + "項目保存（" + range.start + " - " + range.end + "）"));
  }

  function currentTargetFor(
    kpiItemId: string,
    scope: TargetScope,
    type: PeriodType,
    range: { start: string; end: string },
    owner: { teamId?: string; userId?: string } = {},
  ) {
    return data.kpiTargets.find(
      (target) =>
        target.scope === scope &&
        target.kpiItemId === kpiItemId &&
        target.periodType === type &&
        target.periodStart === range.start &&
        target.periodEnd === range.end &&
        (scope !== "team" || target.teamId === owner.teamId) &&
        (scope !== "member" || target.userId === owner.userId),
    );
  }

  function reportTargetUpdates(
    userId: string,
    reportType: ReportType,
    periodStart: string,
    nextKpis: ReportKpiPlan[],
    updatedAt: string,
    sourceData: AppData = data,
  ) {
    const nextRange = nextReportRange(reportType, periodStart);
    return nextKpis.map((plan) => {
      const existingTarget = sourceData.kpiTargets.find(
        (target) =>
          target.scope === "member" &&
          target.userId === userId &&
          target.kpiItemId === plan.kpiItemId &&
          target.periodType === nextRange.periodType &&
          target.periodStart === nextRange.start &&
          target.periodEnd === nextRange.end,
      );
      return {
        id: existingTarget?.id ?? id("target"),
        scope: "member" as const,
        userId,
        kpiItemId: plan.kpiItemId,
        periodType: nextRange.periodType,
        periodStart: nextRange.start,
        periodEnd: nextRange.end,
        targetValue: plan.targetValue,
        updatedAt,
      };
    });
  }

  function mergeReportTargets(reportTargets: KpiTarget[], sourceData: AppData = data) {
    const targetKeys = new Set(reportTargets.map((target) => [target.userId, target.kpiItemId, target.periodType, target.periodStart].join("-")));
    return [
      ...reportTargets,
      ...sourceData.kpiTargets.filter(
        (target) => !targetKeys.has([target.userId ?? "", target.kpiItemId, target.periodType, target.periodStart].join("-")),
      ),
    ];
  }

  async function generateReportAiFeedback(
    reportType: ReportType,
    content: ReportContent,
    nextKpis: ReportKpiPlan[],
    reportUserId: string,
    periodStart: string,
  ): Promise<ReportAiFeedback> {
    const sourceData = dataRef.current;
    const reportRange = getReportRange(reportType, periodStart);
    const reportPeriodType: PeriodType = reportType === "daily" ? "day" : reportType === "weekly" ? "week" : "month";
    const input = {
      reportType,
      content,
      nextKpis,
      kpiItems: sourceData.kpiItems.map((item) => ({ id: item.id, name: item.name, unit: item.unit })),
      periodKpis: sourceData.kpiItems
        .filter((item) => item.active)
        .map((item) => ({
          kpiItemId: item.id,
          name: item.name,
          unit: item.unit,
          actualValue: actualForKpi(sourceData, [reportUserId], item.id, reportRange.start, reportRange.end),
          targetValue: targetFor(
            sourceData,
            { scope: "member", userId: reportUserId },
            item.id,
            reportPeriodType,
            reportRange.start,
            reportRange.end,
          ),
        })),
    };
    try {
      const response = await fetch("/api/report-feedback", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...authHeaders({ userId: currentUserId, password: currentPassword }),
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("AI feedback request failed.");
      const feedback = normalizeReportFeedback((await response.json()) as Partial<ReportAiFeedback>);
      if (feedback) return feedback;
    } catch {
      // Report submission must remain available if the AI provider is temporarily unavailable.
    }
    return buildCriteriaReportFeedback(input);
  }

  async function saveReport(reportType: ReportType, content: ReportContent, nextKpis: ReportKpiPlan[]) {
    if (!currentUser) return;
    const range = getReportRange(reportType, activeDate);
    const aiFeedback = await generateReportAiFeedback(reportType, content, nextKpis, currentUser.id, range.start);
    const latestData = dataRef.current;
    const now = new Date().toISOString();
    const existing = latestData.reports.find(
      (report) => report.userId === currentUser.id && report.reportType === reportType && report.periodStart === range.start,
    );
    const report: Report = {
      id: existing?.id ?? id("report"),
      userId: currentUser.id,
      reportType,
      periodStart: range.start,
      periodEnd: range.end,
      content,
      nextKpis,
      aiFeedback,
      readByUserIds: Array.from(new Set([...(existing?.readByUserIds ?? []), currentUser.id])),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const reportTargets = reportTargetUpdates(currentUser.id, reportType, range.start, nextKpis, now, latestData);
    await persist(withAudit({
      ...latestData,
      reports: existing ? latestData.reports.map((item) => (item.id === existing.id ? report : item)) : [report, ...latestData.reports],
      kpiTargets: mergeReportTargets(reportTargets, latestData),
      notifications: resolveSubmittedReportNotifications(latestData.notifications, currentUser.id, reportType, range.start, now),
    }, existing ? "日報更新" : "日報提出", "report", reportLabels[reportType] + "を" + (existing ? "更新" : "提出") + "・AIフィードバック生成（" + range.start + " - " + range.end + "）", { targetId: report.id }), latestData);
  }

  async function updateReport(reportId: string, content: ReportContent, nextKpis: ReportKpiPlan[]) {
    if (!currentUser) return;
    const existingReport = dataRef.current.reports.find((item) => item.id === reportId);
    if (!existingReport) return;
    const aiFeedback = await generateReportAiFeedback(
      existingReport.reportType,
      content,
      nextKpis,
      existingReport.userId,
      existingReport.periodStart,
    );
    const latestData = dataRef.current;
    const report = latestData.reports.find((item) => item.id === reportId);
    if (!report) return;
    const now = new Date().toISOString();
    const nextReport: Report = {
      ...report,
      content,
      nextKpis,
      aiFeedback,
      readByUserIds: Array.from(new Set([...(report.readByUserIds ?? []), currentUser.id])),
      updatedAt: now,
    };
    const reportTargets = reportTargetUpdates(report.userId, report.reportType, report.periodStart, nextKpis, now, latestData);
    await persist(withAudit({
      ...latestData,
      reports: latestData.reports.map((item) => (item.id === reportId ? nextReport : item)),
      kpiTargets: mergeReportTargets(reportTargets, latestData),
    }, "日報更新", "report", reportLabels[report.reportType] + "を更新・AIフィードバック再生成（" + report.periodStart + " - " + report.periodEnd + "）", { targetId: report.id }), latestData);
  }

  function addComment(reportId: string, comment: string) {
    if (!currentUser || !comment.trim()) return;
    const report = data.reports.find((item) => item.id === reportId);
    if (!report) return;
    const now = new Date().toISOString();
    persist(withAudit({
      ...data,
      reportComments: [{ id: id("comment"), reportId, commenterId: currentUser.id, comment, createdAt: now }, ...data.reportComments],
      notifications: [
        { id: id("notice"), userId: report.userId, type: "comment_received", message: "日報に上長コメントが届いています。", read: false, createdAt: now },
        ...data.notifications,
      ],
    }, "コメント追加", "report", "日報にコメントを追加", { targetId: reportId }));
  }

  function deleteComment(commentId: string) {
    if (!currentUser || !["admin", "manager", "leader"].includes(currentUser.role)) return;
    const comment = data.reportComments.find((item) => item.id === commentId);
    if (!comment) return;
    persist(withAudit({
      ...data,
      reportComments: data.reportComments.filter((item) => item.id !== commentId),
    }, "コメント削除", "report", "日報の管理コメントを削除", { targetId: comment.reportId }));
  }

  function markReportRead(reportId: string, userId: string) {
    const report = data.reports.find((item) => item.id === reportId);
    if (!report || isReportRead(report, userId)) return;
    persist({
      ...data,
      reports: data.reports.map((item) =>
        item.id === reportId ? { ...item, readByUserIds: Array.from(new Set([...(item.readByUserIds ?? []), userId])) } : item,
      ),
    });
  }

  function addTeam(form: FormData) {
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const team = { id: id("team"), name, color: palette[data.teams.length % palette.length] };
    persist(withAudit({ ...data, teams: [...data.teams, team] }, "チーム追加", "team", "チーム「" + name + "」を追加", { targetId: team.id }));
  }

  function addUser(form: FormData) {
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "").trim();
    if (!name || !email || !password) return;
    const role = form.get("role") as Role;
    const user = { id: id("user"), name, email, password, role, teamId: String(form.get("teamId") || ""), position: roleLabels[role] };
    persist(withAudit({
      ...data,
      users: [
        ...data.users,
        user,
      ],
    }, "メンバー追加", "member", "メンバー「" + name + "」を追加", { targetId: user.id }));
  }

  function exportCsv(kind: "kpi" | "reports") {
    const rows =
      kind === "kpi"
        ? [
            ["date", "user", "team", "kind", "name", "value", "unit"],
            ...data.kpiRecords.map((record) => {
              const user = data.users.find((item) => item.id === record.userId);
              const team = data.teams.find((item) => item.id === user?.teamId);
              const kpi = data.kpiItems.find((item) => item.id === record.kpiItemId);
              return [record.date, user?.name ?? "", team?.name ?? "", "KPI", kpi?.name ?? "", record.actualValue, kpi?.unit ?? ""];
            }),
            ...data.attendanceRecords.map((record) => {
              const user = data.users.find((item) => item.id === record.userId);
              const team = data.teams.find((item) => item.id === user?.teamId);
              return [record.date, user?.name ?? "", team?.name ?? "", "出勤", "出勤チェック", record.attended ? "○" : "×", ""];
            }),
            ...data.deals.map((deal) => {
              const user = data.users.find((item) => item.id === deal.userId);
              const team = data.teams.find((item) => item.id === user?.teamId);
              return [dealDate(deal), user?.name ?? "", team?.name ?? "", "案件", deal.title, dealRankLabels[dealRank(deal)] + " / " + dealStageLabels[deal.stage], deal.amount + "万円"];
            }),
          ]
        : [
            ["type", "period_start", "period_end", "user", "activity", "result", "issue", "next_plan", "insight"],
            ...data.reports.map((report) => {
              const user = data.users.find((item) => item.id === report.userId);
              return [
                reportLabels[report.reportType],
                report.periodStart,
                report.periodEnd,
                user?.name ?? "",
                report.content.activity,
                report.content.result,
                report.content.issue,
                report.content.nextPlan,
                report.content.insight,
              ];
            }),
          ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = kind === "kpi" ? "kpi-analysis.csv" : "reports.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJsonBackup() {
    const backup = { ...data, exportedAt: new Date().toISOString(), exportedBy: currentUser?.id ?? "" };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-kpi-backup-" + todayDateKey() + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    persist(withAudit(data, "バックアップ出力", "backup", "JSONバックアップを出力"));
  }

  function importJsonBackup(parsed: Partial<AppData> & { exportedAt?: string; exportedBy?: string }) {
    if (!currentUser || currentUser.role !== "admin") return;
    const restored: AppData = {
      users: parsed.users ?? data.users,
      teams: parsed.teams ?? data.teams,
      kpiItems: parsed.kpiItems ?? data.kpiItems,
      kpiTargets: parsed.kpiTargets ?? [],
      kpiRecords: parsed.kpiRecords ?? [],
      kpiRecordHistories: parsed.kpiRecordHistories ?? [],
      attendanceRecords: parsed.attendanceRecords ?? [],
      deals: parsed.deals ?? [],
      trainingSchedules: parsed.trainingSchedules ?? [],
      reports: parsed.reports ?? [],
      reportComments: parsed.reportComments ?? [],
      notifications: parsed.notifications ?? [],
      announcements: parsed.announcements ?? [],
      qualitativeInsights: parsed.qualitativeInsights ?? [],
      auditLogs: parsed.auditLogs ?? [],
    };
    persist(withAudit(restored, "バックアップ復元", "backup", "JSONバックアップを復元" + (parsed.exportedAt ? "（" + parsed.exportedAt + "）" : "")));
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Gauge size={34} />
        <p>AIコンサル事業部のデータを読み込み中</p>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>KPI Daily</strong>
            <span>AIコンサル事業部</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => (item.id === "deals" ? openDealsDefault() : setView(item.id))}>
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-account" aria-label="ログイン中のアカウント">
          <span>ログイン中</span>
          <strong>{currentUser.name}</strong>
          <em>{currentUser.email}</em>
          <small>{roleLabels[currentUser.role]}</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI Consulting Division</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="top-actions">
          <label className="global-search-box">
            <Search size={17} />
            <input
              value={globalSearchQuery}
              onChange={(event) => {
                setGlobalSearchQuery(event.target.value);
                setGlobalSearchOpen(true);
              }}
                onFocus={() => setGlobalSearchOpen(true)}
                placeholder="案件・日報・定性情報・履歴を検索"
              />
            </label>
            <div className="login-select mobile-account" aria-label="ログイン中のアカウント">
              <strong>{currentUser.name} / {roleLabels[currentUser.role]}</strong>
              <span>{currentUser.email}</span>
            </div>
            <button className="icon-button" title="お知らせ" onClick={openNoticePanel}>
              <Bell size={18} />
              {unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
            <button className="icon-button" title="ヘルプ" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={18} />
            </button>
            <button className="icon-button" title="ログアウト" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="mobile-quick-actions" aria-label="よく使う操作">
          <button type="button" className={view === "kpi" ? "active" : ""} onClick={() => setView("kpi")}><Edit3 size={16} />KPI入力</button>
          <button type="button" className={view === "deals" ? "active" : ""} onClick={openDealsDefault}><BriefcaseBusiness size={16} />案件</button>
          <button type="button" className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}><FileText size={16} />日報</button>
          <button type="button" onClick={openNoticePanel}><Bell size={16} />お知らせ</button>
        </section>

        <main className="content">
          {view !== "training" && view !== "insights" && (
            <Filters
              activeDate={activeDate}
              setActiveDate={setActiveDate}
              periodType={view === "deals" ? dealPeriodType : periodType}
              setPeriodType={(value) => {
                if (view === "deals") {
                  setDealPeriodType(value);
                  return;
                }
                if (value !== "all") setPeriodType(value);
              }}
              activeKpiId={activeKpiId}
              setActiveKpiId={setActiveKpiId}
              kpiItems={data.kpiItems.filter((item) => item.active)}
              showAllDataOption={view === "dashboard"}
              showKpi={view === "dashboard"}
              showPeriod={view !== "reports" && view !== "analysis" && view !== "members"}
              showAllPeriodOption={view === "deals"}
              dashboardScope={
                view === "dashboard"
                  ? {
                      data,
                      drill,
                      setDrill,
                      period,
                    }
                  : undefined
              }
            />
          )}

          {view === "dashboard" && (
            <DashboardView
              data={data}
              activeKpi={activeKpi}
              activeDate={activeDate}
              periodType={periodType}
              period={period}
              drill={drill}
              actual={kpiActual}
              target={kpiTarget}
              achievement={achievement}
              attendance={attendance}
              showAllData={showAllData}
              openDealsFromProgress={openDealsFromProgress}
              openForecastDeals={openForecastDeals}
            />
          )}

          {view === "kpi" && (
            <KpiInputViewCompact
              key={activeDate + "-" + (focusedKpiUserId ?? "default")}
              data={data}
              users={accessibleUsers}
              activeDate={activeDate}
              focusUserId={focusedKpiUserId}
              updateRecord={updateRecord}
              setAttendance={setAttendance}
            />
          )}

          {view === "reports" && (
            <ReportsViewCompact
              key={focusedReportId ?? "reports"}
              data={data}
              currentUser={currentUser}
              activeDate={activeDate}
              kpiItems={data.kpiItems.filter((item) => item.active)}
              saveReport={saveReport}
              updateReport={updateReport}
              addComment={addComment}
              deleteComment={deleteComment}
              markReportRead={markReportRead}
              accessibleUsers={data.users}
              focusReportId={focusedReportId}
              notifyMissingReportUser={notifyMissingReportUser}
              canNotifyMissingReports={Boolean(currentUser && ["admin", "manager", "leader"].includes(currentUser.role))}
            />
          )}

          {view === "insights" && (
            <InsightsView
              key={focusedInsightId ?? "insights"}
              data={data}
              currentUser={currentUser}
              saveInsight={saveInsight}
              deleteInsight={deleteInsight}
              focusInsightId={focusedInsightId}
            />
          )}

          {view === "targets" && (
            <TargetsView data={data} upsertTarget={upsertTarget} currentTargetFor={currentTargetFor} activeDate={activeDate} exportCsv={exportCsv} />
          )}

          {view === "deals" && (
            <DealManagementSection
              key={String(dealFocusKey) + "-" + String(dealActionFocusKey) + "-" + (focusedDealId ?? "none")}
              data={data}
              users={data.users}
              activeDate={activeDate}
              periodType={dealPeriodType}
              saveDeal={saveDeal}
              updateDeal={updateDeal}
              focusStage={dealStageFocus}
              forecastFocus={dealForecastFocus}
              initialDetailDealId={focusedDealId}
              focusKey={dealFocusKey}
              actionFocusKey={dealActionFocusKey}
            />
          )}

          {view === "training" && (
            <TrainingScheduleView
              data={data}
              saveSchedule={saveTrainingSchedule}
              deleteSchedule={deleteTrainingSchedule}
            />
          )}

          {view === "members" && (
            <MembersView
              key={focusedAuditId ?? "members"}
              data={data}
              persist={persist}
              addTeam={addTeam}
              addUser={addUser}
              currentUser={currentUser}
              onCurrentPasswordChange={(password) => {
                setCurrentPassword(password);
                window.sessionStorage.setItem(sessionPasswordKey, password);
              }}
              exportJsonBackup={exportJsonBackup}
              importJsonBackup={importJsonBackup}
              focusAuditId={focusedAuditId}
            />
          )}

          {view === "analysis" && <AnalysisView data={data} activeDate={activeDate} search={search} setSearch={setSearch} exportCsv={exportCsv} histories={data.kpiRecordHistories} openSource={openAnalysisSource} />}
        </main>
      </div>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => (item.id === "deals" ? openDealsDefault() : setView(item.id))}>
            <item.icon size={20} />
            <span>{item.shortLabel ?? item.label}</span>
          </button>
        ))}
      </nav>

      {noticeOpen && (
        <AnnouncementsDrawer
          data={data}
          currentUser={currentUser}
          close={() => setNoticeOpen(false)}
          addAnnouncement={addAnnouncement}
          updateAnnouncement={updateAnnouncement}
          deleteAnnouncement={deleteAnnouncement}
          markAnnouncementRead={markAnnouncementRead}
          markNotificationRead={markNotificationRead}
          dealActionAlerts={dealActionAlerts}
          openDealActionList={openDealActionList}
        />
      )}

      {globalSearchOpen && (
        <GlobalSearchPanel
          query={globalSearchQuery}
          setQuery={setGlobalSearchQuery}
          results={globalSearchResults}
          close={() => setGlobalSearchOpen(false)}
          openResult={openGlobalSearchResult}
        />
      )}

      {helpOpen && <HelpDrawer view={view} close={() => setHelpOpen(false)} />}

      {saveError && <div className="sync-toast error-toast">{saveError}</div>}
      {syncing && !saveError && <div className="sync-toast">保存中...</div>}
    </div>
  );
}

const helpText: Record<View, { title: string; items: string[] }> = {
  dashboard: {
    title: "進捗の見方",
    items: ["表示範囲で事業部・チーム・個人を切り替えます。", "全データでは主要KPIと案件ベースの数字をまとめて確認できます。", "売上や契約数カードから該当案件一覧へ移動できます。"],
  },
  kpi: {
    title: "KPI入力の使い方",
    items: ["今日の入力を開き、対象メンバーと日付を確認して入力します。", "出勤チェックとKPI実績は保存後に全員へ反映されます。", "同じ日付・同じ項目は再入力すると更新されます。"],
  },
  reports: {
    title: "日報の使い方",
    items: ["日報・週報・月報を書くを開いて提出します。", "提出すると、具体性、目標との差分、顧客反応、案件確度、次のアクション、組織への展開価値をもとにAIフィードバックが自動生成されます。", "提出一覧から過去の日報を確認・検索できます。", "コメントが入るとベル通知に表示されます。"],
  },
  insights: {
    title: "定性情報共有の使い方",
    items: ["①顧客の声・要望、②競合動向、③サービス不備・改善提案、④新規市場ニーズの兆しのタブを切り替えて確認します。", "「定性情報を入力する」を開き、区分・日付・件名・内容を入れて共有します。", "共有した内容は全メンバーが閲覧できます。修正・削除は投稿者本人と管理者のみ可能です。"],
  },
  targets: {
    title: "目標設定の使い方",
    items: ["階層・期間・対象日を選ぶと現在反映中の目標が表示されます。", "入力欄を変更して保存すると、その期間の全KPI目標が更新されます。", "チームや事業部の目標は、手入力がない場合はメンバー目標の合計を反映します。"],
  },
  deals: {
    title: "案件管理の使い方",
    items: ["案件登録を開いて新規案件を追加します。", "案件一覧では検索・ソート・日付期間で絞り込めます。", "案件をクリックすると詳細と編集欄が表示されます。"],
  },
  training: {
    title: "研修スケジュールの使い方",
    items: ["全案件一覧では、契約済み案件だけをチーム・メンバーごとに確認できます。", "一覧の案件を選択すると、同じ画面の研修表が選択中の1案件に切り替わります。", "各案件詳細では研修内容の編集や個別削除に加え、誤登録したスケジュール全体も確認後に削除できます。"],
  },
  members: {
    title: "設定の使い方",
    items: ["管理者はメンバー・チーム・バックアップ・操作履歴を確認できます。", "メンバー権限では自分のメールアドレスとパスワードのみ変更できます。", "バックアップはJSONで出力し、管理者だけが復元できます。"],
  },
  analysis: {
    title: "分析の使い方",
    items: ["期間・表示範囲・KPIを切り替えて実績と目標を比較します。", "目標差分分析で、あと何件・あと何万円必要かを確認できます。", "メンバー別貢献度で売上・契約・AP・架電のランキングを確認できます。"],
  },
};

function HelpDrawer({ view, close }: { view: View; close: () => void }) {
  const help = helpText[view];
  return (
    <div className="notice-layer" role="dialog" aria-modal="true" aria-label="ヘルプ">
      <button className="notice-backdrop" type="button" aria-label="ヘルプを閉じる" onClick={close} />
      <aside className="help-drawer">
        <header className="notice-drawer-head">
          <div>
            <span><HelpCircle size={17} />ヘルプ</span>
            <strong>{help.title}</strong>
          </div>
          <button className="icon-button" type="button" title="閉じる" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="help-body">
          {help.items.map((item) => (
            <article key={item}>
              <Check size={16} />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

function GlobalSearchPanel({
  query,
  setQuery,
  results,
  close,
  openResult,
}: {
  query: string;
  setQuery: (query: string) => void;
  results: GlobalSearchResult[];
  close: () => void;
  openResult: (result: GlobalSearchResult) => void;
}) {
  const groupedResults = (["案件", "日報", "定性情報", "操作履歴"] as GlobalSearchResult["kind"][]).map((kind) => ({
    kind,
    items: results.filter((result) => result.kind === kind),
  }));
  return (
    <div className="global-search-layer" role="dialog" aria-modal="true" aria-label="横断検索">
      <button className="global-search-backdrop" type="button" aria-label="検索を閉じる" onClick={close} />
      <section className="global-search-panel">
        <div className="global-search-head">
          <div>
            <span><Search size={16} />横断検索</span>
            <strong>{query.trim() ? "「" + query.trim() + "」の検索結果" : "検索キーワードを入力"}</strong>
          </div>
          <button className="icon-button" type="button" title="閉じる" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="global-search-body">
          <label className="global-search-modal-input">
            <Search size={18} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="案件名・日報本文・操作履歴を検索"
            />
          </label>
          {!query.trim() ? (
            <EmptyState text="案件名・日報本文・操作履歴の内容で検索できます。" />
          ) : results.length === 0 ? (
            <EmptyState text="一致する情報はありません。" />
          ) : (
            groupedResults.map(({ kind, items }) => (
              items.length > 0 && (
                <section className="global-search-group" key={kind}>
                  <h3>{kind}<span>{items.length}件</span></h3>
                  <div>
                    {items.map((result) => (
                      <button key={result.id} type="button" onClick={() => openResult(result)}>
                        <em>{result.kind}</em>
                        <strong>{result.title}</strong>
                        <p>{result.summary}</p>
                        <span>{result.meta}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function fileToAnnouncementAttachment(file: File): Promise<AnnouncementAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const createdAt = new Date().toISOString();
    reader.onload = () =>
      resolve({
        id: id("attachment"),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl: String(reader.result ?? ""),
        createdAt,
      });
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

async function filesToAnnouncementAttachments(files: File[]) {
  return Promise.all(files.map((file) => fileToAnnouncementAttachment(file)));
}

function AnnouncementAttachmentPreview({ attachment }: { attachment: AnnouncementAttachment }) {
  const isPdf = attachment.mimeType === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <div className="notice-attachment">
      <div>
        <FileText size={16} />
        <strong>{attachment.name}</strong>
      </div>
      {isPdf && <iframe src={attachment.dataUrl} title={attachment.name} />}
      {isImage && <object data={attachment.dataUrl} type={attachment.mimeType} aria-label={attachment.name} />}
      {!isPdf && !isImage && (
        <a href={attachment.dataUrl} download={attachment.name}>
          資料を開く
        </a>
      )}
    </div>
  );
}

function isImportantAnnouncement(announcement: Announcement) {
  return Boolean(announcement.important);
}

function isGuideAnnouncement(announcement: Announcement) {
  return /使い方|指南書|ガイド|操作方法|マニュアル/.test(announcement.message);
}

function AnnouncementsDrawer(props: {
  data: AppData;
  currentUser: User;
  close: () => void;
  addAnnouncement: (message: string, attachments: AnnouncementAttachment[], important?: boolean) => void;
  updateAnnouncement: (announcementId: string, message: string, attachments: AnnouncementAttachment[], important?: boolean) => void;
  deleteAnnouncement: (announcementId: string) => void;
  markAnnouncementRead: (announcementId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  dealActionAlerts: DealActionAlert[];
  openDealActionList: () => void;
}) {
  const [message, setMessage] = useState("");
  const [important, setImportant] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editImportant, setEditImportant] = useState(false);
  const [editAttachments, setEditAttachments] = useState<AnnouncementAttachment[]>([]);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [expandedAnnouncementIds, setExpandedAnnouncementIds] = useState<string[]>([]);
  const [announcementFilter, setAnnouncementFilter] = useState<"all" | "unread" | "important" | "guide">("all");
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "report" | "comment" | "action">("all");
  const sortedAnnouncements = [...props.data.announcements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const unreadAnnouncements = sortedAnnouncements.filter((announcement) => !announcement.readByUserIds.includes(props.currentUser.id));
  const importantAnnouncements = sortedAnnouncements.filter((announcement) => isImportantAnnouncement(announcement));
  const guideAnnouncements = sortedAnnouncements.filter((announcement) => isGuideAnnouncement(announcement));
  const filteredAnnouncements = sortedAnnouncements.filter((announcement) => {
    if (announcementFilter === "unread") return !announcement.readByUserIds.includes(props.currentUser.id);
    if (announcementFilter === "important") return isImportantAnnouncement(announcement);
    if (announcementFilter === "guide") return isGuideAnnouncement(announcement);
    return true;
  });
  const userNotifications = props.data.notifications
    .filter((notice) => notice.userId === props.currentUser.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unresolvedUserNotifications = userNotifications.filter((notice) => !isReportMissingNotificationResolved(props.data, notice));
  const notificationCounts = {
    all: userNotifications.length + props.dealActionAlerts.length,
    unread: unresolvedUserNotifications.filter((notice) => !notice.read).length + props.dealActionAlerts.length,
    report: userNotifications.filter((notice) => notice.type === "report_missing").length,
    comment: userNotifications.filter((notice) => notice.type === "comment_received").length,
    action: props.dealActionAlerts.length,
  };
  const filteredUserNotifications = userNotifications.filter((notice) => {
    if (notificationFilter === "unread") return !notice.read && !isReportMissingNotificationResolved(props.data, notice);
    if (notificationFilter === "report") return notice.type === "report_missing";
    if (notificationFilter === "comment") return notice.type === "comment_received";
    if (notificationFilter === "action") return false;
    return true;
  });
  const showDealActionAlerts = notificationFilter === "all" || notificationFilter === "unread" || notificationFilter === "action";

  function announcementTitle(announcement: Announcement) {
    const firstLine = announcement.message.trim().split(/\r?\n/).find(Boolean);
    if (firstLine) return firstLine.length > 46 ? firstLine.slice(0, 46) + "..." : firstLine;
    if (announcement.attachments.length > 0) return "添付資料 " + announcement.attachments.length + "件";
    return "本文なし";
  }

  function toggleAnnouncement(announcementId: string) {
    const willOpen = !expandedAnnouncementIds.includes(announcementId);
    setExpandedAnnouncementIds((ids) =>
      ids.includes(announcementId) ? ids.filter((idValue) => idValue !== announcementId) : [...ids, announcementId],
    );
    if (willOpen) props.markAnnouncementRead(announcementId);
  }

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() && files.length === 0) return;
    setSaving(true);
    try {
      const attachments = await filesToAnnouncementAttachments(files);
      props.addAnnouncement(message, attachments, important);
      setMessage("");
      setImportant(false);
      setFiles([]);
      setComposerOpen(false);
      event.currentTarget.reset();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(announcement: Announcement) {
    setEditingId(announcement.id);
    setEditMessage(announcement.message);
    setEditImportant(Boolean(announcement.important));
    setEditAttachments(announcement.attachments);
    setEditFiles([]);
    setExpandedAnnouncementIds((ids) => (ids.includes(announcement.id) ? ids : [...ids, announcement.id]));
  }

  async function saveEdit(announcementId: string) {
    if (!editMessage.trim() && editAttachments.length === 0 && editFiles.length === 0) return;
    setSaving(true);
    try {
      const newAttachments = await filesToAnnouncementAttachments(editFiles);
      props.updateAnnouncement(announcementId, editMessage, [...editAttachments, ...newAttachments], editImportant);
      setEditingId(null);
      setEditMessage("");
      setEditImportant(false);
      setEditAttachments([]);
      setEditFiles([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notice-layer" role="dialog" aria-modal="true" aria-label="お知らせ">
      <button className="notice-backdrop" type="button" aria-label="お知らせを閉じる" onClick={props.close} />
      <aside className="notice-drawer">
        <header className="notice-drawer-head">
          <div>
            <span><Bell size={17} />お知らせ</span>
            <strong>全員共有チャット</strong>
          </div>
          <button className="icon-button" type="button" title="閉じる" onClick={props.close}>
            <X size={18} />
          </button>
        </header>

        <div className="notice-type-tabs">
          {[
            { value: "all", label: "すべて", count: notificationCounts.all },
            { value: "unread", label: "未読", count: notificationCounts.unread },
            { value: "report", label: "日報", count: notificationCounts.report },
            { value: "comment", label: "コメント", count: notificationCounts.comment },
            { value: "action", label: "次回", count: notificationCounts.action },
          ].map((filter) => (
            <button
              key={filter.value}
              className={notificationFilter === filter.value ? "active" : ""}
              type="button"
              onClick={() => setNotificationFilter(filter.value as typeof notificationFilter)}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>

        {filteredUserNotifications.length > 0 && (
          <section className="notice-system-list">
            <strong>個別通知</strong>
            {filteredUserNotifications.slice(0, 6).map((notice) => {
              const resolved = isReportMissingNotificationResolved(props.data, notice);
              return (
              <article key={notice.id} className={"notice-system-item " + (notice.read || resolved ? "read" : "unread") + (resolved ? " resolved" : "")}>
                <p>{notice.message}</p>
                <span>{new Date(notice.createdAt).toLocaleString("ja-JP")}{resolved ? " / 提出済み" : ""}</span>
                {!notice.read && <button type="button" onClick={() => props.markNotificationRead(notice.id)}>既読</button>}
              </article>
              );
            })}
          </section>
        )}

        {showDealActionAlerts && props.dealActionAlerts.length > 0 && (
          <section className="notice-system-list">
            <strong>次回アクション</strong>
            {props.dealActionAlerts.slice(0, 5).map((alert) => (
              <p key={alert.id}>{alert.message}</p>
            ))}
            <button className="secondary-action" type="button" onClick={props.openDealActionList}>案件一覧で見る</button>
          </section>
        )}

        <form className={composerOpen ? "notice-composer open" : "notice-composer"} onSubmit={submitAnnouncement}>
          <button
            className="notice-composer-toggle"
            type="button"
            aria-expanded={composerOpen}
            onClick={() => setComposerOpen((open) => !open)}
          >
            <span>
              <strong>新しいお知らせを投稿</strong>
              <small>{message.trim() || files.length > 0 ? "入力中" : "クリックして入力欄を開く"}</small>
            </span>
            <ChevronDown size={17} />
          </button>
          {composerOpen && (
            <div className="notice-composer-body">
              <label>
                お知らせ本文
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="全員に共有したい内容を入力" />
              </label>
              <label className="notice-check">
                <input type="checkbox" checked={important} onChange={(event) => setImportant(event.currentTarget.checked)} />
                重要として表示
              </label>
              <label className="notice-file-button">
                <Paperclip size={17} />
                PDF・資料を添付
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.xlsx,.xls,.doc,.docx,.ppt,.pptx,application/pdf,image/*"
                  onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
                />
              </label>
              {files.length > 0 && <div className="notice-file-list">{files.map((file) => <span key={file.name + "-" + file.size}>{file.name}</span>)}</div>}
              <button className="primary" type="submit" disabled={saving}>
                <Send size={17} />投稿
              </button>
            </div>
          )}
        </form>

        <div className="notice-filter-tabs">
          {[
            { value: "all", label: "すべて", count: sortedAnnouncements.length },
            { value: "unread", label: "未読", count: unreadAnnouncements.length },
            { value: "important", label: "重要", count: importantAnnouncements.length },
            { value: "guide", label: "使い方", count: guideAnnouncements.length },
          ].map((filter) => (
            <button
              key={filter.value}
              className={announcementFilter === filter.value ? "active" : ""}
              type="button"
              onClick={() => setAnnouncementFilter(filter.value as "all" | "unread" | "important" | "guide")}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>

        <div className="notice-thread">
          {filteredAnnouncements.length === 0 && <EmptyState text="該当するお知らせはありません。" />}
          {filteredAnnouncements.map((announcement) => {
            const author = props.data.users.find((user) => user.id === announcement.authorId);
            const canEdit = props.currentUser.role === "admin" || props.currentUser.id === announcement.authorId;
            const editing = editingId === announcement.id;
            const expanded = expandedAnnouncementIds.includes(announcement.id);
            const unread = !announcement.readByUserIds.includes(props.currentUser.id);
            return (
              <article key={announcement.id} className={expanded || editing ? "notice-card open" : "notice-card"}>
                <div className="notice-card-head">
                  <button
                    className="notice-title-button"
                    type="button"
                    aria-expanded={expanded || editing}
                    onClick={() => toggleAnnouncement(announcement.id)}
                  >
                    <span>
                      <strong>{announcementTitle(announcement)}</strong>
                      <small>
                        {author?.name ?? "不明なユーザー"} / {new Date(announcement.updatedAt).toLocaleString("ja-JP")}
                      </small>
                      <span className="notice-badges">
                        <em className={unread ? "unread" : "read"}>{unread ? "未読" : "既読"}</em>
                        {isImportantAnnouncement(announcement) && <em className="important">重要</em>}
                        {isGuideAnnouncement(announcement) && <em className="guide">使い方</em>}
                      </span>
                    </span>
                    <ChevronDown size={17} />
                  </button>
                  {canEdit && !editing && (
                    <div className="notice-card-actions">
                      <button type="button" title="編集" onClick={() => startEdit(announcement)}><Edit3 size={15} /></button>
                      <button type="button" title="削除" onClick={() => props.deleteAnnouncement(announcement.id)}><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="notice-edit">
                    <textarea value={editMessage} onChange={(event) => setEditMessage(event.target.value)} />
                    <label className="notice-check">
                      <input type="checkbox" checked={editImportant} onChange={(event) => setEditImportant(event.currentTarget.checked)} />
                      重要として表示
                    </label>
                    {editAttachments.length > 0 && (
                      <div className="notice-file-list editable">
                        {editAttachments.map((attachment) => (
                          <span key={attachment.id}>
                            {attachment.name}
                            <button type="button" onClick={() => setEditAttachments((items) => items.filter((item) => item.id !== attachment.id))}>
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <label className="notice-file-button">
                      <Paperclip size={17} />
                      資料を追加
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.xlsx,.xls,.doc,.docx,.ppt,.pptx,application/pdf,image/*"
                        onChange={(event) => setEditFiles(Array.from(event.currentTarget.files ?? []))}
                      />
                    </label>
                    {editFiles.length > 0 && <div className="notice-file-list">{editFiles.map((file) => <span key={file.name + "-" + file.size}>{file.name}</span>)}</div>}
                    <div className="notice-edit-actions">
                      <button className="primary" type="button" disabled={saving} onClick={() => saveEdit(announcement.id)}>
                        <Save size={16} />保存
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>キャンセル</button>
                    </div>
                  </div>
                ) : expanded ? (
                  <>
                    {announcement.message && <p className="notice-message">{announcement.message}</p>}
                    {announcement.attachments.length > 0 && (
                      <div className="notice-attachments">
                        {announcement.attachments.map((attachment) => (
                          <AnnouncementAttachmentPreview key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function submitPasswordReset() {
    const targetEmail = (resetEmail || email).trim();
    const nextPassword = resetPassword.trim();
    setError("");
    setResetMessage("");

    if (!targetEmail || !nextPassword) {
      setError("登録メールアドレスと新しいパスワードを入力してください。");
      return;
    }
    if (nextPassword.length < 4) {
      setError("新しいパスワードは4文字以上で入力してください。");
      return;
    }
    if (nextPassword !== resetPasswordConfirm.trim()) {
      setError("確認用パスワードが一致していません。");
      return;
    }

    setResetSubmitting(true);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: nextPassword }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof json.error === "string" ? json.error : "パスワードを再設定できませんでした。");
        return;
      }
      setEmail(targetEmail);
      setPassword(nextPassword);
      setResetPassword("");
      setResetPasswordConfirm("");
      setResetMessage("パスワードを再設定しました。新しいパスワードでログインしてください。");
    } catch {
      setError("パスワードを再設定できませんでした。通信状況を確認して再試行してください。");
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <form
        className="login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError("");
          try {
            const ok = await onLogin(email, password);
            if (!ok) setError("登録済みメンバーのメールアドレスとパスワードでログインしてください。");
          } catch {
            setError("ログインできませんでした。通信状況を確認して再試行してください。");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>KPI Daily</strong>
            <span>Member Login</span>
          </div>
        </div>
        <label className="field">
          メールアドレス
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        <label className="field">
          パスワード
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoCapitalize="none" spellCheck={false} required />
        </label>
        <button
          className="login-reset-link"
          type="button"
          onClick={() => {
            setResetOpen((value) => !value);
            setResetEmail((value) => value || email);
            setError("");
            setResetMessage("");
          }}
        >
          パスワードを忘れた場合
        </button>
        {resetOpen && (
          <section className="password-reset-panel" aria-label="パスワード再設定">
            <div>
              <strong>パスワード再設定</strong>
              <span>登録メールアドレスに新しいパスワードを設定します。</span>
            </div>
            <label className="field">
              登録メールアドレス
              <input type="email" value={resetEmail || email} onChange={(event) => setResetEmail(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              新しいパスワード
              <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              新しいパスワード（確認）
              <input type="password" value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
            </label>
            {resetMessage && <p className="form-success">{resetMessage}</p>}
            <button className="secondary-action" type="button" disabled={resetSubmitting} onClick={submitPasswordReset}>
              {resetSubmitting ? "再設定中..." : "パスワードを再設定"}
            </button>
          </section>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "確認中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}

function Filters(props: {
  activeDate: string;
  setActiveDate: (value: string) => void;
  periodType: FilterPeriodType;
  setPeriodType: (value: FilterPeriodType) => void;
  activeKpiId: string;
  setActiveKpiId: (value: string) => void;
  kpiItems: KpiItem[];
  showAllDataOption?: boolean;
  showKpi?: boolean;
  showPeriod?: boolean;
  showAllPeriodOption?: boolean;
  dashboardScope?: {
    data: AppData;
    drill: Drill;
    setDrill: (drill: Drill) => void;
    period: { start: string; end: string; label?: string };
  };
}) {
  const useMonthSelect = props.showPeriod !== false && props.periodType === "month";
  const periodOptions: FilterPeriodType[] = props.showAllPeriodOption ? ["day", "week", "month", "half", "all"] : ["day", "week", "month", "half"];
  const dashboardScopeTitle = props.dashboardScope
    ? props.dashboardScope.drill.scope === "division"
      ? "事業部全体"
      : props.dashboardScope.drill.scope === "team"
        ? props.dashboardScope.data.teams.find((team) => team.id === props.dashboardScope?.drill.teamId)?.name ?? "未設定"
        : props.dashboardScope.data.users.find((user) => user.id === props.dashboardScope?.drill.userId)?.name ?? "未設定"
    : "";
  const dashboardScopeValue = props.dashboardScope
    ? props.dashboardScope.drill.scope === "team" && props.dashboardScope.drill.teamId
      ? "team:" + props.dashboardScope.drill.teamId
      : props.dashboardScope.drill.scope === "member" && props.dashboardScope.drill.userId
        ? "member:" + props.dashboardScope.drill.userId
        : "division"
    : "";
  return (
    <section className="filter-strip">
      <div className="filter-main-row">
        <label className={useMonthSelect ? "month-picker" : ""}>
          <CalendarDays size={16} />
          {useMonthSelect ? (
            <>
              <span>{monthLabel(monthKey(props.activeDate))}</span>
              <select value={monthKey(props.activeDate)} onChange={(event) => props.setActiveDate(event.target.value + "-01")}>
                {monthOptions(props.activeDate).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <input type="date" value={props.activeDate} onChange={(event) => props.setActiveDate(event.target.value)} />
          )}
        </label>
        {props.showPeriod !== false && (
          <div className="segmented">
            {periodOptions.map((type) => (
              <button key={type} className={props.periodType === type ? "active" : ""} onClick={() => props.setPeriodType(type)}>
                {type === "all" ? "全期間" : periodLabels[type]}
              </button>
            ))}
          </div>
        )}
      </div>
      {props.showKpi !== false && (
        <div className="kpi-switcher" aria-label="KPI項目">
          <BarChart3 size={16} />
          <div>
            {props.showAllDataOption && (
              <button
                className={props.activeKpiId === allDataKpiId ? "active" : ""}
                onClick={() => props.setActiveKpiId(allDataKpiId)}
                type="button"
              >
                全データ
              </button>
            )}
            {props.kpiItems.map((item) => (
              <button key={item.id} className={props.activeKpiId === item.id ? "active" : ""} onClick={() => props.setActiveKpiId(item.id)} type="button">
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {props.dashboardScope && (
        <div className="progress-scope-control">
          <label>
            <span>表示範囲</span>
            <select
              value={dashboardScopeValue}
              onChange={(event) => {
                const [scope, idValue] = event.target.value.split(":");
                if (scope === "team") props.dashboardScope?.setDrill({ scope: "team", teamId: idValue });
                else if (scope === "member") props.dashboardScope?.setDrill({ scope: "member", userId: idValue });
                else props.dashboardScope?.setDrill({ scope: "division" });
              }}
            >
              <option value="division">事業部</option>
              {props.dashboardScope.data.teams.map((team) => (
                <option key={team.id} value={"team:" + team.id}>{team.name}</option>
              ))}
              {props.dashboardScope.data.users.map((user) => (
                <option key={user.id} value={"member:" + user.id}>{user.name}</option>
              ))}
            </select>
          </label>
          <div className="progress-range-summary">
            <strong>{dashboardScopeTitle}</strong>
            <span>
              {props.dashboardScope.period.start} - {props.dashboardScope.period.end}
              {props.dashboardScope.period.label ? " / " + props.dashboardScope.period.label : ""}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function KpiFunnelPanel(props: {
  data: AppData;
  userIds: string[];
  start: string;
  end: string;
  onSelect: (kpiItemId: string, label: string) => void;
  className?: string;
  rangeLabel?: string;
}) {
  const values = kpiFunnelValues(props.data, props.userIds, props.start, props.end);
  const base = Math.max(values[0]?.actual ?? 0, 1);

  return (
    <section className={["panel", "analysis-funnel-panel", props.className].filter(Boolean).join(" ")}>
      <div className="panel-title funnel-panel-title">
        <BarChart3 size={18} />
        <h3>KPIファネル分析</h3>
        {props.rangeLabel && <span>{props.rangeLabel}</span>}
      </div>
      <div className="funnel-visual">
        <div className="funnel-shape-wrap">
          <svg className="funnel-shape-svg" viewBox="0 0 420 390" role="img" aria-label="KPIファネル">
            {values.map((row, index) => {
              const shape = funnelShapeRows[index] ?? funnelShapeRows[funnelShapeRows.length - 1];
              return (
                <g
                  key={row.id}
                  className="funnel-svg-stage"
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onSelect(row.id, row.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      props.onSelect(row.id, row.name);
                    }
                  }}
                >
                  <polygon points={shape.points} fill={palette[index % palette.length]} />
                  <text x="210" y={shape.labelY} textAnchor="middle" dominantBaseline="middle">
                    {row.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="funnel-meta-stack">
          {values.map((row, index) => {
            const ratioWidth = Math.min(Math.max((row.actual / base) * 100, row.actual > 0 ? 6 : 0), 100);
            return (
              <button key={row.id} className="funnel-stage-meta" type="button" onClick={() => props.onSelect(row.id, row.name)}>
                <strong>{numberFormat(row.actual)} {row.unit}</strong>
                <span>{index === 0 ? "起点" : "前工程比 " + numberFormat(row.conversion ?? 0) + "%"}</span>
                <i><b style={{ width: ratioWidth + "%" }} /></i>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DashboardView(props: {
  data: AppData;
  activeKpi: KpiItem;
  activeDate: string;
  periodType: PeriodType;
  period: { start: string; end: string; label?: string };
  drill: Drill;
  actual: number;
  target: number;
  achievement: number;
  attendance: { checked: number; attended: number; rate: number };
  showAllData: boolean;
  openDealsFromProgress: (stage: DealStage | "all") => void;
  openForecastDeals: (ranks: DealRank[], includeContract: boolean) => void;
}) {
  const [forecastRanks, setForecastRanks] = useState<DealRank[]>([]);
  const [breakdown, setBreakdown] = useState<{
    title: string;
    columns?: { date: string; userName: string; value: string; detail: string };
    rows: { id: string; date: string; userName: string; value: string; detail: string }[];
  } | null>(null);
  const userIds = usersForDrill(props.data, props.drill).map((user) => user.id);
  const scopedUsers = usersForDrill(props.data, props.drill);
  const contractCount = countDeals(props.data.deals, userIds, "contract", props.period.start, props.period.end);
  const contractSalesAmount = sumDealAmounts(props.data.deals, userIds, "contract", props.period.start, props.period.end);
  const forecastReferenceDate = (deal: Deal) => (deal.stage === "contract" ? dealDate(deal) : nextActionDate(deal));
  const rankedForecastDealFilter = (deal: Deal, scopedUserIds: string[], start: string, end: string) => {
    const referenceDate = forecastReferenceDate(deal);
    return (
      scopedUserIds.includes(deal.userId) &&
      Boolean(referenceDate) &&
      inRange(referenceDate, start, end) &&
      (deal.stage === "contract" || (!["lost", "completed"].includes(deal.stage) && forecastRanks.includes(dealRank(deal))))
    );
  };
  const forecastActualFor = (scopedUserIds: string[], kpiItemId: string, start: string, end: string) => {
    if (kpiItemId === "kpi-orders") {
      return props.data.deals.filter((deal) => rankedForecastDealFilter(deal, scopedUserIds, start, end)).length;
    }
    if (kpiItemId === "kpi-sales") {
      return props.data.deals
        .filter((deal) => rankedForecastDealFilter(deal, scopedUserIds, start, end))
        .reduce((sum, deal) => sum + deal.amount, 0);
    }
    return actualForKpi(props.data, scopedUserIds, kpiItemId, start, end);
  };
  const forecastDeals = props.data.deals.filter(
    (deal) =>
      userIds.includes(deal.userId) &&
      Boolean(forecastReferenceDate(deal)) &&
      inRange(forecastReferenceDate(deal), props.period.start, props.period.end) &&
      !["contract", "lost", "completed"].includes(deal.stage) &&
      forecastRanks.includes(dealRank(deal)),
  );
  const forecastOrderCount = forecastActualFor(userIds, "kpi-orders", props.period.start, props.period.end);
  const forecastSalesAmount = forecastActualFor(userIds, "kpi-sales", props.period.start, props.period.end);
  const showForecast = props.showAllData || props.activeKpi.id === "kpi-orders" || props.activeKpi.id === "kpi-sales";
  const activeActual = showForecast && (props.activeKpi.id === "kpi-orders" || props.activeKpi.id === "kpi-sales") ? forecastActualFor(userIds, props.activeKpi.id, props.period.start, props.period.end) : props.actual;
  const activeAchievement = props.target > 0 ? Math.round((activeActual / props.target) * 100) : 0;
  const toggleForecastRank = (rank: DealRank) => {
    setForecastRanks((current) => (current.includes(rank) ? current.filter((item) => item !== rank) : [...current, rank]));
  };
  const callInputCount = actualForKpi(props.data, userIds, "kpi-calls", props.period.start, props.period.end);
  const apInputCount = actualForKpi(props.data, userIds, "kpi-ap", props.period.start, props.period.end);
  const firstMeetingInputCount = actualForKpi(props.data, userIds, "kpi-meetings", props.period.start, props.period.end);
  const recloseInputCount = actualForKpi(props.data, userIds, "kpi-reclose", props.period.start, props.period.end);
  const progressGoalFor = (kpiItemId: string, label: string, actual: number, color: string, onClick: () => void) => {
    const item = props.data.kpiItems.find((candidate) => candidate.id === kpiItemId);
    const target = targetFor(props.data, props.drill, kpiItemId, props.periodType, props.period.start, props.period.end);
    return {
      id: kpiItemId,
      label,
      actual,
      target,
      unit: item?.unit ?? (kpiItemId === "kpi-sales" ? "万円" : "件"),
      rate: target > 0 ? Math.round((actual / target) * 100) : 0,
      color,
      onClick,
    };
  };
  const openKpiBreakdown = (kpiItemId: string, label: string) => {
    const item = props.data.kpiItems.find((candidate) => candidate.id === kpiItemId);
    const rows = props.data.kpiRecords
      .filter((record) => userIds.includes(record.userId) && record.kpiItemId === kpiItemId && inRange(record.date, props.period.start, props.period.end))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((record) => ({
        id: record.id,
        date: record.date,
        userName: props.data.users.find((user) => user.id === record.userId)?.name ?? "未設定",
        value: numberFormat(record.actualValue) + " " + (item?.unit ?? "件"),
        detail: item?.name ?? label,
      }));
    setBreakdown({ title: label + "の根拠", rows });
  };
  const openKpiMemberTotalBreakdown = (kpiItemId: string, label: string) => {
    const item = props.data.kpiItems.find((candidate) => candidate.id === kpiItemId);
    const unit = item?.unit ?? "件";
    const scopedRecords = props.data.kpiRecords.filter(
      (record) => userIds.includes(record.userId) && record.kpiItemId === kpiItemId && inRange(record.date, props.period.start, props.period.end),
    );
    const rows = scopedUsers
      .map((user, index) => {
        const total = scopedRecords.filter((record) => record.userId === user.id).reduce((sum, record) => sum + record.actualValue, 0);
        return {
          id: `${kpiItemId}-${user.id}`,
          date: `${props.period.start} - ${props.period.end}`,
          userName: user.name,
          value: numberFormat(total) + " " + unit,
          detail: `${label} / 期間累積`,
          sortValue: total,
          sortIndex: index,
        };
      })
      .sort((a, b) => b.sortValue - a.sortValue || a.sortIndex - b.sortIndex)
      .map((row) => ({
        id: row.id,
        date: row.date,
        userName: row.userName,
        value: row.value,
        detail: row.detail,
      }));
    setBreakdown({
      title: label + "のメンバー別累積",
      columns: { date: "対象期間", userName: "メンバー", value: "累積実績", detail: "内容" },
      rows,
    });
  };
  const openForecastBreakdown = (kpiItemId: "kpi-orders" | "kpi-sales", label: string) => {
    const rows = props.data.deals
      .filter((deal) => rankedForecastDealFilter(deal, userIds, props.period.start, props.period.end))
      .sort((a, b) => forecastReferenceDate(b).localeCompare(forecastReferenceDate(a)))
      .map((deal) => ({
        id: deal.id,
        date: forecastReferenceDate(deal),
        userName: props.data.users.find((user) => user.id === deal.userId)?.name ?? "未設定",
        value: kpiItemId === "kpi-sales" ? numberFormat(deal.amount) + " 万円" : "1 件",
        detail: deal.title + " / " + (deal.stage === "contract" ? "契約済み" : "予想: " + dealRankLabels[dealRank(deal)]),
      }));
    setBreakdown({ title: label + "の根拠", rows });
  };
  const openForecastMemberTotalBreakdown = (kpiItemId: "kpi-orders" | "kpi-sales", label: string) => {
    const scopedDeals = props.data.deals.filter((deal) => rankedForecastDealFilter(deal, userIds, props.period.start, props.period.end));
    const rows = scopedUsers
      .map((user, index) => {
        const userDeals = scopedDeals.filter((deal) => deal.userId === user.id);
        const total = kpiItemId === "kpi-sales" ? userDeals.reduce((sum, deal) => sum + deal.amount, 0) : userDeals.length;
        return {
          id: `${kpiItemId}-${user.id}`,
          date: `${props.period.start} - ${props.period.end}`,
          userName: user.name,
          value: kpiItemId === "kpi-sales" ? numberFormat(total) + " 万円" : numberFormat(total) + " 件",
          detail: `対象案件 ${numberFormat(userDeals.length)} 件 / 期間累積`,
          sortValue: total,
          sortIndex: index,
        };
      })
      .sort((a, b) => b.sortValue - a.sortValue || a.sortIndex - b.sortIndex)
      .map((row) => ({
        id: row.id,
        date: row.date,
        userName: row.userName,
        value: row.value,
        detail: row.detail,
      }));
    setBreakdown({
      title: label + "のメンバー別累積",
      columns: { date: "対象期間", userName: "メンバー", value: "累積実績", detail: "内容" },
      rows,
    });
  };
  const openActiveBreakdown = () => {
    if (props.activeKpi.id === "kpi-sales" || props.activeKpi.id === "kpi-orders") {
      openForecastBreakdown(props.activeKpi.id, props.activeKpi.name);
      return;
    }
    openKpiBreakdown(props.activeKpi.id, props.activeKpi.name);
  };
  const allDataProgressGoals = [
    progressGoalFor("kpi-sales", "売上", forecastSalesAmount, "#0b63ce", () => openForecastMemberTotalBreakdown("kpi-sales", "売上")),
    progressGoalFor("kpi-orders", "契約数", forecastOrderCount, "#16a34a", () => openForecastMemberTotalBreakdown("kpi-orders", "契約数")),
    progressGoalFor("kpi-ap", "AP数", apInputCount, "#00a88f", () => openKpiMemberTotalBreakdown("kpi-ap", "AP数")),
    progressGoalFor("kpi-calls", "架電数", callInputCount, "#f59e0b", () => openKpiMemberTotalBreakdown("kpi-calls", "架電数")),
    progressGoalFor("kpi-meetings", "初回商談数", firstMeetingInputCount, "#4f46e5", () => openKpiMemberTotalBreakdown("kpi-meetings", "初回商談数")),
    progressGoalFor("kpi-reclose", "再クロ数", recloseInputCount, "#db2777", () => openKpiMemberTotalBreakdown("kpi-reclose", "再クロ数")),
  ];
  const comparisonData = (props.drill.scope === "division" ? props.data.teams : usersForDrill(props.data, props.drill)).map((item) => {
    const ids = "color" in item ? props.data.users.filter((user) => user.teamId === item.id).map((user) => user.id) : [item.id];
    const actual = showForecast && (props.activeKpi.id === "kpi-orders" || props.activeKpi.id === "kpi-sales")
      ? forecastActualFor(ids, props.activeKpi.id, props.period.start, props.period.end)
      : actualForKpi(props.data, ids, props.activeKpi.id, props.period.start, props.period.end);
    const target =
      "color" in item
        ? targetFor(props.data, { scope: "team", teamId: item.id }, props.activeKpi.id, props.periodType, props.period.start, props.period.end)
        : targetFor(props.data, { scope: "member", userId: item.id }, props.activeKpi.id, props.periodType, props.period.start, props.period.end);
    return {
      name: item.name,
      actual,
      target,
      rate: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  });
  const contributionData = comparisonData
    .filter((item) => item.actual > 0)
    .map((item, index) => ({ ...item, color: palette[index % palette.length] }));
  const contributionTotal = contributionData.reduce((sum, item) => sum + item.actual, 0);
  const contributionTitle = props.drill.scope === "division" ? "チーム別実績" : props.drill.scope === "team" ? "メンバー別実績" : "個人実績";
  const trendEndDate = props.period.end < todayDateKey() ? props.period.end : todayDateKey();
  const trendDates = props.period.start <= props.period.end ? eachDate(props.period.start, props.period.end) : [];
  const trendData = trendDates.map((date) => ({
    date: formatDateJa(date),
    actual:
      date > trendEndDate
        ? null
        : showForecast && (props.activeKpi.id === "kpi-orders" || props.activeKpi.id === "kpi-sales")
          ? forecastActualFor(userIds, props.activeKpi.id, props.period.start, date)
          : actualForKpi(props.data, userIds, props.activeKpi.id, props.period.start, date),
  }));
  const allDataTrendItems = progressTrendKpiIds
    .map((kpiId) => props.data.kpiItems.find((item) => item.id === kpiId && item.active))
    .filter((item): item is KpiItem => Boolean(item));
  const allDataTrendItemNames = Object.fromEntries(allDataTrendItems.map((item) => [item.id, item.name]));
  const allDataTrendData = trendDates.map((date) => {
    const point: Record<string, string | number | null> = { date: formatDateJa(date) };
    allDataTrendItems.forEach((item) => {
      if (date > trendEndDate) {
        point[item.id] = null;
        return;
      }
      const dateMonthRange = getPeriodRange("month", date);
      const target = targetFor(props.data, props.drill, item.id, "month", dateMonthRange.start, dateMonthRange.end);
      const actual = item.id === "kpi-orders" || item.id === "kpi-sales"
        ? forecastActualFor(userIds, item.id, dateMonthRange.start, date)
        : actualForKpi(props.data, userIds, item.id, dateMonthRange.start, date);
      point[item.id] = target > 0 ? Math.round((actual / target) * 100) : 0;
    });
    return point;
  });
  const pieData = [
    { name: "実績", value: Math.min(activeActual, props.target || activeActual), color: achievementColor(activeAchievement) },
    { name: "残り", value: Math.max(props.target - activeActual, 0), color: "#dbeafe" },
  ];

  return (
    <div className="stack">
      {props.showAllData ? (
        <section className="progress-goal-grid">
          {allDataProgressGoals.map((goal) => (
            <ProgressGoalCard
              key={goal.id}
              label={goal.label}
              actual={goal.actual}
              target={goal.target}
              unit={goal.unit}
              rate={goal.rate}
              color={goal.color}
              onClick={goal.onClick}
            />
          ))}
        </section>
      ) : (
        <section className="metrics-grid">
          <StatCard
            label="対象実績"
            value={numberFormat(activeActual) + " " + props.activeKpi.unit}
            sub={props.activeKpi.description}
            valueRate={activeAchievement}
            onClick={openActiveBreakdown}
          />
          <StatCard label="目標" value={numberFormat(props.target) + " " + props.activeKpi.unit} sub={periodLabels[props.periodType] + "次目標"} />
          <StatCard label="達成率" value={activeAchievement + "%"} sub={activeAchievement >= 100 ? "目標達成" : "進捗確認中"} />
          <StatCard label="月間稼働率" value={props.attendance.rate + "%"} sub={props.attendance.attended + "/" + props.attendance.checked + " 出勤"} />
        </section>
      )}

      {showForecast && (
        <section className="panel forecast-panel">
          <div className="panel-title panel-title-with-action">
            <Target size={18} />
            <h3>契約数・売上予想</h3>
            <span>ランク案件を実績に加算</span>
          </div>
          <div className="forecast-controls">
            {forecastRankOptions.map((rank) => (
              <label key={rank}>
                <input type="checkbox" checked={forecastRanks.includes(rank)} onChange={() => toggleForecastRank(rank)} />
                {dealRankLabels[rank]}
              </label>
            ))}
          </div>
          <div className="forecast-summary">
            <button type="button" onClick={() => props.openForecastDeals(forecastRanks, true)}>
              <span>契約数</span>
              <strong>{numberFormat(contractCount)} 件</strong>
              <em>予想 {numberFormat(forecastOrderCount)} 件</em>
            </button>
            <button type="button" onClick={() => props.openForecastDeals(forecastRanks, true)}>
              <span>売上</span>
              <strong>{numberFormat(contractSalesAmount)} 万円</strong>
              <em>予想 {numberFormat(forecastSalesAmount)} 万円</em>
            </button>
            <button type="button" onClick={() => props.openForecastDeals(forecastRanks, false)}>
              <span>加算対象</span>
              <strong>{numberFormat(forecastDeals.length)} 件</strong>
              <em>{numberFormat(forecastDeals.reduce((sum, deal) => sum + deal.amount, 0))} 万円</em>
            </button>
          </div>
        </section>
      )}

      {props.showAllData && (
        <>
          {breakdown && (
            <section className="panel breakdown-panel">
              <div className="panel-title">
                <Search size={18} />
                <h3>{breakdown.title}</h3>
                <button className="icon-button" type="button" title="閉じる" onClick={() => setBreakdown(null)}>
                  <X size={16} />
                </button>
              </div>
              {breakdown.rows.length === 0 ? (
                <EmptyState text="該当する内訳データはありません。" />
              ) : (
                <div className="breakdown-table">
                  <div className="breakdown-head">
                    <span>{breakdown.columns?.date ?? "日付"}</span>
                    <span>{breakdown.columns?.userName ?? "担当"}</span>
                    <span>{breakdown.columns?.value ?? "実績"}</span>
                    <span>{breakdown.columns?.detail ?? "内容"}</span>
                  </div>
                  {breakdown.rows.map((row) => (
                    <article key={row.id}>
                      <span>{row.date}</span>
                      <strong>{row.userName}</strong>
                      <em>{row.value}</em>
                      <p>{row.detail}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

        </>
      )}

      <section className="chart-grid">
        <div className="panel">
          <div className="panel-title"><PieChartIcon size={18} /><h3>達成率</h3></div>
          <MeasuredChart>
            {({ width, height }) => (
              <>
                <PieChart width={width} height={height}>
                  <Pie data={pieData} innerRadius={62} outerRadius={88} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
                <div className="donut-label">{activeAchievement}%</div>
              </>
            )}
          </MeasuredChart>
        </div>
        <div className="panel contribution-panel">
          <div className="panel-title"><PieChartIcon size={18} /><h3>{contributionTitle}</h3></div>
          {contributionTotal === 0 ? (
            <EmptyState text="対象期間の実績はまだありません。" />
          ) : (
            <>
              <MeasuredChart>
                {({ width, height }) => (
                  <PieChart width={width} height={height}>
                    <Pie
                      data={contributionData}
                      innerRadius={42}
                      outerRadius={82}
                      paddingAngle={2}
                      dataKey="actual"
                      nameKey="name"
                      labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                      label={(labelProps) => contributionPieLabel(labelProps, props.activeKpi.unit)}
                    >
                      {contributionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [numberFormat(Number(value)) + " " + props.activeKpi.unit, "実績"]} />
                  </PieChart>
                )}
              </MeasuredChart>
              <div className="contribution-list">
                {contributionData.map((item) => (
                  <span key={item.name}>
                    <i style={{ background: item.color }} />
                    <strong>{item.name}</strong>
                    <em>{numberFormat(item.actual)} {props.activeKpi.unit} / {Math.round((item.actual / contributionTotal) * 100)}%</em>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="panel comparison-panel">
          <div className="panel-title comparison-panel-title">
            <BarChart3 size={18} />
            <h3>実績 / 目標比較</h3>
            <span className="comparison-chart-key">
              <i className="actual" />実績
              <i className="target" />目標
            </span>
          </div>
          <MeasuredChart>
            {({ width, height }) => (
              <BarChart data={comparisonData} width={width} height={height} margin={{ top: 28, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="actual" name="実績" fill="#2563eb" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="actual" position="top" fill="#1d4ed8" fontSize={11} fontWeight={850} formatter={(value) => numberFormat(Number(value))} />
                </Bar>
                <Bar dataKey="target" name="目標" fill="#94a3b8" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="target" position="top" fill="#475569" fontSize={11} fontWeight={850} formatter={(value) => numberFormat(Number(value))} />
                </Bar>
              </BarChart>
            )}
          </MeasuredChart>
          <div className="comparison-summary-list">
            {comparisonData.map((item) => (
              <article key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <em className={item.rate === null ? "is-unset" : item.rate >= 100 ? "is-complete" : "is-behind"}>
                    {item.rate === null ? "目標未設定" : item.rate + "%"}
                  </em>
                </div>
                <p>
                  <b className={item.rate === null ? "is-unset" : item.rate >= 100 ? "is-complete" : "is-behind"}>
                    {numberFormat(item.actual)}
                  </b>
                  <span>/ {numberFormat(item.target)} {props.activeKpi.unit}</span>
                </p>
              </article>
            ))}
          </div>
        </div>
        <KpiHeatmap data={props.data} userIds={userIds} activeDate={props.activeDate} periodType={props.periodType} />
        <div className="panel wide">
          <div className="panel-title"><LineChartIcon size={18} /><h3>日別推移</h3></div>
          <MeasuredChart>
            {({ width, height }) => (
              props.showAllData ? (
                <LineChart data={allDataTrendData} width={width} height={height}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value, name) => [String(value) + "%", String(allDataTrendItemNames[String(name)] ?? name)]} />
                  <Legend />
                  <ReferenceLine
                    y={100}
                    stroke="#dc2626"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    label={{ value: "目標", position: "insideTopRight", fill: "#dc2626", fontSize: 12 }}
                  />
                  {allDataTrendItems.map((item, index) => (
                    <Line
                      key={item.id}
                      dataKey={item.id}
                      name={item.name}
                      type="monotone"
                      stroke={palette[index % palette.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={trendData} width={width} height={height}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {props.target > 0 && (
                    <ReferenceLine
                      y={props.target}
                      stroke="#dc2626"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                      label={{ value: "目標", position: "insideTopRight", fill: "#dc2626", fontSize: 12 }}
                    />
                  )}
                  <Area dataKey="actual" name="累計実績" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                </AreaChart>
              )
            )}
          </MeasuredChart>
        </div>
        {props.period.start <= trendEndDate && (
          <KpiFunnelPanel
            data={props.data}
            userIds={userIds}
            start={props.period.start}
            end={trendEndDate}
            rangeLabel={`${props.period.start} - ${trendEndDate}`}
            className="progress-funnel-panel"
            onSelect={(kpiItemId, label) => openKpiBreakdown(kpiItemId, label)}
          />
        )}
      </section>
    </div>
  );
}

function KpiHeatmap({ data, userIds, activeDate, periodType }: { data: AppData; userIds: string[]; activeDate: string; periodType: PeriodType }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const range =
    periodType === "month"
      ? getPeriodRange("month", activeDate)
      : periodType === "half"
        ? getPeriodRange("month", activeDate)
        : getPeriodRange("week", activeDate);
  const dates = eachDate(range.start, range.end);
  const leadingBlanks = Array.from({ length: weekdayIndexFromMonday(range.start) });
  const trailingBlanks = Array.from({ length: (7 - ((leadingBlanks.length + dates.length) % 7)) % 7 });
  const items = heatmapKpiIds
    .map((kpiId) => data.kpiItems.find((item) => item.id === kpiId && item.active))
    .filter((item): item is KpiItem => Boolean(item));
  const valuesByDate = dates.map((date) => ({
    date,
    values: items.map((item) => ({
      item,
      value: actualForKpi(data, userIds, item.id, date, date),
    })),
  }));
  const maxByKpi = Object.fromEntries(
    items.map((item) => [item.id, Math.max(1, ...valuesByDate.map((day) => day.values.find((entry) => entry.item.id === item.id)?.value ?? 0))]),
  );
  const weekLabels = ["月", "火", "水", "木", "金", "土", "日"];
  const selectedDay = selectedDate ? valuesByDate.find((day) => day.date === selectedDate) : undefined;
  const selectedDayIndex = selectedDate ? valuesByDate.findIndex((day) => day.date === selectedDate) : -1;
  const previousHeatmapDay = selectedDayIndex > 0 ? valuesByDate[selectedDayIndex - 1] : undefined;
  const nextHeatmapDay = selectedDayIndex >= 0 && selectedDayIndex < valuesByDate.length - 1 ? valuesByDate[selectedDayIndex + 1] : undefined;

  return (
    <div className="panel heatmap-panel">
      <div className="panel-title">
        <CalendarDays size={18} />
        <h3>KPIヒートマップ</h3>
      </div>
      <div className="heatmap-sub">
        {range.start} - {range.end}
      </div>
      <div className="heatmap-weekdays">
        {weekLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="heatmap-calendar">
        {leadingBlanks.map((_, index) => (
          <div className="heatmap-day blank" key={"leading-" + index} />
        ))}
        {valuesByDate.map((day) => (
          <button className="heatmap-day" key={day.date} type="button" onClick={() => setSelectedDate(day.date)} aria-label={day.date + "のKPIヒートマップを拡大表示"}>
            <div className="heatmap-day-head">
              <strong>{dateParts(day.date).day}</strong>
              <span>{formatDateJa(day.date).split("(")[1]?.replace(")", "")}</span>
            </div>
            <div className="heatmap-bars">
              {day.values.map(({ item, value }, index) => {
                const intensity = value > 0 ? Math.max(0.18, Math.min(0.92, value / maxByKpi[item.id])) : 0.08;
                return (
                  <div
                    className="heatmap-bar"
                    key={item.id}
                    style={{ backgroundColor: hexToRgba(palette[index % palette.length], intensity) }}
                    title={item.name + ": " + numberFormat(value) + " " + item.unit}
                  >
                    <span>{item.name}</span>
                    <strong>{value > 0 ? numberFormat(value) : ""}</strong>
                  </div>
                );
              })}
            </div>
          </button>
        ))}
        {trailingBlanks.map((_, index) => (
          <div className="heatmap-day blank" key={"trailing-" + index} />
        ))}
      </div>
      <div className="heatmap-legend">
        {items.map((item, index) => (
          <span key={item.id}>
            <i style={{ background: palette[index % palette.length] }} />
            {item.name}
          </span>
        ))}
      </div>
      {selectedDay && (
        <div className="heatmap-detail-layer" role="dialog" aria-modal="true" aria-label={selectedDay.date + "のKPIヒートマップ詳細"}>
          <button className="heatmap-detail-backdrop" type="button" aria-label="KPIヒートマップ詳細を閉じる" onClick={() => setSelectedDate(null)} />
          <section className="heatmap-detail-panel">
            <div className="heatmap-detail-head">
              <div>
                <span>KPIヒートマップ詳細</span>
                <h3>{formatDateJa(selectedDay.date)}</h3>
                <p>{range.start} - {range.end}</p>
              </div>
              <button className="icon-button" type="button" title="閉じる" onClick={() => setSelectedDate(null)}>
                <X size={17} />
              </button>
            </div>
            <div className="heatmap-detail-nav">
              <button type="button" disabled={!previousHeatmapDay} onClick={() => previousHeatmapDay && setSelectedDate(previousHeatmapDay.date)}>
                前の日
              </button>
              <span>{selectedDayIndex + 1} / {valuesByDate.length}</span>
              <button type="button" disabled={!nextHeatmapDay} onClick={() => nextHeatmapDay && setSelectedDate(nextHeatmapDay.date)}>
                次の日
              </button>
            </div>
            <div className="heatmap-detail-grid">
              {selectedDay.values.map(({ item, value }, index) => {
                const maxValue = maxByKpi[item.id] ?? 1;
                const percent = Math.round((value / maxValue) * 100);
                return (
                  <article key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.description}</span>
                    </div>
                    <em>{numberFormat(value)} {item.unit}</em>
                    <div className="heatmap-detail-bar" aria-hidden="true">
                      <i
                        style={{
                          width: Math.max(value > 0 ? 8 : 0, Math.min(100, percent)) + "%",
                          background: palette[index % palette.length],
                        }}
                      />
                    </div>
                    <small>期間内最大 {numberFormat(maxValue)} {item.unit} に対して {percent}%</small>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function KpiInputViewCompact(props: {
  data: AppData;
  users: User[];
  activeDate: string;
  focusUserId: string | null;
  updateRecord: (userId: string, kpiItemId: string, value: number) => void;
  setAttendance: (userId: string, date: string, attended: boolean) => void;
}) {
  const initialUserId = props.focusUserId && props.users.some((user) => user.id === props.focusUserId) ? props.focusUserId : props.users[0]?.id ?? "";
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [todayInputOpen, setTodayInputOpen] = useState(Boolean(props.focusUserId));
  const selectedUser = props.users.find((user) => user.id === selectedUserId) ?? props.users[0];
  const attendance = props.data.attendanceRecords.find((record) => record.userId === selectedUser?.id && record.date === props.activeDate);
  const selectedTeam = props.data.teams.find((team) => team.id === selectedUser?.teamId);
  const selectedTeamUserIds = selectedTeam ? props.data.users.filter((user) => user.teamId === selectedTeam.id).map((user) => user.id) : [];
  const recentDates = eachDate(toDateKey(addDays(parseDateKey(props.activeDate), -29)), props.activeDate)
    .filter((date) => {
      const day = parseDateKey(date).getDay();
      return day !== 0 && day !== 6;
    })
    .reverse();
  const buildRecentInputRows = (userIds: string[], drill: Drill) =>
    recentDates.map((date) => {
      const valueFor = (kpiItemId: string) =>
        props.data.kpiRecords
          .filter((record) => userIds.includes(record.userId) && record.kpiItemId === kpiItemId && record.date === date)
          .reduce((sum, record) => sum + record.actualValue, 0);
      const targetValueFor = (kpiItemId: string) => targetFor(props.data, drill, kpiItemId, "day", date, date);
      const attendedCount = props.data.attendanceRecords.filter((record) => userIds.includes(record.userId) && record.date === date && record.attended).length;
      const sales = sumDealAmounts(props.data.deals, userIds, "contract", date, date);
      const calls = valueFor("kpi-calls");
      const ap = valueFor("kpi-ap");
      const firstMeetings = valueFor("kpi-meetings");
      const reclose = valueFor("kpi-reclose");
      const orders = countDeals(props.data.deals, userIds, "contract", date, date);
      return {
        date,
        attendance: { actual: attendedCount, target: userIds.length },
        calls: { actual: calls, target: targetValueFor("kpi-calls") },
        ap: { actual: ap, target: targetValueFor("kpi-ap") },
        firstMeetings: { actual: firstMeetings, target: targetValueFor("kpi-meetings") },
        reclose: { actual: reclose, target: targetValueFor("kpi-reclose") },
        orders: { actual: orders, target: targetValueFor("kpi-orders") },
        sales: { actual: sales, target: targetValueFor("kpi-sales") },
      };
    });
  const recentInputRows = selectedUser ? buildRecentInputRows([selectedUser.id], { scope: "member", userId: selectedUser.id }) : [];
  const teamRecentInputRows =
    selectedTeam && selectedTeamUserIds.length > 0
      ? buildRecentInputRows(selectedTeamUserIds, { scope: "team", teamId: selectedTeam.id })
      : [];

  return (
    <div className="kpi-entry-layout">
      <FoldablePanel
        title="今日の入力"
        description={props.activeDate + " / " + (selectedUser?.name ?? "メンバー未選択")}
        icon={Edit3}
        open={todayInputOpen}
        onToggle={() => setTodayInputOpen((value) => !value)}
      >
        <label className="field">
          入力メンバー
          <select value={selectedUser?.id ?? ""} onChange={(event) => setSelectedUserId(event.target.value)}>
            {props.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        {selectedUser && (
          <label className="attendance-check">
            <input type="checkbox" checked={attendance?.attended ?? false} onChange={(event) => props.setAttendance(selectedUser.id, props.activeDate, event.target.checked)} />
            <span>出勤 ○ / 未出勤 ×</span>
            <strong>{attendance?.attended ? "○" : "×"}</strong>
          </label>
        )}
        <div className="kpi-input-list">
          {props.data.kpiItems.filter((item) => item.active && dailyInputKpiIds.includes(item.id)).map((item) => {
            const record = props.data.kpiRecords.find((entry) => entry.userId === selectedUser?.id && entry.kpiItemId === item.id && entry.date === props.activeDate);
            return (
              <label key={item.id} className="quick-input">
                <span><strong>{item.name}</strong><small>{item.description}</small></span>
                <div>
                  <input type="number" min="0" defaultValue={record?.actualValue ?? 0} onBlur={(event) => selectedUser && props.updateRecord(selectedUser.id, item.id, Number(event.target.value || 0))} />
                  <em>{item.unit}</em>
                </div>
              </label>
            );
          })}
        </div>
      </FoldablePanel>

      {selectedUser && (
        <div className="recent-kpi-grid">
          <RecentKpiTable title={selectedUser.name + " の最近の入力"} rows={recentInputRows} />
          {selectedTeam && <RecentKpiTable title={selectedTeam.name + " の最近の入力"} rows={teamRecentInputRows} />}
        </div>
      )}
    </div>
  );
}

function RecentKpiTable({
  title,
  rows,
}: {
  title: string;
  rows: {
    date: string;
    attendance: { actual: number; target: number };
    calls: { actual: number; target: number };
    ap: { actual: number; target: number };
    firstMeetings: { actual: number; target: number };
    reclose: { actual: number; target: number };
    orders: { actual: number; target: number };
    sales: { actual: number; target: number };
  }[];
}) {
  return (
    <section className="panel recent-kpi-panel">
      <div className="panel-title">
        <CalendarDays size={18} />
        <h3>{title}</h3>
      </div>
      <div className="recent-kpi-table">
        <div className="recent-kpi-row head">
          <span>日付</span>
          <span>出勤</span>
          <span>架電</span>
          <span>AP</span>
          <span>初回商談</span>
          <span>再クロ</span>
          <span>契約</span>
          <span>売上</span>
        </div>
        {rows.map((row) => (
          <div className="recent-kpi-row" key={row.date}>
            <strong>{formatDateJa(row.date)}</strong>
            <RecentKpiValueCell value={row.attendance} />
            <RecentKpiValueCell value={row.calls} />
            <RecentKpiValueCell value={row.ap} />
            <RecentKpiValueCell value={row.firstMeetings} />
            <RecentKpiValueCell value={row.reclose} />
            <RecentKpiValueCell value={row.orders} />
            <RecentKpiValueCell value={row.sales} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentKpiValueCell({ value }: { value: { actual: number; target: number } }) {
  const className = value.target === 0 ? "recent-kpi-even" : value.actual >= value.target ? "recent-kpi-over" : "recent-kpi-under";
  return <span className={className}>{numberFormat(value.actual)}/{numberFormat(value.target)}</span>;
}

function DealManagementSection(props: {
  data: AppData;
  users: User[];
  activeDate: string;
  periodType: FilterPeriodType;
  saveDeal: (form: FormData) => void;
  updateDeal: (dealId: string, patch: Partial<Deal>) => void;
  focusStage: DealStage | "all";
  forecastFocus: { ranks: DealRank[]; includeContract: boolean } | null;
  initialDetailDealId: string | null;
  focusKey: number;
  actionFocusKey: number;
}) {
  type DealDraft = {
    userId: string;
    stage: DealStage;
    rank: DealRank;
    title: string;
    description: string;
    amount: string;
    lastActionDate: string;
    nextActionDate: string;
  };
  const [dealTeamId, setDealTeamId] = useState("all");
  const [dealUserId, setDealUserId] = useState("all");
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [dealListOpen, setDealListOpen] = useState(true);
  const [dealCalendarOpen, setDealCalendarOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [dealSearch, setDealSearch] = useState("");
  const [dealSort, setDealSort] = useState(props.forecastFocus ? "rank-desc" : "updated-desc");
  const [dealStageFilter, setDealStageFilter] = useState<DealStage | "all">(props.forecastFocus ? "all" : props.focusStage);
  const [dealActionFilter, setDealActionFilter] = useState<"all" | "attention" | "overdue" | "today" | "week">(props.actionFocusKey > 0 ? "attention" : "all");
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dealDraft, setDealDraft] = useState<DealDraft | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [detailDealId, setDetailDealId] = useState<string | null>(props.initialDetailDealId);
  const [dealSaveMessage, setDealSaveMessage] = useState("");
  const dealSearchRef = useRef<HTMLInputElement>(null);
  const selectedUser = props.users[0];
  const availableDealTeams = props.data.teams.filter((team) => props.users.some((user) => user.teamId === team.id));
  const dealUsersForTeam = dealTeamId === "all" ? props.users : props.users.filter((user) => user.teamId === dealTeamId);
  const dealUserIds = dealUsersForTeam.filter((user) => dealUserId === "all" || user.id === dealUserId).map((user) => user.id);
  const dealPeriod = props.periodType === "all" ? null : getPeriodRange(props.periodType, props.activeDate);
  const dealSearchText = dealSearch.trim().toLowerCase();
  const today = todayDateKey();
  const week = getPeriodRange("week", today);
  const isTerminalDeal = (deal: Deal) => ["contract", "lost", "completed"].includes(deal.stage);
  const matchesForecastFocus = (deal: Deal) => {
    if (!props.forecastFocus) return true;
    if (!dealPeriod) return props.forecastFocus.includeContract && deal.stage === "contract" ? true : props.forecastFocus.ranks.includes(dealRank(deal));
    if (props.forecastFocus.includeContract && deal.stage === "contract") return inRange(dealDate(deal), dealPeriod.start, dealPeriod.end);
    const actionDate = nextActionDate(deal);
    return Boolean(actionDate) && props.forecastFocus.ranks.includes(dealRank(deal)) && inRange(actionDate, dealPeriod.start, dealPeriod.end);
  };
  const matchesDealSearch = (deal: Deal) => {
    const user = props.data.users.find((item) => item.id === deal.userId);
    return [
      deal.title,
      deal.description ?? "",
      dealRankLabels[dealRank(deal)],
      dealStageLabels[deal.stage],
      user?.name ?? "",
      dealDate(deal),
      nextActionDate(deal),
    ].join(" ")
      .toLowerCase()
      .includes(dealSearchText);
  };
  const matchesActionFilter = (deal: Deal, filter: typeof dealActionFilter) => {
    if (filter === "all") return true;
    if (isTerminalDeal(deal)) return false;
    const actionDate = nextActionDate(deal);
    if (!actionDate) return false;
    if (filter === "overdue") return actionDate < today;
    if (filter === "today") return actionDate === today;
    if (filter === "week") return actionDate >= today && actionDate <= week.end;
    return actionDate <= week.end;
  };
  const baseFilteredDeals = props.data.deals
    .filter((deal) => dealUserIds.includes(deal.userId))
    .filter((deal) => (props.forecastFocus ? matchesForecastFocus(deal) : !dealPeriod || inRange(dealDate(deal), dealPeriod.start, dealPeriod.end)))
    .filter((deal) => dealStageFilter === "all" || deal.stage === dealStageFilter)
    .filter(matchesDealSearch);
  const actionableDeals = baseFilteredDeals.filter((deal) => !isTerminalDeal(deal) && Boolean(nextActionDate(deal)));
  const actionCounts = {
    all: baseFilteredDeals.length,
    overdue: actionableDeals.filter((deal) => nextActionDate(deal) < today).length,
    today: actionableDeals.filter((deal) => nextActionDate(deal) === today).length,
    week: actionableDeals.filter((deal) => nextActionDate(deal) >= today && nextActionDate(deal) <= week.end).length,
  };

  const filteredDeals = baseFilteredDeals
    .filter((deal) => matchesActionFilter(deal, dealActionFilter))
    .sort((a, b) => {
      if (dealSort === "last-asc") return dealDate(a).localeCompare(dealDate(b));
      if (dealSort === "last-desc") return dealDate(b).localeCompare(dealDate(a));
      if (dealSort === "next-asc") return (nextActionDate(a) || "9999-12-31").localeCompare(nextActionDate(b) || "9999-12-31");
      if (dealSort === "next-desc") return (nextActionDate(b) || "0000-01-01").localeCompare(nextActionDate(a) || "0000-01-01");
      if (dealSort === "amount-desc") return b.amount - a.amount;
      if (dealSort === "amount-asc") return a.amount - b.amount;
      if (dealSort === "rank-desc") return dealRankSortScore[dealRank(b)] - dealRankSortScore[dealRank(a)] || b.updatedAt.localeCompare(a.updatedAt);
      if (dealSort === "rank-asc") return dealRankSortScore[dealRank(a)] - dealRankSortScore[dealRank(b)] || b.updatedAt.localeCompare(a.updatedAt);
      if (dealSort === "title-asc") return a.title.localeCompare(b.title, "ja");
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  const calendarRange = props.periodType === "all" ? getPeriodRange("month", props.activeDate) : getPeriodRange(props.periodType, props.activeDate);
  const calendarStart = props.periodType === "month" || props.periodType === "all" ? calendarRange.start : toDateKey(addDays(parseDateKey(calendarRange.start), -weekdayIndexFromMonday(calendarRange.start)));
  const calendarEnd = props.periodType === "month" || props.periodType === "all" ? calendarRange.end : toDateKey(addDays(parseDateKey(calendarRange.end), 6 - weekdayIndexFromMonday(calendarRange.end)));
  const calendarDays = eachDate(calendarStart, calendarEnd);
  const calendarEvents = filteredDeals.flatMap((deal) => {
    const user = props.data.users.find((item) => item.id === deal.userId);
    const lastDate = dealDate(deal);
    const nextDate = nextActionDate(deal);
    return [
      { id: deal.id + "-last", deal, date: lastDate, type: "last" as const, userName: user?.name ?? "未設定" },
      ...(nextDate ? [{ id: deal.id + "-next", deal, date: nextDate, type: "next" as const, userName: user?.name ?? "未設定" }] : []),
    ].filter((event) => inRange(event.date, calendarRange.start, calendarRange.end));
  });
  const calendarEventsByDate = new Map<string, typeof calendarEvents>();
  calendarEvents.forEach((event) => {
    calendarEventsByDate.set(event.date, [...(calendarEventsByDate.get(event.date) ?? []), event]);
  });
  const selectedCalendarEvents = selectedCalendarDate ? calendarEventsByDate.get(selectedCalendarDate) ?? [] : [];
  const selectedCalendarIndex = selectedCalendarDate ? calendarDays.findIndex((date) => date === selectedCalendarDate) : -1;
  const previousCalendarDate = selectedCalendarIndex > 0 ? calendarDays[selectedCalendarIndex - 1] : undefined;
  const nextCalendarDate = selectedCalendarIndex >= 0 && selectedCalendarIndex < calendarDays.length - 1 ? calendarDays[selectedCalendarIndex + 1] : undefined;
  const selectedDeal = props.data.deals.find((deal) => deal.id === detailDealId);
  const selectedDealUser = selectedDeal ? props.data.users.find((user) => user.id === selectedDeal.userId) : undefined;
  const selectedDealTeam = selectedDealUser ? props.data.teams.find((team) => team.id === selectedDealUser.teamId) : undefined;
  const selectedDealIndex = selectedDeal ? filteredDeals.findIndex((deal) => deal.id === selectedDeal.id) : -1;
  const previousDeal = selectedDealIndex > 0 ? filteredDeals[selectedDealIndex - 1] : undefined;
  const nextDeal = selectedDealIndex >= 0 && selectedDealIndex < filteredDeals.length - 1 ? filteredDeals[selectedDealIndex + 1] : undefined;
  function draftFromDeal(deal: Deal): DealDraft {
    return {
      userId: deal.userId,
      stage: deal.stage,
      rank: dealRank(deal),
      title: deal.title,
      description: deal.description ?? "",
      amount: String(deal.amount),
      lastActionDate: dealDate(deal),
      nextActionDate: nextActionDate(deal),
    };
  }
  function startDealEdit(deal: Deal) {
    setSelectedDealId(deal.id);
    setDetailDealId(null);
    setEditingDealId(deal.id);
    setDealDraft(draftFromDeal(deal));
  }
  function startDealDetailEdit(deal: Deal) {
    setSelectedDealId(deal.id);
    setEditingDealId(deal.id);
    setDealDraft(draftFromDeal(deal));
  }
  function openDealDetail(deal: Deal) {
    if (editingDealId === deal.id) return;
    setSelectedDealId(deal.id);
    setDetailDealId(deal.id);
    setDealSaveMessage("");
  }
  function updateDealDraft(patch: Partial<DealDraft>) {
    setDealDraft((draft) => (draft ? { ...draft, ...patch } : draft));
  }
  function cancelDealEdit() {
    setEditingDealId(null);
    setDealDraft(null);
  }
  function saveDealEdit(deal: Deal) {
    if (!dealDraft) return;
    const title = dealDraft.title.trim();
    if (!title) return;
    const lastActionDate = dealDraft.lastActionDate || dealDate(deal);
    props.updateDeal(deal.id, {
      userId: dealDraft.userId,
      stage: dealDraft.stage,
      rank: dealDraft.rank,
      title,
      description: dealDraft.description.trim(),
      amount: Number(dealDraft.amount || 0),
      lastActionDate,
      createdAt: dealDraft.stage === "completed" ? deal.createdAt : lastActionDate,
      completedAt: dealDraft.stage === "completed" ? lastActionDate : undefined,
      nextActionDate: dealDraft.nextActionDate || undefined,
    });
    cancelDealEdit();
    setDetailDealId(deal.id);
    setDealSaveMessage("保存しました");
  }
  function dealEditChanges(deal: Deal) {
    if (!dealDraft) return [];
    const changes: { label: string; before: string; after: string }[] = [];
    const beforeUser = props.data.users.find((user) => user.id === deal.userId)?.name ?? "未設定";
    const afterUser = props.data.users.find((user) => user.id === dealDraft.userId)?.name ?? "未設定";
    const comparisons = [
      { label: "担当", before: beforeUser, after: afterUser },
      { label: "状態", before: dealStageLabels[deal.stage], after: dealStageLabels[dealDraft.stage] },
      { label: "ランク", before: dealRankLabels[dealRank(deal)], after: dealRankLabels[dealDraft.rank] },
      { label: "案件名", before: deal.title, after: dealDraft.title.trim() },
      { label: "金額", before: numberFormat(deal.amount) + "万円", after: numberFormat(Number(dealDraft.amount || 0)) + "万円" },
      { label: "最終アクション日", before: dealDate(deal), after: dealDraft.lastActionDate || dealDate(deal) },
      { label: "次回アクション日", before: nextActionDate(deal) || "未設定", after: dealDraft.nextActionDate || "未設定" },
    ];
    comparisons.forEach((item) => {
      if (item.before !== item.after) changes.push(item);
    });
    const beforeDescription = deal.description ?? "";
    const afterDescription = dealDraft.description.trim();
    if (beforeDescription !== afterDescription) changes.push({ label: "案件内容", before: beforeDescription || "未入力", after: afterDescription || "未入力" });
    return changes;
  }

  return (
    <section className="deal-admin-stack">
      <div className="priority-actions" aria-label="案件管理の主要操作">
        <button type="button" onClick={() => { setDealListOpen(true); setDealActionFilter("attention"); }}>
          <Target size={17} />次回対応
        </button>
        <button type="button" onClick={() => setDealCalendarOpen(true)}>
          <CalendarDays size={17} />案件カレンダー
        </button>
        <button type="button" onClick={() => { setDealListOpen(true); requestAnimationFrame(() => dealSearchRef.current?.focus()); }}>
          <Search size={17} />検索
        </button>
        <button type="button" onClick={() => setDealFormOpen(true)}>
          <Plus size={17} />登録
        </button>
      </div>
      <FoldablePanel title="案件登録" description="新しい案件を追加" icon={Plus} open={dealFormOpen} onToggle={() => setDealFormOpen((value) => !value)}>
        <form
          className="form-grid deal-create-form"
          action={(formData) => {
            props.saveDeal(formData);
            setDealFormOpen(false);
            setDealListOpen(true);
          }}
        >
          <label className="field">
            案件名
            <input name="title" placeholder="案件名" />
          </label>
          <label className="field full">
            案件内容・メモ
            <textarea name="description" placeholder="案件内容・メモ" />
          </label>
          <label className="field">
            担当
            <select name="userId" defaultValue={selectedUser?.id}>
              {props.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label className="field">
            案件状態
            <select name="stage" defaultValue="ap">
              {Object.entries(dealStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            ランク
            <select name="rank" defaultValue="a">
              {Object.entries(dealRankLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            金額
            <input name="amount" type="number" min="0" placeholder="金額（万円）" />
          </label>
          <label className="field">最終アクション日<input name="lastActionDate" type="date" defaultValue={props.activeDate} /></label>
          <label className="field">次回アクション日<input name="nextActionDate" type="date" /></label>
          <button className="primary" type="submit"><Plus size={17} />案件を追加</button>
        </form>
      </FoldablePanel>

      <FoldablePanel title="案件カレンダー" description={calendarEvents.length + "件"} icon={CalendarDays} open={dealCalendarOpen} onToggle={() => setDealCalendarOpen((value) => !value)}>
        <div className="deal-calendar-head">
          <div>
            <strong>{calendarRange.start} - {calendarRange.end}</strong>
            <span>最終アクション・次回アクション案件</span>
          </div>
          <div className="deal-calendar-legend">
            <span><i className="last" />最終アクション</span>
            <span><i className="next" />次回アクション</span>
          </div>
        </div>
        <div className="deal-calendar-weekdays">
          {["月", "火", "水", "木", "金", "土", "日"].map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="deal-calendar-grid">
          {calendarDays.map((date) => {
            const events = calendarEventsByDate.get(date) ?? [];
            const isOutsideMonth = props.periodType === "month" || props.periodType === "all" ? monthKey(date) !== monthKey(props.activeDate) : !inRange(date, calendarRange.start, calendarRange.end);
            return (
              <article
                key={date}
                className={["deal-calendar-day", isOutsideMonth ? "muted" : "", date === today ? "today" : "", selectedCalendarDate === date ? "selected" : ""].filter(Boolean).join(" ")}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCalendarDate(date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCalendarDate(date);
                  }
                }}
              >
                <div className="deal-calendar-date">
                  <strong>{dateParts(date).day}</strong>
                  <span>{formatDateJa(date).replace(/^\d+\/\d+/, "")}</span>
                </div>
                <div className="deal-calendar-events">
                  {events.slice(0, 4).map((event) => (
                    <button key={event.id} className={"deal-calendar-event " + event.type} type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setDealListOpen(true); openDealDetail(event.deal); }}>
                      <em>{event.type === "last" ? "最終" : "次回"}</em>
                      <strong>{event.deal.title}</strong>
                      <span>{event.userName} / {dealStageLabels[event.deal.stage]}</span>
                    </button>
                  ))}
                  {events.length > 4 && <span className="deal-calendar-more">他 {events.length - 4}件</span>}
                </div>
              </article>
            );
          })}
        </div>
        {selectedCalendarDate && (
          <div className="heatmap-detail-layer deal-calendar-detail-layer" role="dialog" aria-modal="true" aria-label={selectedCalendarDate + "の案件カレンダー詳細"}>
            <button className="heatmap-detail-backdrop" type="button" aria-label="案件カレンダー詳細を閉じる" onClick={() => setSelectedCalendarDate(null)} />
            <section className="heatmap-detail-panel deal-calendar-detail-panel">
              <div className="heatmap-detail-head">
                <div>
                  <span>案件カレンダー詳細</span>
                  <h3>{formatDateJa(selectedCalendarDate)}</h3>
                  <p>{calendarRange.start} - {calendarRange.end} / {selectedCalendarEvents.length}件</p>
                </div>
                <button className="icon-button" type="button" title="閉じる" onClick={() => setSelectedCalendarDate(null)}>
                  <X size={17} />
                </button>
              </div>
              <div className="heatmap-detail-nav">
                <button type="button" disabled={!previousCalendarDate} onClick={() => previousCalendarDate && setSelectedCalendarDate(previousCalendarDate)}>
                  前の日
                </button>
                <span>{selectedCalendarIndex + 1} / {calendarDays.length}</span>
                <button type="button" disabled={!nextCalendarDate} onClick={() => nextCalendarDate && setSelectedCalendarDate(nextCalendarDate)}>
                  次の日
                </button>
              </div>
              {selectedCalendarEvents.length === 0 ? (
                <EmptyState text="この日の最終アクション・次回アクション案件はありません。" />
              ) : (
                <div className="deal-calendar-detail-list">
                  {selectedCalendarEvents.map((event) => (
                    <button
                      key={event.id}
                      className={"deal-calendar-date-item " + event.type}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(null);
                        setDealListOpen(true);
                        openDealDetail(event.deal);
                      }}
                    >
                      <em>{event.type === "last" ? "最終アクション" : "次回アクション"}</em>
                      <strong>{event.deal.title}</strong>
                      <span>{event.userName} / {dealStageLabels[event.deal.stage]} / {numberFormat(event.deal.amount)} 万円</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </FoldablePanel>

      <FoldablePanel title="案件一覧" description={filteredDeals.length + "件"} icon={FileText} open={dealListOpen} onToggle={() => setDealListOpen((value) => !value)}>
        <div className="deal-action-views" aria-label="次回アクション専用ビュー">
          <button className={dealActionFilter === "today" ? "active" : ""} type="button" onClick={() => setDealActionFilter("today")}>
            <strong>今日対応</strong>
            <span>{actionCounts.today}件</span>
          </button>
          <button className={dealActionFilter === "overdue" ? "active" : ""} type="button" onClick={() => setDealActionFilter("overdue")}>
            <strong>期限切れ</strong>
            <span>{actionCounts.overdue}件</span>
          </button>
          <button className={dealActionFilter === "week" ? "active" : ""} type="button" onClick={() => setDealActionFilter("week")}>
            <strong>今週対応</strong>
            <span>{actionCounts.week}件</span>
          </button>
          <button className={dealActionFilter === "all" ? "active" : ""} type="button" onClick={() => setDealActionFilter("all")}>
            <strong>全案件</strong>
            <span>{actionCounts.all}件</span>
          </button>
        </div>
        <div className="deal-filter-row">
          <label>チーム<select value={dealTeamId} onChange={(event) => { setDealTeamId(event.target.value); setDealUserId("all"); }}><option value="all">全チーム</option>{availableDealTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>メンバー<select value={dealUserId} onChange={(event) => setDealUserId(event.target.value)}><option value="all">全メンバー</option>{dealUsersForTeam.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label>状態<select value={dealStageFilter} onChange={(event) => setDealStageFilter(event.target.value as DealStage | "all")}><option value="all">全状態</option>{Object.entries(dealStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>次回対応<select value={dealActionFilter} onChange={(event) => setDealActionFilter(event.target.value as typeof dealActionFilter)}><option value="all">全て</option><option value="attention">要対応</option><option value="overdue">期限切れ</option><option value="today">今日対応</option><option value="week">今週対応</option></select></label>
          <label>検索<input ref={dealSearchRef} value={dealSearch} onChange={(event) => setDealSearch(event.target.value)} placeholder="案件名・内容・担当・日付" /></label>
          <label>ソート<select value={dealSort} onChange={(event) => setDealSort(event.target.value)}><option value="updated-desc">更新が新しい順</option><option value="last-desc">最終アクション日が新しい順</option><option value="last-asc">最終アクション日が古い順</option><option value="next-asc">次回アクション日が近い順</option><option value="next-desc">次回アクション日が遠い順</option><option value="rank-desc">ランクが高い順</option><option value="rank-asc">ランクが低い順</option><option value="amount-desc">金額が高い順</option><option value="amount-asc">金額が低い順</option><option value="title-asc">案件名順</option></select></label>
        </div>
        {selectedDeal && (
          <div className="deal-detail-layer" role="dialog" aria-modal="true" aria-label="案件の詳細">
            <button className="deal-detail-backdrop" type="button" aria-label="案件詳細を閉じる" onClick={() => setDetailDealId(null)} />
            <section className="deal-detail-panel">
              <div className="deal-detail-head">
                <div>
                  <span>案件詳細</span>
                  <h3>{selectedDeal.title}</h3>
                </div>
                <div>
                  <div className="deal-detail-nav">
                    <button className="secondary-action" type="button" disabled={!previousDeal} onClick={() => previousDeal && openDealDetail(previousDeal)}>
                      前の案件
                    </button>
                    <span>{selectedDealIndex >= 0 ? selectedDealIndex + 1 + " / " + filteredDeals.length : ""}</span>
                    <button className="secondary-action" type="button" disabled={!nextDeal} onClick={() => nextDeal && openDealDetail(nextDeal)}>
                      次の案件
                    </button>
                  </div>
                  {editingDealId !== selectedDeal.id && (
                    <button className="secondary-action" type="button" onClick={() => startDealDetailEdit(selectedDeal)}>
                      <Edit3 size={16} />編集
                    </button>
                  )}
                  <button className="icon-button" type="button" title="閉じる" onClick={() => setDetailDealId(null)}>
                    <X size={17} />
                  </button>
                </div>
              </div>
              {dealSaveMessage && <p className="deal-save-message">{dealSaveMessage}</p>}
              {editingDealId === selectedDeal.id ? (
                <div className="deal-detail-edit">
                  <label className="field full">案件名<input value={dealDraft?.title ?? selectedDeal.title} onChange={(event) => updateDealDraft({ title: event.currentTarget.value })} /></label>
                  <label className="field full">案件内容<textarea value={dealDraft?.description ?? selectedDeal.description ?? ""} onChange={(event) => updateDealDraft({ description: event.currentTarget.value })} /></label>
                  <label className="field">担当<select value={dealDraft?.userId ?? selectedDeal.userId} onChange={(event) => updateDealDraft({ userId: event.target.value })}>{props.users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                  <label className="field">状態<select value={dealDraft?.stage ?? selectedDeal.stage} onChange={(event) => updateDealDraft({ stage: event.target.value as DealStage })}>{Object.entries(dealStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="field">ランク<select value={dealDraft?.rank ?? dealRank(selectedDeal)} onChange={(event) => updateDealDraft({ rank: event.target.value as DealRank })}>{Object.entries(dealRankLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="field">金額<input type="number" min="0" value={dealDraft?.amount ?? String(selectedDeal.amount)} onChange={(event) => updateDealDraft({ amount: event.currentTarget.value })} /></label>
                  <label className="field">最終アクション日<input type="date" value={dealDraft?.lastActionDate ?? dealDate(selectedDeal)} onChange={(event) => updateDealDraft({ lastActionDate: event.currentTarget.value })} /></label>
                  <label className="field">次回アクション日<input type="date" value={dealDraft?.nextActionDate ?? nextActionDate(selectedDeal)} onChange={(event) => updateDealDraft({ nextActionDate: event.currentTarget.value })} /></label>
                  <div className="deal-change-preview full">
                    <strong>保存前の変更内容</strong>
                    {dealEditChanges(selectedDeal).length === 0 ? (
                      <span>変更はありません。</span>
                    ) : (
                      dealEditChanges(selectedDeal).map((change) => (
                        <span key={change.label}>
                          {change.label}: <em>{change.before}</em> → <b>{change.after}</b>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="deal-detail-edit-actions full">
                    <button className="primary" type="button" onClick={() => saveDealEdit(selectedDeal)}><Save size={17} />保存</button>
                    <button className="secondary-action" type="button" onClick={cancelDealEdit}><X size={16} />キャンセル</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="deal-detail-grid">
                    <span><strong>担当</strong>{selectedDealUser?.name ?? "未設定"}</span>
                    <span><strong>チーム</strong>{selectedDealTeam?.name ?? "未所属"}</span>
                    <span><strong>状態</strong>{dealStageLabels[selectedDeal.stage]}</span>
                    <span><strong>ランク</strong>{dealRankLabels[dealRank(selectedDeal)]}</span>
                    <span><strong>金額</strong>{numberFormat(selectedDeal.amount)} 万円</span>
                    <span><strong>最終アクション日</strong>{dealDate(selectedDeal)}</span>
                    <span><strong>次回アクション日</strong>{nextActionDate(selectedDeal) || "未設定"}</span>
                    <span><strong>更新日時</strong>{formatDateJa(selectedDeal.updatedAt.slice(0, 10))}</span>
                  </div>
                  <div className="deal-detail-description">
                    <strong>案件内容</strong>
                    <p>{selectedDeal.description || "内容未入力"}</p>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        <div className="deal-table">
          <div className="deal-table-head">
            <span>担当</span>
            <span>状態</span>
            <span>ランク</span>
            <span>案件名</span>
            <span>案件内容</span>
            <span>金額</span>
            <span>最終アクション日</span>
            <span>次回アクション日</span>
            <span>編集</span>
          </div>
          {filteredDeals.length === 0 && <EmptyState text="条件に一致する案件はありません。" />}
          {filteredDeals.map((deal) => {
            const user = props.data.users.find((item) => item.id === deal.userId);
            const editing = editingDealId === deal.id;
            const editChanges = editing ? dealEditChanges(deal) : [];
            return (
              <article
                key={deal.id}
                className={[editing ? "deal-row editing" : "deal-row", selectedDealId === deal.id ? "selected" : ""].filter(Boolean).join(" ")}
                role={editing ? undefined : "button"}
                tabIndex={editing ? undefined : 0}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button,input,select,textarea")) return;
                  openDealDetail(deal);
                }}
                onKeyDown={(event) => {
                  if (editing) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDealDetail(deal);
                  }
                }}
              >
                {editing ? (
                  <>
                    <select value={dealDraft?.userId ?? deal.userId} onChange={(event) => updateDealDraft({ userId: event.target.value })} aria-label="担当">
                      {props.users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <select value={dealDraft?.stage ?? deal.stage} onChange={(event) => updateDealDraft({ stage: event.target.value as DealStage })} aria-label="状態">
                      {Object.entries(dealStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={dealDraft?.rank ?? dealRank(deal)} onChange={(event) => updateDealDraft({ rank: event.target.value as DealRank })} aria-label="ランク">
                      {Object.entries(dealRankLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <input aria-label="案件名" value={dealDraft?.title ?? deal.title} onChange={(event) => updateDealDraft({ title: event.currentTarget.value })} />
                    <textarea aria-label="案件内容" value={dealDraft?.description ?? deal.description ?? ""} onChange={(event) => updateDealDraft({ description: event.currentTarget.value })} />
                    <input aria-label="金額" type="number" min="0" value={dealDraft?.amount ?? String(deal.amount)} onChange={(event) => updateDealDraft({ amount: event.currentTarget.value })} />
                    <input aria-label="最終アクション日" type="date" value={dealDraft?.lastActionDate ?? dealDate(deal)} onChange={(event) => updateDealDraft({ lastActionDate: event.currentTarget.value })} />
                    <input aria-label="次回アクション日" type="date" value={dealDraft?.nextActionDate ?? nextActionDate(deal)} onChange={(event) => updateDealDraft({ nextActionDate: event.currentTarget.value })} />
                    <div className="deal-change-preview">
                      <strong>保存前の変更内容</strong>
                      {editChanges.length === 0 ? (
                        <span>変更はありません。</span>
                      ) : (
                        editChanges.map((change) => (
                          <span key={change.label}>
                            {change.label}: <em>{change.before}</em> → <b>{change.after}</b>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="deal-edit-actions">
                      <button className="deal-edit-button done" type="button" title="保存" onClick={() => saveDealEdit(deal)}><Save size={16} /></button>
                      <button className="deal-edit-button cancel" type="button" title="キャンセル" onClick={cancelDealEdit}><X size={16} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{user?.name ?? "未設定"}</span>
                    <span className="deal-stage-pill">{dealStageLabels[deal.stage]}</span>
                    <span className="deal-stage-pill">{dealRankLabels[dealRank(deal)]}</span>
                    <strong className="deal-cell-main">{deal.title}</strong>
                    <p>{deal.description || "内容未入力"}</p>
                    <span className="deal-value">{numberFormat(deal.amount)} 万円</span>
                    <span>{dealDate(deal)}</span>
                    <span>{nextActionDate(deal) || "未設定"}</span>
                    <div className="deal-row-actions">
                      <button className="deal-view-button" type="button" title="詳細を見る" onClick={() => openDealDetail(deal)}><Eye size={16} /><span>詳細</span></button>
                      <button className="deal-edit-button" type="button" title="案件を編集" onClick={() => startDealEdit(deal)}><Edit3 size={16} /></button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </FoldablePanel>
    </section>
  );
}

function TrainingScheduleView(props: {
  data: AppData;
  saveSchedule: (dealId: string, periodStart: string, periodEnd: string, sessions: TrainingSession[]) => void;
  deleteSchedule: (dealId: string) => void;
}) {
  const deals = [...props.data.deals].sort((left, right) => left.title.localeCompare(right.title, "ja"));
  const contractedDeals = deals.filter((deal) => deal.stage === "contract");
  const firstScheduledDealId = props.data.trainingSchedules.find((schedule) => contractedDeals.some((deal) => deal.id === schedule.dealId))?.dealId;
  const initialDealId = firstScheduledDealId ?? contractedDeals[0]?.id ?? deals[0]?.id ?? "";
  const initialSchedule = props.data.trainingSchedules.find((item) => item.dealId === initialDealId);
  const [selectedDealId, setSelectedDealId] = useState(initialDealId);
  const [dealSearch, setDealSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [displayMode, setDisplayMode] = useState<"overview" | "detail">("overview");
  const [overviewListOpen, setOverviewListOpen] = useState(true);
  const activeDealId = deals.some((deal) => deal.id === selectedDealId) ? selectedDealId : deals[0]?.id ?? "";
  const selectedDeal = deals.find((deal) => deal.id === activeDealId);
  const schedule = props.data.trainingSchedules.find((item) => item.dealId === activeDealId);
  const today = todayDateKey();
  const defaultStartMonth = monthKey(today);
  const defaultEndMonth = monthKey(toDateKey(addMonths(parseDateKey(defaultStartMonth + "-01"), 5)));
  const [periodDraft, setPeriodDraft] = useState({
    dealId: initialDealId,
    start: initialSchedule ? monthKey(initialSchedule.periodStart) : defaultStartMonth,
    end: initialSchedule ? monthKey(initialSchedule.periodEnd) : defaultEndMonth,
    dirty: false,
  });
  const hasPeriodDraft = periodDraft.dealId === activeDealId && periodDraft.dirty;
  const periodStartMonth = hasPeriodDraft ? periodDraft.start : schedule ? monthKey(schedule.periodStart) : defaultStartMonth;
  const periodEndMonth = hasPeriodDraft ? periodDraft.end : schedule ? monthKey(schedule.periodEnd) : defaultEndMonth;
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState(String(nextTrainingSessionNumber(initialSchedule?.sessions ?? [])));
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStartDate, setSessionStartDate] = useState(today);
  const [sessionEndDate, setSessionEndDate] = useState(today);
  const [sessionNotes, setSessionNotes] = useState("");
  const [formError, setFormError] = useState("");

  const sessions = [...(schedule?.sessions ?? [])].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.sessionNumber - right.sessionNumber ||
      left.title.localeCompare(right.title, "ja"),
  );
  const timelineMonths = schedule ? trainingMonthKeys(schedule.periodStart, schedule.periodEnd) : [];
  const lastSession = [...sessions]
    .filter((session) => session.endDate <= today)
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
  const nextSession = sessions
    .filter((session) => session.startDate >= today)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
  const selectedUser = selectedDeal ? props.data.users.find((user) => user.id === selectedDeal.userId) : undefined;
  const filterSourceDeals = displayMode === "overview" ? contractedDeals : deals;
  const availableTeams = props.data.teams.filter((team) =>
    filterSourceDeals.some((deal) => props.data.users.some((user) => user.id === deal.userId && user.teamId === team.id)),
  );
  const availableMembers = props.data.users
    .filter((user) => (teamFilter === "all" || user.teamId === teamFilter) && filterSourceDeals.some((deal) => deal.userId === user.id))
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const scopedDeals = filterSourceDeals.filter((deal) => {
    const user = props.data.users.find((item) => item.id === deal.userId);
    return (teamFilter === "all" || user?.teamId === teamFilter) && (memberFilter === "all" || deal.userId === memberFilter);
  });
  const dealSearchText = dealSearch.trim().toLowerCase();
  const filteredDeals = dealSearchText
    ? scopedDeals.filter((deal) => {
        const user = props.data.users.find((item) => item.id === deal.userId);
        const text = [
          deal.title,
          deal.description ?? "",
          user?.name ?? "",
          dealStageLabels[deal.stage],
          dealRankLabels[dealRank(deal)],
        ].join(" ");
        return text.toLowerCase().includes(dealSearchText);
      })
    : scopedDeals;
  const filteredActiveDealId = filteredDeals.some((deal) => deal.id === activeDealId) ? activeDealId : "";
  const trainingOverviewRows = filteredDeals
    .map((deal) => {
      const item = props.data.trainingSchedules.find((trainingSchedule) => trainingSchedule.dealId === deal.id);
      const user = props.data.users.find((candidate) => candidate.id === deal.userId);
      const team = props.data.teams.find((candidate) => candidate.id === user?.teamId);
      const orderedSessions = [...(item?.sessions ?? [])].sort(
        (left, right) => left.startDate.localeCompare(right.startDate) || left.sessionNumber - right.sessionNumber,
      );
      const overviewLastSession = [...orderedSessions]
        .filter((trainingSession) => trainingSession.endDate <= today)
        .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
      const overviewNextSession = orderedSessions
        .filter((trainingSession) => trainingSession.startDate >= today)
        .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
      return {
        deal,
        schedule: item,
        userName: user?.name ?? "担当未設定",
        teamName: team?.name ?? "未所属",
        lastSession: overviewLastSession,
        nextSession: overviewNextSession,
      };
    })
    .sort(
      (left, right) =>
        left.teamName.localeCompare(right.teamName, "ja") ||
        left.userName.localeCompare(right.userName, "ja") ||
        (left.nextSession?.startDate ?? "9999-12-31").localeCompare(right.nextSession?.startDate ?? "9999-12-31") ||
        left.deal.title.localeCompare(right.deal.title, "ja"),
    );
  const overviewScheduledDealCount = trainingOverviewRows.filter((row) => row.schedule).length;
  const overviewSessionCount = trainingOverviewRows.reduce((total, row) => total + (row.schedule?.sessions.length ?? 0), 0);
  const overviewTimelineDeals = trainingOverviewRows.filter((row) => row.schedule && row.schedule.sessions.length > 0);
  const overviewTimelineStart = overviewTimelineDeals
    .map((row) => row.schedule?.periodStart ?? "")
    .filter(Boolean)
    .sort()[0];
  const overviewTimelineEnd = overviewTimelineDeals
    .map((row) => row.schedule?.periodEnd ?? "")
    .filter(Boolean)
    .sort()
    .at(-1);
  const overviewTimelineMonths = overviewTimelineStart && overviewTimelineEnd ? trainingMonthKeys(overviewTimelineStart, overviewTimelineEnd) : [];
  const overviewTimelineDealRows = overviewTimelineDeals
    .map((row) => {
      const orderedSessions = [...(row.schedule?.sessions ?? [])].sort(
        (left, right) =>
          left.startDate.localeCompare(right.startDate) ||
          left.sessionNumber - right.sessionNumber ||
          left.title.localeCompare(right.title, "ja"),
      );
      return { ...row, trainingSessions: orderedSessions };
    })
    .sort(
      (left, right) =>
        (left.nextSession?.startDate ?? left.trainingSessions[0]?.startDate ?? "9999-12-31").localeCompare(
          right.nextSession?.startDate ?? right.trainingSessions[0]?.startDate ?? "9999-12-31",
        ) ||
        left.teamName.localeCompare(right.teamName, "ja") ||
        left.userName.localeCompare(right.userName, "ja") ||
        left.deal.title.localeCompare(right.deal.title, "ja"),
    );
  const overviewTimelineSessionCount = overviewTimelineDealRows.reduce((total, row) => total + row.trainingSessions.length, 0);
  const currentTimelineMonths = displayMode === "overview" ? overviewTimelineMonths : timelineMonths;
  const currentTimelineLabelWidth = displayMode === "overview" ? 260 : 190;
  const currentTimelineRows = displayMode === "overview"
    ? overviewTimelineDealRows.map((row) => ({
        key: row.deal.id,
        deal: row.deal,
        userName: row.userName,
        teamName: row.teamName,
        schedule: row.schedule,
        trainingSessions: row.trainingSessions,
        nextSessionId: row.nextSession?.id,
      }))
    : sessions.map((trainingSession) => ({
        key: trainingSession.id,
        deal: selectedDeal,
        userName: selectedUser?.name ?? "担当未設定",
        teamName: "",
        schedule,
        trainingSessions: [trainingSession],
        nextSessionId: nextSession?.id,
      }));

  function resetSessionForm(nextNumber = nextTrainingSessionNumber(sessions)) {
    setEditingSessionId(null);
    setSessionNumber(String(nextNumber));
    setSessionTitle("");
    setSessionStartDate(today);
    setSessionEndDate(today);
    setSessionNotes("");
    setFormError("");
  }

  function selectDeal(dealId: string) {
    const nextSchedule = props.data.trainingSchedules.find((item) => item.dealId === dealId);
    setSelectedDealId(dealId);
    setPeriodDraft({
      dealId,
      start: nextSchedule ? monthKey(nextSchedule.periodStart) : defaultStartMonth,
      end: nextSchedule ? monthKey(nextSchedule.periodEnd) : defaultEndMonth,
      dirty: false,
    });
    resetSessionForm(nextTrainingSessionNumber(nextSchedule?.sessions ?? []));
  }

  function changeDisplayMode(nextMode: "overview" | "detail") {
    if (nextMode === "overview" && selectedDeal?.stage !== "contract") {
      const nextDeal = contractedDeals.find((deal) => {
        const user = props.data.users.find((item) => item.id === deal.userId);
        return (teamFilter === "all" || user?.teamId === teamFilter) && (memberFilter === "all" || deal.userId === memberFilter);
      }) ?? contractedDeals[0];
      if (nextDeal) selectDeal(nextDeal.id);
    }
    setDisplayMode(nextMode);
  }

  function changeTeamFilter(teamId: string) {
    setTeamFilter(teamId);
    setMemberFilter("all");
    const currentUser = props.data.users.find((user) => user.id === selectedDeal?.userId);
    if (teamId === "all" || currentUser?.teamId === teamId) return;
    const nextDeal = filterSourceDeals.find((deal) => props.data.users.some((user) => user.id === deal.userId && user.teamId === teamId));
    if (nextDeal) selectDeal(nextDeal.id);
  }

  function changeMemberFilter(userId: string) {
    setMemberFilter(userId);
    if (userId === "all" || selectedDeal?.userId === userId) return;
    const nextDeal = filterSourceDeals.find((deal) => deal.userId === userId);
    if (nextDeal) selectDeal(nextDeal.id);
  }

  function savePeriod() {
    if (!selectedDeal) return;
    if (!periodStartMonth || !periodEndMonth || periodStartMonth > periodEndMonth) {
      setFormError("研修期間の開始月と終了月を正しく設定してください。");
      return;
    }
    props.saveSchedule(selectedDeal.id, periodStartMonth + "-01", monthEndKey(periodEndMonth), sessions);
    setPeriodDraft({ dealId: selectedDeal.id, start: periodStartMonth, end: periodEndMonth, dirty: false });
    setFormError("");
  }

  function deleteCurrentSchedule() {
    if (!selectedDeal || !schedule) return;
    const sessionLabel = schedule.sessions.length > 0 ? "・登録済み研修" + schedule.sessions.length + "回" : "";
    if (!confirmDelete("案件「" + selectedDeal.title + "」の研修スケジュール" + sessionLabel)) return;
    props.deleteSchedule(selectedDeal.id);
    setPeriodDraft({
      dealId: selectedDeal.id,
      start: defaultStartMonth,
      end: defaultEndMonth,
      dirty: false,
    });
    resetSessionForm(1);
    changeDisplayMode("overview");
  }

  function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeal || !sessionTitle.trim()) return;
    const parsedSessionNumber = Number(sessionNumber);
    if (!Number.isFinite(parsedSessionNumber) || parsedSessionNumber < 1) {
      setFormError("研修回数は1以上の数字で入力してください。");
      return;
    }
    if (sessions.some((session) => session.id !== editingSessionId && session.sessionNumber === Math.floor(parsedSessionNumber))) {
      setFormError("同じ研修回数が登録されています。別の回数を入力してください。");
      return;
    }
    if (!sessionStartDate || !sessionEndDate || sessionStartDate > sessionEndDate) {
      setFormError("研修日の開始日と終了日を正しく設定してください。");
      return;
    }
    const now = new Date().toISOString();
    const nextSession: TrainingSession = {
      id: editingSessionId ?? id("training-session"),
      sessionNumber: Math.floor(parsedSessionNumber),
      title: sessionTitle.trim(),
      startDate: sessionStartDate,
      endDate: sessionEndDate,
      notes: sessionNotes.trim(),
      updatedAt: now,
    };
    const nextSessions = editingSessionId
      ? sessions.map((session) => (session.id === editingSessionId ? nextSession : session))
      : [...sessions, nextSession];
    const nextStartMonth = [periodStartMonth || monthKey(sessionStartDate), monthKey(sessionStartDate)].sort()[0];
    const nextEndMonth = [periodEndMonth || monthKey(sessionEndDate), monthKey(sessionEndDate)].sort().at(-1) ?? monthKey(sessionEndDate);
    setPeriodDraft({ dealId: selectedDeal.id, start: nextStartMonth, end: nextEndMonth, dirty: false });
    props.saveSchedule(selectedDeal.id, nextStartMonth + "-01", monthEndKey(nextEndMonth), nextSessions);
    resetSessionForm(nextTrainingSessionNumber(nextSessions));
  }

  function editSession(session: TrainingSession) {
    setEditingSessionId(session.id);
    setSessionNumber(String(session.sessionNumber));
    setSessionTitle(session.title);
    setSessionStartDate(session.startDate);
    setSessionEndDate(session.endDate);
    setSessionNotes(session.notes ?? "");
    setFormError("");
  }

  function deleteSession(session: TrainingSession) {
    if (!selectedDeal || !schedule || !confirmDelete("第" + session.sessionNumber + "回「" + session.title + "」を削除しますか？")) return;
    const nextSessions = sessions.filter((item) => item.id !== session.id);
    props.saveSchedule(selectedDeal.id, schedule.periodStart, schedule.periodEnd, nextSessions);
    if (editingSessionId === session.id) resetSessionForm(nextTrainingSessionNumber(nextSessions));
  }

  if (deals.length === 0) {
    return (
      <section className="panel training-empty-panel">
        <GraduationCap size={26} />
        <h2>研修スケジュール</h2>
        <p>研修対象の案件がありません。先に案件管理から案件を登録してください。</p>
      </section>
    );
  }

  return (
    <div className="training-view">
      <section className="panel training-control-panel">
        <div className="training-control-heading">
          <div>
            <span><GraduationCap size={17} />研修対象</span>
            <strong>{displayMode === "overview" ? "契約済み案件の研修状況" : "案件ごとの研修計画"}</strong>
            <p>
              {displayMode === "overview"
                ? "契約済み案件の研修設定状況を、チーム・メンバーごとに確認できます。"
                : "選択した案件の研修期間と各回の予定を確認・編集できます。"}
            </p>
          </div>
          <div className="training-view-switch" role="tablist" aria-label="研修スケジュールの表示切替">
            <button
              className={displayMode === "overview" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={displayMode === "overview"}
              onClick={() => changeDisplayMode("overview")}
            >
              <Users size={16} />全案件一覧
            </button>
            <button
              className={displayMode === "detail" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={displayMode === "detail"}
              onClick={() => changeDisplayMode("detail")}
            >
              <FileText size={16} />各案件詳細
            </button>
          </div>
        </div>
        <div className="training-control-grid">
          <div className={"training-deal-picker " + (displayMode === "overview" ? "overview" : "detail")}>
            <label className="field">
              チーム
              <select value={teamFilter} onChange={(event) => changeTeamFilter(event.target.value)}>
                <option value="all">全チーム</option>
                {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="field">
              メンバー
              <select value={memberFilter} onChange={(event) => changeMemberFilter(event.target.value)}>
                <option value="all">全メンバー</option>
                {availableMembers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="field">
              案件検索
              <span className="training-search-control">
                <Search size={16} />
                <input
                  value={dealSearch}
                  onChange={(event) => setDealSearch(event.target.value)}
                  placeholder="案件名・担当・状態・内容で検索"
                />
                <em>{filteredDeals.length}件</em>
              </span>
            </label>
            {displayMode === "detail" && (
              <label className="field training-deal-select">
                案件
                <select value={filteredActiveDealId} onChange={(event) => event.target.value && selectDeal(event.target.value)}>
                  {filteredDeals.length === 0 && <option value="">該当する案件がありません</option>}
                  {filteredDeals.length > 0 && !filteredActiveDealId && <option value="">検索結果から案件を選択</option>}
                  {filteredDeals.map((deal) => {
                    const user = props.data.users.find((item) => item.id === deal.userId);
                    return <option key={deal.id} value={deal.id}>{deal.title} / {user?.name ?? "担当未設定"} / {dealStageLabels[deal.stage]}</option>;
                  })}
                </select>
              </label>
            )}
          </div>
          {displayMode === "detail" && (
            <>
              <label className="field">
                研修開始月
                <input
                  type="month"
                  value={periodStartMonth}
                  onChange={(event) => setPeriodDraft({ dealId: activeDealId, start: event.target.value, end: periodEndMonth, dirty: true })}
                />
              </label>
              <label className="field">
                研修終了月
                <input
                  type="month"
                  value={periodEndMonth}
                  onChange={(event) => setPeriodDraft({ dealId: activeDealId, start: periodStartMonth, end: event.target.value, dirty: true })}
                />
              </label>
              <button className="primary training-period-save" type="button" onClick={savePeriod}>
                <Save size={17} />研修期間を保存
              </button>
              {schedule && (
                <button className="training-schedule-delete" type="button" onClick={deleteCurrentSchedule}>
                  <Trash2 size={17} />スケジュールを削除
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {displayMode === "overview" ? (
        <FoldablePanel
          title="チーム・メンバー別 契約済み案件一覧"
          description={trainingOverviewRows.length + "案件 / 研修設定 " + overviewScheduledDealCount + "件 / 全" + overviewSessionCount + "回"}
          icon={Users}
          open={overviewListOpen}
          onToggle={() => setOverviewListOpen((value) => !value)}
        >
          <div className="training-overview-panel-body">
            {trainingOverviewRows.length === 0 ? (
              <EmptyState text="選択中の条件に該当する案件はありません。" />
            ) : (
              <div className="training-overview-table">
                <div className="training-overview-head" aria-hidden="true">
                  <span>チーム</span>
                  <span>メンバー</span>
                  <span>案件</span>
                  <span>研修期間</span>
                  <span>回数</span>
                  <span>最終研修日</span>
                  <span>次回研修日</span>
                  <span />
                </div>
                {trainingOverviewRows.map((row, index) => {
                  const previousRow = trainingOverviewRows[index - 1];
                  const startsTeam = !previousRow || previousRow.teamName !== row.teamName;
                  const startsMember = startsTeam || previousRow.userName !== row.userName;
                  return (
                    <button
                      className={[
                        "training-overview-row",
                        startsTeam ? "team-start" : "",
                        startsMember ? "member-start" : "",
                        row.schedule ? "" : "unscheduled",
                        row.deal.id === activeDealId ? "active" : "",
                      ].filter(Boolean).join(" ")}
                      type="button"
                      key={row.deal.id}
                      aria-label={row.deal.title + "の研修スケジュールを表示"}
                      onClick={() => selectDeal(row.deal.id)}
                    >
                      <span>
                        <small>チーム</small>
                        <strong>{row.teamName}</strong>
                      </span>
                      <span>
                        <small>メンバー</small>
                        <strong>{row.userName}</strong>
                      </span>
                      <span className="training-overview-deal">
                        <small>案件</small>
                        <strong>{row.deal.title}</strong>
                        <span className="training-overview-badges">
                          <em>{dealStageLabels[row.deal.stage]}</em>
                          <em className={row.schedule ? "scheduled" : "unscheduled"}>{row.schedule ? "研修設定済" : "研修未設定"}</em>
                        </span>
                      </span>
                      <span>
                        <small>研修期間</small>
                        <strong className={row.schedule ? "" : "training-overview-unset"}>
                          {row.schedule ? monthLabel(monthKey(row.schedule.periodStart)) + " ～ " + monthLabel(monthKey(row.schedule.periodEnd)) : "未設定"}
                        </strong>
                      </span>
                      <span>
                        <small>回数</small>
                        <strong>{row.schedule?.sessions.length ?? 0}回</strong>
                      </span>
                      <span>
                        <small>最終研修日</small>
                        <strong>{row.lastSession ? trainingDateLabel(row.lastSession.endDate) : "実績なし"}</strong>
                      </span>
                      <span>
                        <small>次回研修日</small>
                        <strong>{row.nextSession ? trainingDateLabel(row.nextSession.startDate) : "未設定"}</strong>
                      </span>
                      <span className="training-overview-open" title="研修スケジュールを表示"><Eye size={17} /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </FoldablePanel>
      ) : (
        <section className="training-summary-grid">
        <article className="training-summary-primary">
          <span>選択中の案件</span>
          <strong>{selectedDeal?.title ?? "未選択"}</strong>
          <small>{selectedUser?.name ?? "担当未設定"} / {selectedDeal ? dealStageLabels[selectedDeal.stage] : "状態未設定"}</small>
        </article>
        <article>
          <span>研修期間</span>
          <strong>{schedule ? monthLabel(monthKey(schedule.periodStart)) + " ～ " + monthLabel(monthKey(schedule.periodEnd)) : "未設定"}</strong>
          <small>{timelineMonths.length > 0 ? timelineMonths.length + "か月 / 全" + sessions.length + "回の研修計画" : "開始月と終了月を設定"}</small>
        </article>
        <article>
          <span>最終研修日</span>
          <strong>{lastSession ? trainingDateLabel(lastSession.endDate) : "実績なし"}</strong>
          <small>{lastSession ? "第" + lastSession.sessionNumber + "回 " + lastSession.title : "過去の研修予定はありません"}</small>
        </article>
        <article className="training-summary-next">
          <span>次回研修日</span>
          <strong>{nextSession ? trainingDateLabel(nextSession.startDate) : "未設定"}</strong>
          <small>{nextSession ? "第" + nextSession.sessionNumber + "回 " + nextSession.title : "今後の研修予定はありません"}</small>
        </article>
        </section>
      )}

      <section className={"panel training-timeline-panel " + (displayMode === "overview" ? "readonly overview" : "editable")}>
        <div className="panel-title training-panel-title">
          <CalendarDays size={18} />
          <h3>{displayMode === "overview" ? "全案件の研修スケジュール" : "研修スケジュール"}</h3>
          <span>
            {displayMode === "overview"
              ? overviewTimelineMonths.length > 0
                ? overviewTimelineDealRows.length + "案件 / 全" + overviewTimelineSessionCount + "回 / " + monthLabel(overviewTimelineMonths[0]) + " ～ " + monthLabel(overviewTimelineMonths.at(-1) ?? overviewTimelineMonths[0])
                : "研修予定が登録されている案件はありません"
              : (selectedDeal?.title ?? "案件未選択") + " / " + (schedule ? monthLabel(monthKey(schedule.periodStart)) + " ～ " + monthLabel(monthKey(schedule.periodEnd)) : "期間未設定")}
          </span>
        </div>
        {displayMode === "detail" && !schedule ? (
          <EmptyState text="研修期間を保存すると、ここに月別スケジュールが表示されます。" />
        ) : currentTimelineRows.length === 0 || currentTimelineMonths.length === 0 ? (
          <EmptyState text={displayMode === "overview" ? "研修予定が登録されている案件はありません。各案件詳細から研修内容を追加してください。" : "研修内容はまだ登録されていません。下の入力欄から最初の研修を追加してください。"} />
        ) : (
          <div className="training-timeline-scroll">
            <div
              className={"training-timeline " + (displayMode === "overview" ? "readonly overview" : "editable")}
              style={{ minWidth: Math.max(760, currentTimelineLabelWidth + currentTimelineMonths.length * 96) }}
            >
              <div className="training-timeline-head">
                <strong>研修内容</strong>
                <div className="training-month-grid" style={{ gridTemplateColumns: `repeat(${currentTimelineMonths.length}, minmax(96px, 1fr))` }}>
                  {currentTimelineMonths.map((month, index) => (
                    <span key={month} className={month === monthKey(today) ? "current" : ""}>
                      {index === 0 || month.endsWith("-01") ? monthLabel(month) : Number(month.slice(5)) + "月"}
                    </span>
                  ))}
                </div>
              </div>
              {currentTimelineRows.map((timelineRow) => {
                const primarySession = timelineRow.trainingSessions[0];
                if (!primarySession) return null;
                const schedulePeriod = timelineRow.schedule
                  ? monthLabel(monthKey(timelineRow.schedule.periodStart)) + " ～ " + monthLabel(monthKey(timelineRow.schedule.periodEnd))
                  : "期間未設定";
                return (
                  <div className="training-timeline-row" key={timelineRow.key}>
                    <div className="training-session-label">
                      {displayMode === "overview" ? (
                        <>
                          <strong>{timelineRow.deal?.title ?? "案件未設定"}</strong>
                          <span>{timelineRow.userName} / 全{timelineRow.trainingSessions.length}回</span>
                          <span>{schedulePeriod}</span>
                        </>
                      ) : (
                        <>
                          <strong><em>第{primarySession.sessionNumber}回</em>{primarySession.title}</strong>
                          <span>{trainingDateLabel(primarySession.startDate)}{primarySession.endDate !== primarySession.startDate ? " - " + trainingDateLabel(primarySession.endDate) : ""}</span>
                        </>
                      )}
                    </div>
                    <div
                      className="training-month-track"
                      style={{
                        gridTemplateColumns: `repeat(${currentTimelineMonths.length}, minmax(96px, 1fr))`,
                        backgroundSize: `${100 / Math.max(currentTimelineMonths.length, 1)}% 100%`,
                      }}
                    >
                      {timelineRow.trainingSessions.map((session) => {
                        const firstMonth = currentTimelineMonths[0];
                        const rawStart = monthOffset(firstMonth, monthKey(session.startDate));
                        const rawEnd = monthOffset(firstMonth, monthKey(session.endDate));
                        const startIndex = Math.max(rawStart, 0);
                        const endIndex = Math.min(rawEnd, currentTimelineMonths.length - 1);
                        const isOutside = endIndex < 0 || startIndex >= currentTimelineMonths.length;
                        const status = session.id === timelineRow.nextSessionId ? "next" : session.endDate < today ? "completed" : "future";
                        const barTitle = (timelineRow.deal?.title ?? "案件未設定") + " / 第" + session.sessionNumber + "回 " + session.title;
                        if (isOutside) return null;
                        if (displayMode === "detail") {
                          return (
                            <button
                              className={"training-session-bar " + status}
                              style={{ gridColumn: `${startIndex + 1} / span ${endIndex - startIndex + 1}` }}
                              type="button"
                              title={"第" + session.sessionNumber + "回 " + session.title + "を編集"}
                              onClick={() => editSession(session)}
                              key={session.id}
                            >
                              第{session.sessionNumber}回 {session.title}
                            </button>
                          );
                        }
                        return (
                          <span
                            className={"training-session-bar " + status}
                            style={{ gridColumn: `${startIndex + 1} / span ${endIndex - startIndex + 1}` }}
                            title={barTitle}
                            key={session.id}
                          >
                            第{session.sessionNumber}回 {session.title}
                          </span>
                        );
                      })}
                    </div>
                    {displayMode === "detail" && (
                      <div className="training-row-actions">
                        <button className="icon-button" type="button" title="研修を編集" onClick={() => editSession(primarySession)}><Edit3 size={15} /></button>
                        <button className="icon-button danger" type="button" title="研修を削除" onClick={() => deleteSession(primarySession)}><Trash2 size={15} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {currentTimelineRows.length > 0 && currentTimelineMonths.length > 0 && (
          <div className="training-timeline-legend">
            <span><i className="completed" />実施済み</span>
            <span><i className="next" />次回研修</span>
            <span><i className="future" />今後の予定</span>
          </div>
        )}
      </section>

      {displayMode === "detail" && (
        <section className="panel training-editor-panel">
        <div className="panel-title training-panel-title">
          <Edit3 size={18} />
          <h3>{editingSessionId ? "研修内容を編集" : "研修内容を追加"}</h3>
          {editingSessionId && <span>変更後は保存ボタンを押してください</span>}
        </div>
        <form className="training-session-form" onSubmit={saveSession}>
          <label className="field training-number-field">
            研修回数
            <span className="training-number-input">
              <em>第</em>
              <input type="number" min="1" step="1" value={sessionNumber} onChange={(event) => setSessionNumber(event.target.value)} required />
              <em>回</em>
            </span>
          </label>
          <label className="field training-title-field">
            研修名
            <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="例: AI基礎・導入研修" required />
          </label>
          <label className="field">
            開始日
            <input type="date" value={sessionStartDate} onChange={(event) => {
              const value = event.target.value;
              setSessionStartDate(value);
              if (!sessionEndDate || sessionEndDate < value) setSessionEndDate(value);
            }} required />
          </label>
          <label className="field">
            終了日
            <input type="date" value={sessionEndDate} min={sessionStartDate} onChange={(event) => setSessionEndDate(event.target.value)} required />
          </label>
          <label className="field training-notes-field">
            研修内容・メモ
            <textarea value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} placeholder="研修テーマ、担当講師、準備物など" />
          </label>
          {formError && <p className="training-form-error">{formError}</p>}
          <div className="training-editor-actions">
            <button className="primary" type="submit"><Save size={17} />{editingSessionId ? "変更を保存" : "研修を追加"}</button>
            {editingSessionId && <button className="secondary-action" type="button" onClick={() => resetSessionForm()}><X size={16} />キャンセル</button>}
          </div>
        </form>
        </section>
      )}
    </div>
  );
}

function ReportsViewCompact(props: {
  data: AppData;
  currentUser: User;
  activeDate: string;
  kpiItems: KpiItem[];
  saveReport: (type: ReportType, content: ReportContent, nextKpis: ReportKpiPlan[]) => Promise<void>;
  updateReport: (reportId: string, content: ReportContent, nextKpis: ReportKpiPlan[]) => Promise<void>;
  addComment: (reportId: string, comment: string) => void;
  deleteComment: (commentId: string) => void;
  markReportRead: (reportId: string, userId: string) => void;
  accessibleUsers: User[];
  focusReportId: string | null;
  notifyMissingReportUser: (userId: string, date: string) => void;
  canNotifyMissingReports: boolean;
}) {
  const focusedReport = props.focusReportId ? props.data.reports.find((item) => item.id === props.focusReportId) : undefined;
  const [type, setType] = useState<ReportType>("daily");
  const [listType, setListType] = useState<ReportType>(focusedReport?.reportType ?? "daily");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(focusedReport?.id ?? null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [composeResetKey, setComposeResetKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reportSort, setReportSort] = useState<ReportSortKey>("updated_desc");
  const [reportDateFilter, setReportDateFilter] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [missingReportsOpen, setMissingReportsOpen] = useState(false);
  const [reminderHistoryOpen, setReminderHistoryOpen] = useState(false);
  const reportSearchRef = useRef<HTMLInputElement>(null);
  const range = getReportRange(type, props.activeDate);
  const dailyReportRange = getReportRange("daily", props.activeDate);
  const canComment = props.currentUser.role === "admin" || props.currentUser.role === "manager" || props.currentUser.role === "leader";
  const canDeleteComment = canComment;
  const missingReportUsers = props.accessibleUsers.filter(
    (user) =>
      !props.data.reports.some(
        (report) => report.userId === user.id && report.reportType === "daily" && report.periodStart === dailyReportRange.start,
      ),
  );
  const reportReminderLogs = props.data.auditLogs
    .filter((log) => log.action === "日報催促" && log.targetType === "report")
    .slice(0, 10);
  const reportSearchText = reportSearch.trim().toLowerCase();
  const reportList = sortedReports(
    props.data.reports
      .filter((report) => report.reportType === listType && props.accessibleUsers.some((user) => user.id === report.userId))
      .filter((report) => !reportDateFilter || inRange(reportDateFilter, report.periodStart, report.periodEnd))
      .filter((report) => {
        if (!reportSearchText) return true;
        const user = props.data.users.find((item) => item.id === report.userId);
        const text = [
          user?.name,
          reportLabels[report.reportType],
          report.periodStart,
          report.periodEnd,
          report.content.activity,
          report.content.result,
          report.content.issue,
          report.content.nextPlan,
          report.content.insight,
        ].join(" ");
        return text.toLowerCase().includes(reportSearchText);
      }),
    reportSort,
    props.data.users,
    props.data.reportComments,
    props.currentUser.id,
  );
  const selectedReport = reportList.find((report) => report.id === selectedReportId) ?? reportList[0];

  useEffect(() => {
    if (selectedReport && !isReportRead(selectedReport, props.currentUser.id)) props.markReportRead(selectedReport.id, props.currentUser.id);
  }, [selectedReport, props]);

  return (
    <div className="reports-stack">
      <div className="priority-actions" aria-label="日報の主要操作">
        <button type="button" onClick={() => setComposerOpen(true)}>
          <FileText size={17} />提出
        </button>
        <button type="button" onClick={() => { setComposerOpen(false); setEditingReportId(null); }}>
          <MessageSquare size={17} />一覧
        </button>
        <button type="button" onClick={() => requestAnimationFrame(() => reportSearchRef.current?.focus())}>
          <Search size={17} />検索
        </button>
      </div>
      <section className={composerOpen ? "panel report-editor-panel open" : "panel report-editor-panel"}>
        <button className="report-editor-toggle" type="button" onClick={() => setComposerOpen((value) => !value)}>
          <span>
            <FileText size={18} />
            <span>
              <strong>日報・週報・月報を書く</strong>
              <small>{range.start} - {range.end}</small>
            </span>
          </span>
          <em>{composerOpen ? "閉じる" : "記入する"}</em>
        </button>
        {composerOpen && (
          <div className="report-editor-body">
            <div className="segmented wide-tabs">
              {(["daily", "weekly", "monthly"] as ReportType[]).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{reportLabels[item]}</button>)}
            </div>
            <div className="report-period">{range.start} - {range.end}</div>
            <ReportEditor
              key={"compose-" + type + "-" + range.start + "-" + props.currentUser.id + "-" + composeResetKey}
              initialContent={blankContent()}
              initialNextKpis={[]}
              kpiItems={props.kpiItems}
              reportType={type}
              activeDate={props.activeDate}
              submitLabel="提出"
              resetAfterSave
              onSave={async (content, nextKpis) => {
                await props.saveReport(type, content, nextKpis);
                setComposeResetKey((value) => value + 1);
                setComposerOpen(false);
              }}
            />
          </div>
        )}
      </section>

      <FoldablePanel
        title="日報未提出者"
        description={missingReportUsers.length + "名 / " + dailyReportRange.start}
        icon={FileText}
        open={missingReportsOpen}
        onToggle={() => setMissingReportsOpen((value) => !value)}
      >
        {missingReportUsers.length === 0 ? (
          <EmptyState text="対象者は全員、日報を提出済みです。" />
        ) : (
          <div className="missing-report-list">
            {missingReportUsers.map((user) => (
              <article key={user.id}>
                <strong>{user.name}</strong>
                <span>{props.data.teams.find((team) => team.id === user.teamId)?.name ?? "未所属"}</span>
                <em>{dailyReportRange.start} 未提出</em>
                {props.canNotifyMissingReports && (
                  <button className="secondary-action" type="button" onClick={() => props.notifyMissingReportUser(user.id, dailyReportRange.start)}>
                    通知する
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </FoldablePanel>

      <FoldablePanel
        title="日報催促履歴"
        description={reportReminderLogs.length + "件"}
        icon={History}
        open={reminderHistoryOpen}
        onToggle={() => setReminderHistoryOpen((value) => !value)}
      >
        {reportReminderLogs.length === 0 ? (
          <EmptyState text="日報催促の履歴はまだありません。" />
        ) : (
          <div className="reminder-history-list">
            {reportReminderLogs.map((log) => {
              const actor = props.data.users.find((user) => user.id === log.actorId);
              const target = props.data.users.find((user) => user.id === log.targetId);
              return (
                <article key={log.id}>
                  <strong>{target?.name ?? "対象不明"}</strong>
                  <span>{actor?.name ?? "不明なユーザー"} が通知</span>
                  <em>{new Date(log.createdAt).toLocaleString("ja-JP")}</em>
                  <p>{log.summary}</p>
                </article>
              );
            })}
          </div>
        )}
      </FoldablePanel>

      <div className="report-reader-grid">
        <section className="panel">
          <div className="panel-title"><MessageSquare size={18} /><h3>提出一覧</h3></div>
          <div className="segmented wide-tabs report-list-tabs">
            {(["daily", "weekly", "monthly"] as ReportType[]).map((item) => (
              <button
                key={item}
                className={listType === item ? "active" : ""}
                onClick={() => {
                  setListType(item);
                  setSelectedReportId(null);
                  setEditingReportId(null);
                }}
                type="button"
              >
                {reportLabels[item]}
              </button>
            ))}
          </div>
          <div className="report-list-controls">
            <label className="report-sort-control report-search-control">
              <span>検索</span>
              <input ref={reportSearchRef} value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="本文・メンバー名" />
            </label>
            <label className="report-sort-control">
              <span>日付</span>
              <input type="date" value={reportDateFilter} onChange={(event) => setReportDateFilter(event.target.value)} />
            </label>
            <label className="report-sort-control">
              <span>ソート</span>
              <select value={reportSort} onChange={(event) => setReportSort(event.target.value as ReportSortKey)}>
                <option value="updated_desc">更新が新しい順</option>
                <option value="period_desc">対象期間が新しい順</option>
                <option value="period_asc">対象期間が古い順</option>
                <option value="member_asc">メンバー名順</option>
                <option value="unread_first">未読を上に表示</option>
                <option value="comments_desc">コメントが多い順</option>
              </select>
            </label>
            {reportDateFilter && <button className="secondary-action" type="button" onClick={() => setReportDateFilter("")}>全日表示</button>}
          </div>
          <div className="report-list">
            {reportList.length === 0 && <EmptyState text={reportLabels[listType] + "はまだ提出されていません。"} />}
            {reportList.map((report) => {
              const user = props.data.users.find((item) => item.id === report.userId);
              const comments = props.data.reportComments.filter((comment) => comment.reportId === report.id);
              const read = isReportRead(report, props.currentUser.id);
              return (
                <button key={report.id} className={selectedReport?.id === report.id ? "report-card active" : "report-card"} onClick={() => { setSelectedReportId(report.id); setEditingReportId(null); }} type="button">
                  <div className="report-head">
                    <div><strong>{user?.name}</strong><span>{reportLabels[report.reportType]} / {reportExactPeriod(report)}</span></div>
                    <em className={read ? "read" : "unread"}>{read ? "既読" : "未読"}</em>
                  </div>
                  <p>{report.content.activity}</p>
                  <small>{comments.length > 0 ? "コメント " + comments.length + "件" : "コメントなし"}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel report-detail-panel">
          <div className="panel-title panel-title-with-action">
            <FileText size={18} />
            <h3>{editingReportId === selectedReport?.id ? "提出内容を修正" : "提出内容"}</h3>
            {selectedReport && (
              <button className="secondary-action" type="button" onClick={() => setEditingReportId(editingReportId === selectedReport.id ? null : selectedReport.id)}>
                {editingReportId === selectedReport.id ? "表示に戻る" : "修正"}
              </button>
            )}
          </div>
          {!selectedReport && <EmptyState text="確認する日報を選択してください。" />}
          {selectedReport && editingReportId === selectedReport.id ? (
            <ReportEditor
              key={"edit-" + selectedReport.id}
              initialContent={selectedReport.content}
              initialNextKpis={selectedReport.nextKpis ?? []}
              kpiItems={props.kpiItems}
              reportType={selectedReport.reportType}
              activeDate={selectedReport.periodStart}
              submitLabel="修正を保存"
              onSave={async (content, nextKpis) => {
                await props.updateReport(selectedReport.id, content, nextKpis);
                setEditingReportId(null);
              }}
            />
          ) : selectedReport && (
            <ReportDetail
              report={selectedReport}
              user={props.data.users.find((item) => item.id === selectedReport.userId)}
              kpiItems={props.kpiItems}
              comments={props.data.reportComments.filter((comment) => comment.reportId === selectedReport.id)}
              canComment={canComment}
              canDeleteComment={canDeleteComment}
              currentUserId={props.currentUser.id}
              addComment={props.addComment}
              deleteComment={props.deleteComment}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ReportsView(props: {
  data: AppData;
  currentUser: User;
  activeDate: string;
  kpiItems: KpiItem[];
  saveReport: (type: ReportType, content: ReportContent, nextKpis: ReportKpiPlan[]) => Promise<void>;
  updateReport: (reportId: string, content: ReportContent, nextKpis: ReportKpiPlan[]) => Promise<void>;
  addComment: (reportId: string, comment: string) => void;
  deleteComment: (commentId: string) => void;
  markReportRead: (reportId: string, userId: string) => void;
  accessibleUsers: User[];
}) {
  const [type, setType] = useState<ReportType>("daily");
  const [listType, setListType] = useState<ReportType>("daily");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [composeResetKey, setComposeResetKey] = useState(0);
  const range = getReportRange(type, props.activeDate);
  const canComment = props.currentUser.role === "admin" || props.currentUser.role === "manager" || props.currentUser.role === "leader";
  const canDeleteComment = canComment;
  const reportList = props.data.reports
    .filter((report) => report.reportType === listType && props.accessibleUsers.some((user) => user.id === report.userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selectedReport = reportList.find((report) => report.id === selectedReportId) ?? reportList[0];

  useEffect(() => {
    if (selectedReport && !isReportRead(selectedReport, props.currentUser.id)) props.markReportRead(selectedReport.id, props.currentUser.id);
  }, [selectedReport, props]);

  return (
    <div className="reports-stack">
      <section className="panel report-editor-panel open">
        <div className="report-editor-body">
          <div className="segmented wide-tabs">
            {(["daily", "weekly", "monthly"] as ReportType[]).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{reportLabels[item]}</button>)}
          </div>
          <div className="report-period">{range.start} - {range.end}</div>
          <ReportEditor
            key={"compose-" + type + "-" + range.start + "-" + props.currentUser.id + "-" + composeResetKey}
            initialContent={blankContent()}
            initialNextKpis={[]}
            kpiItems={props.kpiItems}
            reportType={type}
            activeDate={props.activeDate}
            submitLabel="提出"
            resetAfterSave
            onSave={async (content, nextKpis) => {
              await props.saveReport(type, content, nextKpis);
              setComposeResetKey((value) => value + 1);
            }}
          />
        </div>
      </section>

      <div className="report-reader-grid">
        <section className="panel">
          <div className="panel-title"><MessageSquare size={18} /><h3>提出一覧</h3></div>
          <div className="segmented wide-tabs report-list-tabs">
            {(["daily", "weekly", "monthly"] as ReportType[]).map((item) => (
              <button
                key={item}
                className={listType === item ? "active" : ""}
                onClick={() => {
                  setListType(item);
                  setSelectedReportId(null);
                  setEditingReportId(null);
                }}
                type="button"
              >
                {reportLabels[item]}
              </button>
            ))}
          </div>
          <div className="report-list">
            {reportList.length === 0 && <EmptyState text={reportLabels[listType] + "はまだ提出されていません。"} />}
            {reportList.map((report) => {
              const user = props.data.users.find((item) => item.id === report.userId);
              const comments = props.data.reportComments.filter((comment) => comment.reportId === report.id);
              const read = isReportRead(report, props.currentUser.id);
              return (
                <button key={report.id} className={selectedReport?.id === report.id ? "report-card active" : "report-card"} onClick={() => { setSelectedReportId(report.id); setEditingReportId(null); }} type="button">
                  <div className="report-head">
                    <div><strong>{user?.name}</strong><span>{reportLabels[report.reportType]} / {reportExactPeriod(report)}</span></div>
                    <em className={read ? "read" : "unread"}>{read ? "既読" : "未読"}</em>
                  </div>
                  <p>{report.content.activity}</p>
                  <small>{comments.length > 0 ? "コメント " + comments.length + "件" : "コメントなし"}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel report-detail-panel">
          <div className="panel-title panel-title-with-action">
            <FileText size={18} />
            <h3>{editingReportId === selectedReport?.id ? "提出内容を修正" : "提出内容"}</h3>
            {selectedReport && (
              <button className="secondary-action" type="button" onClick={() => setEditingReportId(editingReportId === selectedReport.id ? null : selectedReport.id)}>
                {editingReportId === selectedReport.id ? "表示に戻る" : "修正"}
              </button>
            )}
          </div>
          {!selectedReport && <EmptyState text="確認する日報を選択してください。" />}
          {selectedReport && editingReportId === selectedReport.id ? (
            <ReportEditor
              key={"edit-" + selectedReport.id}
              initialContent={selectedReport.content}
              initialNextKpis={selectedReport.nextKpis ?? []}
              kpiItems={props.kpiItems}
              reportType={selectedReport.reportType}
              activeDate={selectedReport.periodStart}
              submitLabel="修正を保存"
              onSave={async (content, nextKpis) => {
                await props.updateReport(selectedReport.id, content, nextKpis);
                setEditingReportId(null);
              }}
            />
          ) : selectedReport && (
            <ReportDetail
              report={selectedReport}
              user={props.data.users.find((item) => item.id === selectedReport.userId)}
              kpiItems={props.kpiItems}
              comments={props.data.reportComments.filter((comment) => comment.reportId === selectedReport.id)}
              canComment={canComment}
              canDeleteComment={canDeleteComment}
              currentUserId={props.currentUser.id}
              addComment={props.addComment}
              deleteComment={props.deleteComment}
            />
          )}
        </section>
      </div>
    </div>
  );
}

void ReportsView;

function InsightsView(props: {
  data: AppData;
  currentUser: User;
  saveInsight: (input: InsightInput, insightId?: string) => void;
  deleteInsight: (insightId: string) => void;
  focusInsightId: string | null;
}) {
  const focusedInsight = props.focusInsightId ? props.data.qualitativeInsights.find((item) => item.id === props.focusInsightId) : undefined;
  const [category, setCategory] = useState<QualitativeInsightCategory>(focusedInsight?.category ?? "customer_voice");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeResetKey, setComposeResetKey] = useState(0);
  const [editingInsightId, setEditingInsightId] = useState<string | null>(null);
  const [insightSearch, setInsightSearch] = useState("");
  const [insightUserFilter, setInsightUserFilter] = useState("all");
  const [insightMonthFilter, setInsightMonthFilter] = useState("");
  const [insightGroupFilter, setInsightGroupFilter] = useState("all");
  const [expandedInsightIds, setExpandedInsightIds] = useState<string[]>(props.focusInsightId ? [props.focusInsightId] : []);
  const [expandAllInsights, setExpandAllInsights] = useState(false);
  const guide = insightCategoryGuides[category];
  const searchText = insightSearch.trim().toLowerCase();
  const categoryInsights = props.data.qualitativeInsights.filter((insight) => insight.category === category);
  const insightGroups = Array.from(
    categoryInsights.reduce((groups, insight) => {
      const group = insightSourceParts(insight.source)[0] ?? "未設定";
      return groups.set(group, (groups.get(group) ?? 0) + 1);
    }, new Map<string, number>()),
  );
  const activeGroupFilter = insightGroups.some(([group]) => group === insightGroupFilter) ? insightGroupFilter : "all";
  const insightList = categoryInsights
    .filter((insight) => activeGroupFilter === "all" || (insightSourceParts(insight.source)[0] ?? "未設定") === activeGroupFilter)
    .filter((insight) => insightUserFilter === "all" || insight.userId === insightUserFilter)
    .filter((insight) => !insightMonthFilter || monthKey(insight.date) === insightMonthFilter)
    .filter((insight) => {
      if (!searchText) return true;
      const user = props.data.users.find((item) => item.id === insight.userId);
      return [insight.title, insight.detail, insight.source ?? "", user?.name ?? "", insight.date].join(" ").toLowerCase().includes(searchText);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  function exportInsightsCsv() {
    const rows = [
      ["category", "date", "user", "title", "source", "detail"],
      ...insightList.map((insight) => [
        insightCategoryLabels[insight.category],
        insight.date,
        props.data.users.find((item) => item.id === insight.userId)?.name ?? "",
        insight.title,
        insight.source ?? "",
        insight.detail,
      ]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "qualitative-insights.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="reports-stack">
      <div className="segmented wide-tabs insight-tabs" role="tablist" aria-label="定性情報の区分">
        {insightCategories.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={category === item}
            className={"insight-tab-" + item + (category === item ? " active" : "")}
            onClick={() => {
              setCategory(item);
              setEditingInsightId(null);
              setInsightGroupFilter("all");
            }}
          >
            {insightCategoryLabels[item]}
            <em>{props.data.qualitativeInsights.filter((insight) => insight.category === item).length}</em>
          </button>
        ))}
      </div>

      <section className={composerOpen ? "panel report-editor-panel open" : "panel report-editor-panel"}>
        <button className="report-editor-toggle" type="button" onClick={() => setComposerOpen((value) => !value)}>
          <span>
            <Lightbulb size={18} />
            <span>
              <strong>定性情報を入力する</strong>
              <small>{insightCategoryLabels[category]}</small>
            </span>
          </span>
          <em>{composerOpen ? "閉じる" : "記入する"}</em>
        </button>
        {composerOpen && (
          <div className="report-editor-body">
            <p className="insight-guide">{guide.description}</p>
            <InsightEditor
              key={"compose-" + category + "-" + composeResetKey}
              initial={{ category, date: todayDateKey(), title: "", detail: "", source: "" }}
              submitLabel="共有する"
              onSave={(input) => {
                props.saveInsight(input);
                setCategory(input.category);
                setComposeResetKey((value) => value + 1);
                setComposerOpen(false);
              }}
            />
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title panel-title-with-action">
          <MessageSquare size={18} />
          <h3>{insightCategoryLabels[category]}<small className="insight-count">{insightList.length}件</small></h3>
          <div className="insight-head-actions">
            <button className="secondary-action" type="button" onClick={() => { setExpandAllInsights((value) => !value); setExpandedInsightIds([]); }}>
              {expandAllInsights ? "すべて閉じる" : "すべて開く"}
            </button>
            <button className="secondary-action" type="button" onClick={exportInsightsCsv} disabled={insightList.length === 0}>
              <Download size={15} />CSV
            </button>
          </div>
        </div>
        {insightGroups.length > 1 && (
          <div className="insight-group-filter" aria-label="拠点・情報源で絞り込み">
            <button type="button" className={activeGroupFilter === "all" ? "active" : ""} onClick={() => setInsightGroupFilter("all")}>
              すべて<em>{categoryInsights.length}</em>
            </button>
            {insightGroups.map(([group, count]) => (
              <button key={group} type="button" className={activeGroupFilter === group ? "active" : ""} onClick={() => setInsightGroupFilter(group)}>
                <i style={{ background: insightChipColor(group) }} />{group}<em>{count}</em>
              </button>
            ))}
          </div>
        )}
        <div className="report-list-controls insight-list-controls">
          <label className="report-sort-control report-search-control">
            <span>検索</span>
            <input value={insightSearch} onChange={(event) => setInsightSearch(event.target.value)} placeholder="件名・内容・顧客名" />
          </label>
          <label className="report-sort-control">
            <span>月</span>
            <input type="month" value={insightMonthFilter} onChange={(event) => setInsightMonthFilter(event.target.value)} />
          </label>
          <label className="report-sort-control">
            <span>投稿者</span>
            <select value={insightUserFilter} onChange={(event) => setInsightUserFilter(event.target.value)}>
              <option value="all">全員</option>
              {props.data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
        </div>
        <div className="report-list insight-list">
          {insightList.length === 0 && (
            <EmptyState text={categoryInsights.length === 0 ? insightCategoryLabels[category] + "はまだ共有されていません。" : "条件に合う定性情報はありません。"} />
          )}
          {insightList.map((insight) => {
            const user = props.data.users.find((item) => item.id === insight.userId);
            const canEdit = props.currentUser.role === "admin" || insight.userId === props.currentUser.id;
            const focused = insight.id === props.focusInsightId;
            const editing = editingInsightId === insight.id;
            const expanded = editing || (expandAllInsights ? !expandedInsightIds.includes(insight.id) : expandedInsightIds.includes(insight.id));
            const detailText = insight.detail.startsWith(insight.title) ? insight.detail.slice(insight.title.length).replace(/^[:：\s]+/, "") : insight.detail;
            const sourceParts = insightSourceParts(insight.source).filter((part) => {
              const owners = part.match(/^担当[:：]\s*(.+)$/)?.[1];
              return !owners || !owners.split("、").every((owner) => (user?.name ?? "").includes(owner.trim()));
            });
            const { month, day } = dateParts(insight.date);
            return (
              <article
                key={insight.id}
                className={"report-card insight-card insight-" + insight.category + (expanded ? " expanded" : "") + (focused ? " active" : "") + (editing ? " editing" : "")}
              >
                {editingInsightId === insight.id ? (
                  <InsightEditor
                    initial={{ category: insight.category, date: insight.date, title: insight.title, detail: insight.detail, source: insight.source ?? "" }}
                    submitLabel="修正を保存"
                    onCancel={() => setEditingInsightId(null)}
                    onSave={(input) => {
                      props.saveInsight(input, insight.id);
                      setCategory(input.category);
                      setEditingInsightId(null);
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="insight-card-toggle"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedInsightIds((ids) => (ids.includes(insight.id) ? ids.filter((item) => item !== insight.id) : [...ids, insight.id]))}
                    >
                      <strong>{insight.title}</strong>
                      <ChevronDown size={16} />
                    </button>
                    <div className="insight-chips">
                      <span className="insight-chip insight-chip-date"><CalendarDays size={12} />{month}/{day}</span>
                      <span className="insight-chip"><Users size={12} />{user?.name ?? "未設定"}</span>
                      {sourceParts.map((part, index) => (
                        <span key={part} className="insight-chip" style={index === 0 ? { color: insightChipColor(part), borderColor: hexToRgba(insightChipColor(part), 0.35), background: hexToRgba(insightChipColor(part), 0.08) } : undefined}>
                          {part}
                        </span>
                      ))}
                    </div>
                    {detailText && <p className="insight-detail">{detailText}</p>}
                    {expanded && (canEdit || insight.updatedAt !== insight.createdAt) && (
                      <div className="insight-card-footer">
                        <small>{insight.updatedAt !== insight.createdAt ? new Date(insight.updatedAt).toLocaleString("ja-JP") + " 更新" : ""}</small>
                        {canEdit && (
                          <div className="insight-card-actions">
                            <button className="secondary-action" type="button" onClick={() => setEditingInsightId(insight.id)}><Edit3 size={14} />修正</button>
                            <button className="secondary-action insight-delete" type="button" onClick={() => props.deleteInsight(insight.id)}><Trash2 size={14} />削除</button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InsightEditor({ initial, submitLabel, onSave, onCancel }: {
  initial: InsightInput;
  submitLabel: string;
  onSave: (input: InsightInput) => void;
  onCancel?: () => void;
}) {
  const [input, setInput] = useState<InsightInput>(initial);
  const guide = insightCategoryGuides[input.category];
  const canSubmit = Boolean(input.title.trim() && input.detail.trim() && input.date);
  return (
    <form
      className="insight-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSave(input);
      }}
    >
      <div className="insight-form-grid">
        <label className="field">区分
          <select value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value as QualitativeInsightCategory })}>
            {insightCategories.map((item) => <option key={item} value={item}>{insightCategoryLabels[item]}</option>)}
          </select>
        </label>
        <label className="field">日付
          <input type="date" value={input.date} onChange={(event) => setInput({ ...input, date: event.target.value })} required />
        </label>
        <label className="field">{guide.sourceLabel}（任意）
          <input value={input.source} onChange={(event) => setInput({ ...input, source: event.target.value })} />
        </label>
      </div>
      <label className="field">件名
        <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} placeholder="ひとことで分かる要約" required />
      </label>
      <label className="field">内容
        <textarea value={input.detail} onChange={(event) => setInput({ ...input, detail: event.target.value })} placeholder={guide.detailPlaceholder} required />
      </label>
      <div className="insight-form-actions">
        <button className="primary" type="submit" disabled={!canSubmit}><Save size={18} />{submitLabel}</button>
        {onCancel && <button className="secondary-action" type="button" onClick={onCancel}>キャンセル</button>}
      </div>
    </form>
  );
}

function feedbackMarkdown(items: string[]) {
  return items.map((item) => "- " + item).join("\n");
}

function ReportAiFeedbackPanel({ feedback }: { feedback: ReportAiFeedback }) {
  return (
    <section className="report-ai-feedback">
      <div className="report-ai-feedback-head">
        <span><Sparkles size={17} />AIフィードバック</span>
        <em>{feedback.source === "ai" ? "AI評価" : "基準ベース評価"}</em>
      </div>
      {feedback.specificPoints.length > 0 && (
        <article className="report-ai-feedback-specific">
          <h5>個別FB</h5>
          <MessageResponse className="report-ai-feedback-text">{feedbackMarkdown(feedback.specificPoints)}</MessageResponse>
        </article>
      )}
      <div className="report-ai-feedback-grid">
        {feedback.goodPoints.length > 0 && (
          <article className="good">
            <h5>良い点</h5>
            <MessageResponse className="report-ai-feedback-text">{feedbackMarkdown(feedback.goodPoints)}</MessageResponse>
          </article>
        )}
        {feedback.missingPoints.length > 0 && (
          <article className="missing">
            <h5>不足点</h5>
            <MessageResponse className="report-ai-feedback-text">{feedbackMarkdown(feedback.missingPoints)}</MessageResponse>
          </article>
        )}
        <article className="improvement">
          <h5>改善点</h5>
          <MessageResponse className="report-ai-feedback-text">{feedbackMarkdown(feedback.improvementPoints)}</MessageResponse>
        </article>
      </div>
      <small>評価観点: 具体性・数値根拠 / 進捗と目標差 / 顧客反応・案件確度 / 次のアクション / 組織への展開価値</small>
    </section>
  );
}

function ReportDetail({ report, user, kpiItems, comments, canComment, canDeleteComment, currentUserId, addComment, deleteComment }: {
  report: Report;
  user?: User;
  kpiItems: KpiItem[];
  comments: ReportComment[];
  canComment: boolean;
  canDeleteComment: boolean;
  currentUserId: string;
  addComment: (reportId: string, comment: string) => void;
  deleteComment: (commentId: string) => void;
}) {
  const nextRange = nextReportRange(report.reportType, report.periodStart);
  return (
    <div className="report-detail">
      <div className="report-detail-head">
        <div><strong>{user?.name ?? "未設定"}</strong><span>{reportLabels[report.reportType]} / {reportPeriodLabel(report)} / {reportExactPeriod(report)}</span></div>
        <em className={isReportRead(report, currentUserId) ? "read" : "unread"}>{isReportRead(report, currentUserId) ? "既読" : "未読"}</em>
      </div>
      {([
        ["activity", "活動内容"],
        ["result", "達成した成果"],
        ["issue", "課題・困りごと"],
        ["nextPlan", "次の予定・目標"],
        ["insight", "所感・気づき"],
      ] as [keyof ReportContent, string][]).map(([key, label]) => (
        <section key={key}><h4>{label}</h4><p>{report.content[key] || "未記入"}</p></section>
      ))}
      <section>
        <h4>{nextKpiTitle(report.reportType)} / {nextRange.start} - {nextRange.end}</h4>
        <div className="report-kpi-summary">
          {(report.nextKpis ?? []).map((plan) => {
            const item = kpiItems.find((kpi) => kpi.id === plan.kpiItemId);
            return <span key={plan.kpiItemId}><strong>{item?.name ?? "KPI"}</strong>{numberFormat(plan.targetValue)} {item?.unit ?? ""}</span>;
          })}
        </div>
      </section>
      {report.aiFeedback && <ReportAiFeedbackPanel feedback={report.aiFeedback} />}
      <div className="comment-list">
        {comments.map((comment) => (
          <article key={comment.id}>
            <MessageSquare size={14} />
            <p>{comment.comment}</p>
            {canDeleteComment && (
              <button type="button" title="管理コメントを削除" onClick={() => deleteComment(comment.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </article>
        ))}
        {comments.length === 0 && <small>コメントなし</small>}
      </div>
      {canComment && <CommentForm reportId={report.id} addComment={addComment} />}
    </div>
  );
}

function ReportEditor({ initialContent, initialNextKpis, kpiItems, reportType, activeDate, onSave, submitLabel = "保存", resetAfterSave = false }: {
  initialContent: ReportContent;
  initialNextKpis: ReportKpiPlan[];
  kpiItems: KpiItem[];
  reportType: ReportType;
  activeDate: string;
  onSave: (content: ReportContent, nextKpis: ReportKpiPlan[]) => void | Promise<void>;
  submitLabel?: string;
  resetAfterSave?: boolean;
}) {
  const blankNextKpis = () => Object.fromEntries(kpiItems.map((item) => [item.id, ""]));
  const [content, setContent] = useState<ReportContent>(initialContent);
  const [saving, setSaving] = useState(false);
  const [nextKpis, setNextKpis] = useState<Record<string, string>>(() =>
    Object.fromEntries(kpiItems.map((item) => [item.id, String(initialNextKpis.find((plan) => plan.kpiItemId === item.id)?.targetValue ?? 0)])),
  );
  const nextRange = nextReportRange(reportType, activeDate);
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(content, kpiItems.map((item) => ({ kpiItemId: item.id, targetValue: Number(nextKpis[item.id] || 0) })));
      if (resetAfterSave) {
        setContent(blankContent());
        setNextKpis(blankNextKpis());
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      {([
        ["activity", "活動内容"],
        ["result", "達成した成果"],
        ["issue", "課題・困りごと"],
        ["nextPlan", "次の予定・目標"],
        ["insight", "所感・気づき"],
      ] as [keyof ReportContent, string][]).map(([key, label]) => (
        <label className="field" key={key}>{label}<textarea value={content[key]} onChange={(event) => setContent({ ...content, [key]: event.target.value })} /></label>
      ))}
      <div className="report-next-kpis">
        <div><h4>{nextKpiTitle(reportType)}</h4><span>{nextRange.start} - {nextRange.end}</span></div>
        <div className="kpi-plan-grid">
          {kpiItems.map((item) => (
            <label key={item.id} className="field">
              {item.name}
              <div className="unit-input">
                <input type="number" min="0" value={nextKpis[item.id] ?? ""} onChange={(event) => setNextKpis({ ...nextKpis, [item.id]: event.target.value })} />
                <em>{item.unit}</em>
              </div>
            </label>
          ))}
        </div>
      </div>
      <button className="primary" type="button" onClick={handleSave} disabled={saving}>
        <Save size={18} />{saving ? "AIフィードバック生成中..." : submitLabel}
      </button>
    </>
  );
}

function CommentForm({ reportId, addComment }: { reportId: string; addComment: (reportId: string, comment: string) => void }) {
  const [comment, setComment] = useState("");
  const canSubmit = comment.trim().length > 0;
  return (
    <form className="comment-form" onSubmit={(event) => { event.preventDefault(); addComment(reportId, comment); setComment(""); }}>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="管理コメント" rows={3} />
      <button type="submit" title="コメントを送信" disabled={!canSubmit}><Send size={16} /></button>
    </form>
  );
}

function TargetsView(props: {
  data: AppData;
  upsertTarget: (form: FormData) => void;
  currentTargetFor: (kpiItemId: string, scope: TargetScope, periodType: PeriodType, range: { start: string; end: string }, owner?: { teamId?: string; userId?: string }) => KpiTarget | undefined;
  activeDate: string;
  exportCsv: (kind: "kpi" | "reports") => void;
}) {
  const [scope, setScope] = useState<TargetScope>("division");
  const [targetPeriodType, setTargetPeriodType] = useState<PeriodType>("month");
  const [targetDate, setTargetDate] = useState(props.activeDate);
  const [selectedTeamId, setSelectedTeamId] = useState(props.data.teams[0]?.id ?? "");
  const [selectedUserId, setSelectedUserId] = useState(props.data.users[0]?.id ?? "");
  const activeKpiItems = props.data.kpiItems.filter((item) => item.active);
  const selectedRange = getPeriodRange(targetPeriodType, targetDate);
  const owner = scope === "team" ? { teamId: selectedTeamId } : scope === "member" ? { userId: selectedUserId } : {};
  const ownerLabel =
    scope === "division"
      ? "事業部全体"
      : scope === "team"
        ? props.data.teams.find((team) => team.id === selectedTeamId)?.name ?? "未選択チーム"
        : props.data.users.find((user) => user.id === selectedUserId)?.name ?? "未選択メンバー";
  const selectedDrill: Drill =
    scope === "division"
      ? { scope: "division" }
      : scope === "team"
        ? { scope: "team", teamId: selectedTeamId }
        : { scope: "member", userId: selectedUserId };
  const currentTargetItems = activeKpiItems.map((item) => ({
    item,
    target: props.currentTargetFor(item.id, scope, targetPeriodType, selectedRange, owner),
    reflectedValue: targetFor(props.data, selectedDrill, item.id, targetPeriodType, selectedRange.start, selectedRange.end),
  }));
  return (
    <div className="targets-layout">
      <section className="panel target-setting-panel">
        <div className="panel-title"><Target size={18} /><h3>目標設定</h3></div>
        <form className="target-bulk-form" action={props.upsertTarget}>
          <div className="target-config-grid">
            <label className="field">階層<select name="scope" value={scope} onChange={(event) => setScope(event.target.value as TargetScope)}><option value="division">事業部全体</option><option value="team">チーム</option><option value="member">個人</option></select></label>
            {scope === "team" && <label className="field">チーム<select name="teamId" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>{props.data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
            {scope === "member" && <label className="field">メンバー<select name="userId" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{props.data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>}
            <label className="field">期間<select name="periodType" value={targetPeriodType} onChange={(event) => setTargetPeriodType(event.target.value as PeriodType)}><option value="day">日次</option><option value="week">週次</option><option value="month">月次</option><option value="half">半期</option></select></label>
            <label className="field">対象日<input type="date" name="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
          </div>
          <section className="current-target-panel">
            <div>
              <strong>現在反映中の目標</strong>
              <span>{ownerLabel} / {periodLabels[targetPeriodType]}次 / {selectedRange.start} - {selectedRange.end}</span>
            </div>
            <div className="current-target-grid">
              {currentTargetItems.map(({ item, target, reflectedValue }) => (
                <article key={item.id} className={target || reflectedValue > 0 ? "has-target" : ""}>
                  <span>{item.name}</span>
                  <strong>{numberFormat(target?.targetValue ?? reflectedValue)} {item.unit}</strong>
                  <em>{target ? "直接設定 / 更新 " + target.updatedAt.slice(0, 10) : reflectedValue > 0 ? (scope === "member" ? "上位目標を反映" : "メンバー目標合計を反映") : "未設定"}</em>
                </article>
              ))}
            </div>
          </section>
          <div className="target-input-grid" key={scope + "-" + selectedTeamId + "-" + selectedUserId + "-" + targetPeriodType + "-" + selectedRange.start}>
            {currentTargetItems.map(({ item, target }) => {
              return <label className="field" key={item.id}>{item.name}<div className="unit-input"><input name={"targetValue-" + item.id} type="number" min="0" defaultValue={target?.targetValue ?? 0} /><em>{item.unit}</em></div></label>;
            })}
          </div>
          <p className="target-save-summary">
            保存対象: {ownerLabel} / {periodLabels[targetPeriodType]}次 / {selectedRange.start} - {selectedRange.end}
          </p>
          <button className="primary" type="submit"><Save size={18} />全KPIの目標を保存</button>
        </form>
        <div className="export-actions"><button onClick={() => props.exportCsv("kpi")}><Download size={17} />KPI CSV</button><button onClick={() => props.exportCsv("reports")}><Download size={17} />日報 CSV</button></div>
      </section>
    </div>
  );
}

function MembersView(props: {
  data: AppData;
  persist: (data: AppData) => void;
  addTeam: (form: FormData) => void;
  addUser: (form: FormData) => void;
  currentUser: User;
  onCurrentPasswordChange: (password: string) => void;
  exportJsonBackup: () => void;
  importJsonBackup: (backup: Partial<AppData> & { exportedAt?: string; exportedBy?: string }) => void;
  focusAuditId: string | null;
}) {
  const canAdmin = props.currentUser.role === "admin";
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [backupPanelOpen, setBackupPanelOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(Boolean(props.focusAuditId));
  const [auditFilter, setAuditFilter] = useState<AuditLog["targetType"] | "all">("all");
  const [backupPreview, setBackupPreview] = useState<{
    fileName: string;
    exportedAt?: string;
    memberCount: number;
    dealCount: number;
    trainingScheduleCount: number;
    reportCount: number;
    latestUpdatedAt: string;
    data: Partial<AppData> & { exportedAt?: string; exportedBy?: string };
  } | null>(null);
  const visibleSettingUsers = canAdmin ? props.data.users : props.data.users.filter((user) => user.id === props.currentUser.id);
  const filteredAuditLogs = auditFilter === "all" ? props.data.auditLogs : props.data.auditLogs.filter((log) => log.targetType === auditFilter);
  async function previewBackupFile(file: File) {
    const parsed = JSON.parse(await file.text()) as Partial<AppData> & { exportedAt?: string; exportedBy?: string };
    const timestampCandidates = [
      ...(parsed.kpiTargets ?? []).map((item) => item.updatedAt),
      ...(parsed.kpiRecords ?? []).map((item) => item.updatedAt),
      ...(parsed.deals ?? []).map((item) => item.updatedAt),
      ...(parsed.trainingSchedules ?? []).map((item) => item.updatedAt),
      ...(parsed.reports ?? []).map((item) => item.updatedAt),
      ...(parsed.announcements ?? []).map((item) => item.updatedAt),
      ...(parsed.qualitativeInsights ?? []).map((item) => item.updatedAt),
      ...(parsed.auditLogs ?? []).map((item) => item.createdAt),
    ].filter(Boolean);
    setBackupPreview({
      fileName: file.name,
      exportedAt: parsed.exportedAt,
      memberCount: parsed.users?.length ?? 0,
      dealCount: parsed.deals?.length ?? 0,
      trainingScheduleCount: parsed.trainingSchedules?.length ?? 0,
      reportCount: parsed.reports?.length ?? 0,
      latestUpdatedAt: timestampCandidates.sort().at(-1) ?? "不明",
      data: parsed,
    });
  }
  function memberAudit(action: string, summary: string, targetId?: string) {
    return [
      { id: id("audit"), actorId: props.currentUser.id, action, targetType: "member" as const, targetId, summary, createdAt: new Date().toISOString() },
      ...(props.data.auditLogs ?? []),
    ].slice(0, 500);
  }
  function teamAudit(action: string, summary: string, targetId?: string) {
    return [
      { id: id("audit"), actorId: props.currentUser.id, action, targetType: "team" as const, targetId, summary, createdAt: new Date().toISOString() },
      ...(props.data.auditLogs ?? []),
    ].slice(0, 500);
  }
  function updateUser(userId: string, patch: Partial<User>) {
    if (!canAdmin && userId !== props.currentUser.id) return;
    const allowedPatch: Partial<User> = canAdmin
      ? patch
      : {
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.password !== undefined ? { password: patch.password } : {}),
        };
    if (Object.keys(allowedPatch).length === 0) return;
    const target = props.data.users.find((user) => user.id === userId);
    props.persist({
      ...props.data,
      users: props.data.users.map((user) => (user.id === userId ? { ...user, ...allowedPatch } : user)),
      auditLogs: memberAudit("メンバー更新", "メンバー「" + (target?.name ?? userId) + "」を更新", userId),
    });
  }
  return (
    <div className="settings-layout">
        <FoldablePanel title="メンバー管理" description={visibleSettingUsers.length + "名"} icon={Users} open={memberPanelOpen} onToggle={() => setMemberPanelOpen((value) => !value)}>
          <div className="member-list">
            {visibleSettingUsers.map((user) => {
              const canEditLogin = canAdmin || props.currentUser.id === user.id;
              return (
                <article key={user.id}>
                  <label>氏名
                    <input disabled={!canAdmin} defaultValue={user.name} onBlur={(event) => {
                      const name = event.currentTarget.value.trim();
                      if (name && name !== user.name) updateUser(user.id, { name });
                    }} />
                  </label>
                  <label>メールアドレス
                    <input disabled={!canEditLogin} type="email" defaultValue={user.email} onBlur={(event) => {
                      const email = event.currentTarget.value.trim();
                      if (email && email !== user.email) updateUser(user.id, { email });
                    }} />
                  </label>
                  <label>パスワード
                    <input disabled={!canEditLogin} type="password" defaultValue="" placeholder="変更時のみ入力" autoComplete="new-password" onBlur={(event) => {
                      const password = event.currentTarget.value.trim();
                      if (password && password !== user.password) {
                        updateUser(user.id, { password });
                        event.currentTarget.value = "";
                        if (user.id === props.currentUser.id) props.onCurrentPasswordChange(password);
                      }
                    }} />
                  </label>
                  <label>チーム
                    <select disabled={!canAdmin} value={user.teamId} onChange={(event) => updateUser(user.id, { teamId: event.target.value })}>
                      <option value="">未所属</option>
                      {props.data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  <label>権限
                    <select disabled={!canAdmin} value={user.role} onChange={(event) => { const role = event.target.value as Role; updateUser(user.id, { role, position: roleLabels[role] }); }}>
                      <option value="member">メンバー</option><option value="leader">リーダー</option><option value="manager">管理者</option><option value="admin">管理者</option>
                    </select>
                  </label>
                  {canAdmin && <button title="削除" onClick={() => {
                    if (!confirmDelete("メンバー「" + user.name + "」を削除しますか？")) return;
                    props.persist({ ...props.data, users: props.data.users.filter((item) => item.id !== user.id), auditLogs: memberAudit("メンバー削除", "メンバー「" + user.name + "」を削除", user.id) });
                  }}><Trash2 size={15} /></button>}
                </article>
              );
            })}
          </div>
          {canAdmin && (
            <form className="form-grid compact" action={props.addUser}>
              <input name="name" placeholder="氏名" />
              <input name="email" type="email" placeholder="メールアドレス" />
              <input name="password" type="password" placeholder="初期パスワード" />
              <select name="teamId"><option value="">未所属</option>{props.data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
              <select name="role" defaultValue="member"><option value="member">メンバー</option><option value="leader">リーダー</option><option value="manager">管理者</option><option value="admin">管理者</option></select>
              <button className="primary" type="submit"><Plus size={17} />メンバー追加</button>
            </form>
          )}
        </FoldablePanel>
        {canAdmin && (
          <FoldablePanel title="チーム管理" description={props.data.teams.length + "件"} icon={Settings} open={teamPanelOpen} onToggle={() => setTeamPanelOpen((value) => !value)}>
            <div className="team-list">
              {props.data.teams.map((team) => (
                <article key={team.id}>
                  <span style={{ background: team.color }} />
                  <input defaultValue={team.name} onBlur={(event) => props.persist({ ...props.data, teams: props.data.teams.map((item) => item.id === team.id ? { ...item, name: event.target.value.trim() || item.name } : item), auditLogs: teamAudit("チーム更新", "チーム「" + team.name + "」を更新", team.id) })} />
                  <small>{props.data.users.filter((user) => user.teamId === team.id).length}名</small>
                  <button title="削除" onClick={() => {
                    if (!confirmDelete("チーム「" + team.name + "」を削除しますか？")) return;
                    props.persist({ ...props.data, teams: props.data.teams.filter((item) => item.id !== team.id), auditLogs: teamAudit("チーム削除", "チーム「" + team.name + "」を削除", team.id) });
                  }}><Trash2 size={15} /></button>
                </article>
              ))}
            </div>
            <form className="inline-form" action={props.addTeam}><input name="name" placeholder="新しいチーム名" /><button className="primary" type="submit"><Plus size={17} />追加</button></form>
          </FoldablePanel>
        )}
        {canAdmin && (
          <FoldablePanel title="バックアップ / 復元" description="JSONで保管" icon={Download} open={backupPanelOpen} onToggle={() => setBackupPanelOpen((value) => !value)}>
            <div className="backup-actions">
              <button className="primary" type="button" onClick={props.exportJsonBackup}><Download size={17} />JSONバックアップ出力</button>
              <label className="secondary-action backup-import">
                <Upload size={17} />JSONから復元
                <input type="file" accept="application/json,.json" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) previewBackupFile(file).catch(() => setBackupPreview(null));
                  event.currentTarget.value = "";
                }} />
              </label>
            </div>
            {backupPreview && (
              <div className="backup-preview">
                <strong>復元前プレビュー</strong>
                <span>ファイル: {backupPreview.fileName}</span>
                <span>出力日時: {backupPreview.exportedAt ?? "不明"}</span>
                <span>メンバー: {backupPreview.memberCount}名 / 案件: {backupPreview.dealCount}件 / 研修計画: {backupPreview.trainingScheduleCount}件 / 日報: {backupPreview.reportCount}件</span>
                <span>最終更新: {backupPreview.latestUpdatedAt}</span>
                <div>
                  <button className="primary" type="button" onClick={() => {
                    if (!confirmDelete("現在の全データをプレビュー中のバックアップで復元しますか？")) return;
                    props.importJsonBackup(backupPreview.data);
                    setBackupPreview(null);
                  }}>この内容で復元</button>
                  <button className="secondary-action" type="button" onClick={() => setBackupPreview(null)}>キャンセル</button>
                </div>
              </div>
            )}
          </FoldablePanel>
        )}
        <FoldablePanel title="操作履歴" description={props.data.auditLogs.length + "件"} icon={History} open={auditPanelOpen} onToggle={() => setAuditPanelOpen((value) => !value)}>
          <div className="audit-filter-row">
            <label>種別
              <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value as AuditLog["targetType"] | "all")}>
                <option value="all">すべて</option>
                <option value="deal">案件</option>
                <option value="training">研修</option>
                <option value="member">メンバー</option>
                <option value="team">チーム</option>
                <option value="target">目標</option>
                <option value="backup">バックアップ</option>
                <option value="report">日報</option>
                <option value="kpi">KPI</option>
                <option value="announcement">お知らせ</option>
                <option value="insight">定性情報</option>
              </select>
            </label>
          </div>
          <div className="audit-list">
            {filteredAuditLogs.length === 0 && <EmptyState text="該当する操作履歴はありません。" />}
            {filteredAuditLogs.slice(0, 80).map((log) => {
              const actor = props.data.users.find((user) => user.id === log.actorId);
              return (
                <article key={log.id} className={props.focusAuditId === log.id ? "focused" : ""}>
                  <strong>{log.action}</strong>
                  <p>{log.summary}</p>
                  <span>{actor?.name ?? "不明なユーザー"} / {new Date(log.createdAt).toLocaleString("ja-JP")}</span>
                </article>
              );
            })}
          </div>
        </FoldablePanel>
      </div>
  );
}

function AnalysisView(props: {
  data: AppData;
  activeDate: string;
  search: string;
  setSearch: (value: string) => void;
  exportCsv: (kind: "kpi" | "reports") => void;
  histories: KpiRecordHistory[];
  openSource: (source: AnalysisSource) => void;
}) {
  const [analysisPeriodType, setAnalysisPeriodType] = useState<Extract<PeriodType, "day" | "week" | "month">>("month");
  const [analysisDate, setAnalysisDate] = useState(props.activeDate);
  const [teamId, setTeamId] = useState("all");
  const [userId, setUserId] = useState("all");
  const [analysisCategory, setAnalysisCategory] = useState<AnalysisCategory>("manager");
  const [analysisKind, setAnalysisKind] = useState<"all" | "kpi" | "deal" | "attendance">("all");
  const [analysisKpiId, setAnalysisKpiId] = useState("kpi-sales");
  const [dealStage, setDealStage] = useState<"all" | DealStage>("all");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [analysisBreakdown, setAnalysisBreakdown] = useState<AnalysisBreakdown | null>(null);
  const analysisRange = getPeriodRange(analysisPeriodType, analysisDate);
  const dateFrom = analysisRange.start;
  const dateTo = analysisRange.end;
  const usersForTeam = teamId === "all" ? props.data.users : props.data.users.filter((user) => user.teamId === teamId);
  const scopedUserIds = usersForTeam.filter((user) => userId === "all" || user.id === userId).map((user) => user.id);
  const activeKpi = props.data.kpiItems.find((item) => item.id === analysisKpiId) ?? props.data.kpiItems[0];
  const analysisDrill: Drill = userId !== "all" ? { scope: "member", userId } : teamId !== "all" ? { scope: "team", teamId } : { scope: "division" };
  const analysisCategoryItems: { id: AnalysisCategory; label: string; description: string }[] = [
    { id: "manager", label: "営業管理者向け", description: "全体の異常値・目標差分・提出状況を見る" },
    { id: "personal", label: "個人振り返り向け", description: "ファネル・推移・貢献度を見る" },
    { id: "deals", label: "案件確認向け", description: "ランク・次回対応・滞留・失注を見る" },
  ];
  const showManagerAnalysis = analysisCategory === "manager";
  const showPersonalAnalysis = analysisCategory === "personal";
  const showDealAnalysis = analysisCategory === "deals";
  const searchText = props.search.toLowerCase();
  const totalActual = activeKpi ? actualForKpi(props.data, scopedUserIds, activeKpi.id, dateFrom, dateTo) : 0;
  const totalTarget = activeKpi ? targetFor(props.data, analysisDrill, activeKpi.id, analysisPeriodType, dateFrom, dateTo) : 0;
  const achievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  const attendance = attendanceStats(props.data.attendanceRecords, scopedUserIds, dateFrom, dateTo);
  const scopedAllDeals = props.data.deals.filter((deal) => scopedUserIds.includes(deal.userId));
  const scopedDeals = scopedAllDeals.filter((deal) => inRange(dealDate(deal), dateFrom, dateTo));
  const filteredDeals = scopedDeals.filter((deal) => {
    const haystack = [deal.title, deal.description ?? "", dealRankLabels[dealRank(deal)], dealStageLabels[deal.stage]].join(" ");
    return (dealStage === "all" || deal.stage === dealStage) && haystack.toLowerCase().includes(searchText);
  });
  const dateKeys = dateFrom <= dateTo ? eachDate(dateFrom, dateTo) : [];
  const trendData = dateKeys.map((date) => ({ date: formatDateJa(date), actual: activeKpi ? actualForKpi(props.data, scopedUserIds, activeKpi.id, date, date) : 0 }));
  const kpiChartData = props.data.kpiItems.filter((item) => item.active).map((kpi) => {
    const actual = actualForKpi(props.data, scopedUserIds, kpi.id, dateFrom, dateTo);
    const target = targetFor(props.data, analysisDrill, kpi.id, analysisPeriodType, dateFrom, dateTo);
    return {
      id: kpi.id,
      name: kpi.name,
      unit: kpi.unit,
      actual,
      target,
      gap: actual - target,
      remaining: Math.max(target - actual, 0),
      rate: target > 0 ? Math.round((actual / target) * 100) : 0,
    };
  });
  const contributionKpis = ["kpi-sales", "kpi-orders", "kpi-ap", "kpi-calls"]
    .map((kpiId) => props.data.kpiItems.find((item) => item.id === kpiId))
    .filter((item): item is KpiItem => Boolean(item));
  const contributionRows = scopedUserIds
    .map((memberId) => {
      const user = props.data.users.find((item) => item.id === memberId);
      const values = Object.fromEntries(contributionKpis.map((kpi) => [kpi.id, actualForKpi(props.data, [memberId], kpi.id, dateFrom, dateTo)]));
      return {
        id: memberId,
        name: user?.name ?? "未設定",
        team: props.data.teams.find((team) => team.id === user?.teamId)?.name ?? "未所属",
        sales: Number(values["kpi-sales"] ?? 0),
        orders: Number(values["kpi-orders"] ?? 0),
        ap: Number(values["kpi-ap"] ?? 0),
        calls: Number(values["kpi-calls"] ?? 0),
      };
    })
    .sort((a, b) => b.sales - a.sales || b.orders - a.orders || b.ap - a.ap || b.calls - a.calls || a.name.localeCompare(b.name, "ja"));
  const maxContributionSales = Math.max(...contributionRows.map((row) => row.sales), 0);
  const funnelValues = kpiFunnelValues(props.data, scopedUserIds, dateFrom, dateTo);
  const funnelRates = {
    ap: funnelValues[0]?.actual > 0 ? (funnelValues[1].actual / funnelValues[0].actual) * 100 : 0,
    meeting: funnelValues[1]?.actual > 0 ? (funnelValues[2].actual / funnelValues[1].actual) * 100 : 0,
    reclose: funnelValues[2]?.actual > 0 ? (funnelValues[3].actual / funnelValues[2].actual) * 100 : 0,
    contract: funnelValues[3]?.actual > 0 ? (funnelValues[4].actual / funnelValues[3].actual) * 100 : 0,
  };
  const apRateComment = funnelValues[0].actual > 0
    ? funnelRates.ap <= 5
      ? "架電数に対してAP率が低いです。前工程比5%以下のため、接続後のトーク内容、訴求軸、切り返しを確認してください。"
      : "AP率は高い状態です。前工程比5%以上を維持できているため、商談化率以降の改善ポイントを確認してください。"
    : "";
  const bottleneckComments = [
    apRateComment,
    funnelValues[1].actual >= 10 && funnelRates.meeting < 50
      ? "APから初回商談への移行率が低めです。日程確定後のリマインドや事前準備を見直してください。"
      : "",
    funnelValues[2].actual >= 5 && funnelRates.reclose < 40
      ? "初回商談から再クロへの移行率が低めです。商談後の次回提案日と検討材料の回収状況を確認してください。"
      : "",
    funnelValues[2].actual >= 5 && funnelRates.contract < 20
      ? "商談数に対して契約率が低めです。提案内容、決裁者同席、クロージング条件を重点的に見直してください。"
      : "",
    funnelValues[3].actual >= 3 && funnelRates.contract < 30
      ? "再クロ後の契約化率が低めです。次回アクション日と懸念解消の管理を強化してください。"
      : "",
  ].filter(Boolean);
  const previousRange = getPeriodRange(analysisPeriodType, toDateKey(addDays(parseDateKey(dateFrom), -1)));
  const previousPeriodLabel = analysisPeriodType === "day" ? "前日" : analysisPeriodType === "week" ? "前週" : "前月";
  const comparisonKpiIds = ["kpi-calls", "kpi-ap", "kpi-meetings", "kpi-reclose", "kpi-orders", "kpi-sales"];
  const previousComparisonRows = comparisonKpiIds
    .map((kpiId) => props.data.kpiItems.find((item) => item.id === kpiId))
    .filter((item): item is KpiItem => Boolean(item))
    .map((item) => {
      const current = actualForKpi(props.data, scopedUserIds, item.id, dateFrom, dateTo);
      const previous = actualForKpi(props.data, scopedUserIds, item.id, previousRange.start, previousRange.end);
      const diff = current - previous;
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        current,
        previous,
        diff,
        rate: previous > 0 ? Math.round((diff / previous) * 100) : current > 0 ? 100 : 0,
      };
    });
  const trendRange =
    analysisPeriodType === "day"
      ? { start: toDateKey(addDays(parseDateKey(analysisDate), -29)), end: analysisDate }
      : analysisRange;
  const trendDateKeys = trendRange.start <= trendRange.end ? eachDate(trendRange.start, trendRange.end) : [];
  const trendDailyData = trendDateKeys.map((date) => ({
    date: formatDateJa(date),
    actual: activeKpi ? actualForKpi(props.data, scopedUserIds, activeKpi.id, date, date) : 0,
  }));
  const weeklyTrendMap = new Map<string, { date: string; actual: number }>();
  trendDateKeys.forEach((date) => {
    const week = getPeriodRange("week", date);
    const clippedStart = week.start < trendRange.start ? trendRange.start : week.start;
    const clippedEnd = week.end > trendRange.end ? trendRange.end : week.end;
    const key = clippedStart + "-" + clippedEnd;
    if (!weeklyTrendMap.has(key)) {
      weeklyTrendMap.set(key, {
        date: formatDateJa(clippedStart) + "週",
        actual: activeKpi ? actualForKpi(props.data, scopedUserIds, activeKpi.id, clippedStart, clippedEnd) : 0,
      });
    }
  });
  const trendWeeklyData = Array.from(weeklyTrendMap.values());
  const trendValues = trendDailyData.map((row) => row.actual);
  const trendHalf = Math.max(Math.floor(trendValues.length / 2), 1);
  const trendFirstAverage = trendValues.slice(0, trendHalf).reduce((sum, value) => sum + value, 0) / trendHalf;
  const trendSecondValues = trendValues.slice(-trendHalf);
  const trendSecondAverage = trendSecondValues.reduce((sum, value) => sum + value, 0) / Math.max(trendSecondValues.length, 1);
  const trendDiff = trendSecondAverage - trendFirstAverage;
  const trendDirection = trendDiff > 0.5 ? "上昇傾向" : trendDiff < -0.5 ? "下降傾向" : "横ばい";
  const trendDirectionClass = trendDiff > 0.5 ? "positive" : trendDiff < -0.5 ? "negative" : "";
  const monthlyRange = getPeriodRange("month", analysisDate);
  const todayKey = todayDateKey();
  const paceAnchor = todayKey >= monthlyRange.start && todayKey <= monthlyRange.end ? todayKey : analysisDate < monthlyRange.start ? monthlyRange.start : analysisDate > monthlyRange.end ? monthlyRange.end : analysisDate;
  const monthlyDateKeys = eachDate(monthlyRange.start, monthlyRange.end);
  const isBusinessDay = (dateKey: string) => {
    const day = parseDateKey(dateKey).getDay();
    return day !== 0 && day !== 6;
  };
  const reportBaseRange = getPeriodRange(analysisPeriodType, analysisDate);
  const reportAnalysisRange = {
    start: reportBaseRange.start,
    end: analysisDate < reportBaseRange.end ? analysisDate : reportBaseRange.end,
  };
  const businessDateKeys = eachDate(reportAnalysisRange.start, reportAnalysisRange.end).filter(isBusinessDay);
  const optimalAiTeamId = props.data.teams.find((team) => team.name === "最適AI")?.id;
  const reportAnalysisUserIds = scopedUserIds.filter((memberId) => props.data.users.find((user) => user.id === memberId)?.teamId === optimalAiTeamId);
  const totalBusinessDays = monthlyDateKeys.filter(isBusinessDay).length;
  const elapsedBusinessDays = monthlyDateKeys.filter((date) => date <= paceAnchor && isBusinessDay(date)).length;
  const remainingBusinessDays = monthlyDateKeys.filter((date) => date > paceAnchor && isBusinessDay(date)).length;
  const monthlyActualToDate = activeKpi ? actualForKpi(props.data, scopedUserIds, activeKpi.id, monthlyRange.start, paceAnchor) : 0;
  const monthlyTarget = activeKpi ? targetFor(props.data, analysisDrill, activeKpi.id, "month", monthlyRange.start, monthlyRange.end) : 0;
  const monthlyForecast = elapsedBusinessDays > 0 ? Math.round((monthlyActualToDate / elapsedBusinessDays) * Math.max(totalBusinessDays, elapsedBusinessDays)) : 0;
  const requiredRemaining = Math.max(monthlyTarget - monthlyActualToDate, 0);
  const requiredDailyPace = remainingBusinessDays > 0 ? requiredRemaining / remainingBusinessDays : requiredRemaining;
  const rankAnalysisRows = (["a", "b", "c", "contract_planned", "contract", "lost"] as DealRank[]).map((rank) => {
    const deals = scopedDeals.filter((deal) => dealRank(deal) === rank);
    return {
      rank,
      label: dealRankLabels[rank],
      count: deals.length,
      amount: deals.reduce((sum, deal) => sum + deal.amount, 0),
    };
  });
  const terminalDealStages: DealStage[] = ["completed", "contract", "lost"];
  const stalledExcludedStages: DealStage[] = ["completed", "contract", "lost", "appointment_cancelled"];
  const actionWeek = getPeriodRange("week", todayKey);
  const actionTargetDeals = scopedAllDeals.filter((deal) => !terminalDealStages.includes(deal.stage) && Boolean(nextActionDate(deal)));
  const actionAnalysisRows = [
    { id: "today", label: "今日対応", deals: actionTargetDeals.filter((deal) => nextActionDate(deal) === todayKey) },
    { id: "overdue", label: "期限切れ", deals: actionTargetDeals.filter((deal) => nextActionDate(deal) < todayKey) },
    { id: "week", label: "今週対応", deals: actionTargetDeals.filter((deal) => nextActionDate(deal) >= todayKey && nextActionDate(deal) <= actionWeek.end) },
  ].map((row) => ({
    ...row,
    count: row.deals.length,
    amount: row.deals.reduce((sum, deal) => sum + deal.amount, 0),
  }));
  const daysSince = (dateKey: string) => Math.max(0, Math.floor((parseDateKey(todayKey).getTime() - parseDateKey(dateKey).getTime()) / 86400000));
  const stalledDeals = scopedAllDeals
    .filter((deal) => !stalledExcludedStages.includes(deal.stage) && Boolean(nextActionDate(deal)))
    .map((deal) => ({ deal, days: daysSince(nextActionDate(deal)) }))
    .filter((row) => row.days >= 1)
    .sort((a, b) => b.days - a.days || dealRankSortScore[dealRank(b.deal)] - dealRankSortScore[dealRank(a.deal)] || b.deal.amount - a.deal.amount);
  const stalledRankRows = (["a", "b", "c", "contract_planned"] as DealRank[]).map((rank) => {
    const rows = stalledDeals.filter((row) => dealRank(row.deal) === rank);
    return {
      rank,
      label: dealRankLabels[rank],
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + row.deal.amount, 0),
    };
  });
  const lostDeals = scopedDeals.filter((deal) => deal.stage === "lost" || dealRank(deal) === "lost");
  const lostSummary = {
    count: lostDeals.length,
    amount: lostDeals.reduce((sum, deal) => sum + deal.amount, 0),
  };
  const lostOwnerRows = scopedUserIds
    .map((memberId) => {
      const ownerDeals = lostDeals.filter((deal) => deal.userId === memberId);
      const user = props.data.users.find((item) => item.id === memberId);
      return {
        id: memberId,
        name: user?.name ?? "未設定",
        count: ownerDeals.length,
        amount: ownerDeals.reduce((sum, deal) => sum + deal.amount, 0),
        deals: ownerDeals,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || b.amount - a.amount || a.name.localeCompare(b.name, "ja"));
  const lostReasonRows = lostDeals
    .map((deal) => {
      const owner = props.data.users.find((user) => user.id === deal.userId);
      return {
        id: deal.id,
        title: deal.title,
        owner: owner?.name ?? "未設定",
        amount: deal.amount,
        memo: deal.description?.trim() || "理由メモ未入力",
      };
    })
    .slice(0, 8);
  const scopedDailyReports = props.data.reports.filter(
    (report) =>
      report.reportType === "daily" &&
      reportAnalysisUserIds.includes(report.userId) &&
      report.periodStart >= reportAnalysisRange.start &&
      report.periodStart <= reportAnalysisRange.end &&
      businessDateKeys.includes(report.periodStart),
  );
  const submittedReportKeys = new Set(scopedDailyReports.map((report) => report.userId + "-" + report.periodStart));
  const expectedReportCount = reportAnalysisUserIds.length * businessDateKeys.length;
  const reportSubmissionRate = expectedReportCount > 0 ? Math.round((submittedReportKeys.size / expectedReportCount) * 100) : 0;
  const missingReportRows = reportAnalysisUserIds
    .map((memberId) => {
      const missingDates = businessDateKeys.filter((date) => !submittedReportKeys.has(memberId + "-" + date));
      const user = props.data.users.find((item) => item.id === memberId);
      return { id: memberId, name: user?.name ?? "未設定", missingDates };
    })
    .filter((row) => row.missingDates.length > 0)
    .sort((a, b) => b.missingDates.length - a.missingDates.length || a.name.localeCompare(b.name, "ja"));
  const reportFieldLabels: [keyof ReportContent, string][] = [
    ["activity", "活動"],
    ["result", "成果"],
    ["issue", "課題"],
    ["nextPlan", "次回予定"],
    ["insight", "気づき"],
  ];
  const reportContentTrendRows = reportFieldLabels.map(([key, label]) => {
    const filled = scopedDailyReports.filter((report) => report.content[key]?.trim()).length;
    return { key, label, filled, rate: scopedDailyReports.length > 0 ? Math.round((filled / scopedDailyReports.length) * 100) : 0 };
  });
  const reportWords = scopedDailyReports
    .flatMap((report) => Object.values(report.content).join(" ").split(/[\s、。・／/,.!?！？:：()（）【】「」]+/))
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !["なし", "無し", "特になし", "未記入"].includes(word));
  const reportWordRows = Array.from(reportWords.reduce((map, word) => map.set(word, (map.get(word) ?? 0) + 1), new Map<string, number>()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, 6);
  const correlationRows = contributionRows.filter((row) => row.calls > 0 || row.ap > 0 || row.orders > 0 || row.sales > 0);
  const correlationScore = (left: number[], right: number[]) => {
    if (left.length < 2 || right.length < 2) return 0;
    const leftAverage = left.reduce((sum, value) => sum + value, 0) / left.length;
    const rightAverage = right.reduce((sum, value) => sum + value, 0) / right.length;
    const numerator = left.reduce((sum, value, index) => sum + (value - leftAverage) * (right[index] - rightAverage), 0);
    const leftVariance = left.reduce((sum, value) => sum + (value - leftAverage) ** 2, 0);
    const rightVariance = right.reduce((sum, value) => sum + (value - rightAverage) ** 2, 0);
    const denominator = Math.sqrt(leftVariance * rightVariance);
    return denominator > 0 ? numerator / denominator : 0;
  };
  const formatCorrelation = (score: number) => Math.round(score * 100);
  const correlationSummaryRows = [
    { label: "架電 → 契約", score: correlationScore(correlationRows.map((row) => row.calls), correlationRows.map((row) => row.orders)) },
    { label: "AP → 契約", score: correlationScore(correlationRows.map((row) => row.ap), correlationRows.map((row) => row.orders)) },
    { label: "架電 → 売上", score: correlationScore(correlationRows.map((row) => row.calls), correlationRows.map((row) => row.sales)) },
    { label: "AP → 売上", score: correlationScore(correlationRows.map((row) => row.ap), correlationRows.map((row) => row.sales)) },
  ];
  const strongestCorrelation = [...correlationSummaryRows].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const userName = (memberId: string) => props.data.users.find((user) => user.id === memberId)?.name ?? "未設定";
  const teamNameForUser = (memberId: string) => {
    const member = props.data.users.find((user) => user.id === memberId);
    return props.data.teams.find((team) => team.id === member?.teamId)?.name ?? "未所属";
  };
  const kpiName = (kpiItemId: string) => props.data.kpiItems.find((item) => item.id === kpiItemId)?.name ?? "KPI";
  const kpiUnit = (kpiItemId: string) => props.data.kpiItems.find((item) => item.id === kpiItemId)?.unit ?? "件";
  const dealEvidenceRows = (deals: Deal[]): AnalysisBreakdownRow[] =>
    deals
      .map((deal) => ({
        id: deal.id,
        kind: "案件",
        date: deal.stage === "contract" ? dealDate(deal) : nextActionDate(deal) || dealDate(deal),
        owner: userName(deal.userId),
        title: deal.title,
        value: `${dealStageLabels[deal.stage]} / ${dealRankLabels[dealRank(deal)]} / ${numberFormat(deal.amount)}万円`,
        note: [teamNameForUser(deal.userId), deal.description?.trim()].filter(Boolean).join(" / "),
        source: { type: "deal" as const, id: deal.id },
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.owner.localeCompare(b.owner, "ja"));
  const kpiEvidenceRows = (kpiItemId: string, start: string, end: string, memberIds = scopedUserIds): AnalysisBreakdownRow[] => {
    if (kpiItemId === "kpi-orders" || kpiItemId === "kpi-sales") {
      return dealEvidenceRows(
        props.data.deals.filter((deal) => memberIds.includes(deal.userId) && deal.stage === "contract" && inRange(dealDate(deal), start, end)),
      ).map((row) => ({
        ...row,
        kind: kpiItemId === "kpi-sales" ? "売上案件" : "契約案件",
        value: kpiItemId === "kpi-sales" ? row.value : "契約 1件 / " + row.value,
      }));
    }
    return props.data.kpiRecords
      .filter((record) => memberIds.includes(record.userId) && record.kpiItemId === kpiItemId && inRange(record.date, start, end))
      .map((record) => ({
        id: record.id,
        kind: "KPI入力",
        date: record.date,
        owner: userName(record.userId),
        title: kpiName(record.kpiItemId),
        value: `${numberFormat(record.actualValue)} ${kpiUnit(record.kpiItemId)}`,
        note: teamNameForUser(record.userId),
        source: { type: "kpi" as const, date: record.date, userId: record.userId },
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.owner.localeCompare(b.owner, "ja"));
  };
  const attendanceEvidenceRows = (): AnalysisBreakdownRow[] =>
    props.data.attendanceRecords
      .filter((record) => scopedUserIds.includes(record.userId) && inRange(record.date, dateFrom, dateTo))
      .map((record) => ({
        id: record.id,
        kind: "出勤",
        date: record.date,
        owner: userName(record.userId),
        title: "出勤チェック",
        value: record.attended ? "出勤" : "未出勤",
        note: teamNameForUser(record.userId),
        source: { type: "attendance" as const, date: record.date, userId: record.userId },
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.owner.localeCompare(b.owner, "ja"));
  const reportEvidenceRows = (reports: Report[]): AnalysisBreakdownRow[] =>
    reports
      .map((report) => ({
        id: report.id,
        kind: reportLabels[report.reportType],
        date: report.periodStart,
        owner: userName(report.userId),
        title: reportPeriodLabel(report),
        value: Object.values(report.content).filter((value) => value.trim()).length + "項目記入",
        note: Object.values(report.content).find((value) => value.trim())?.trim() ?? "本文なし",
        source: { type: "report" as const, id: report.id },
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.owner.localeCompare(b.owner, "ja"));
  const openBreakdown = (title: string, description: string, rows: AnalysisBreakdownRow[]) => {
    setAnalysisBreakdown({ title, description, rows });
  };
  const openKpiBreakdown = (kpiItemId: string, label: string, start = dateFrom, end = dateTo, memberIds = scopedUserIds) => {
    openBreakdown(`${label}の根拠`, `${start} - ${end} / ${memberIds.length}名`, kpiEvidenceRows(kpiItemId, start, end, memberIds));
  };
  const openDealBreakdown = (title: string, deals: Deal[]) => {
    openBreakdown(title, `${numberFormat(deals.length)}件 / ${numberFormat(deals.reduce((sum, deal) => sum + deal.amount, 0))}万円`, dealEvidenceRows(deals));
  };
  const openReportBreakdown = (title: string, reports: Report[]) => {
    openBreakdown(title, `${numberFormat(reports.length)}件の日報`, reportEvidenceRows(reports));
  };
  const sourceActionLabel = (source: AnalysisSource) => {
    if (source.type === "deal") return "案件詳細を開く";
    if (source.type === "report") return "日報詳細を開く";
    if (source.type === "report-date") return "日報画面を開く";
    return "KPI入力を開く";
  };
  const dailyActualFor = (kpiItemId: string, date: string) => actualForKpi(props.data, scopedUserIds, kpiItemId, date, date);
  const anomalyAlerts = dateKeys.flatMap((date, index) => {
    if (index === 0) return [];
    const previousDate = dateKeys[index - 1];
    const previousCalls = dailyActualFor("kpi-calls", previousDate);
    const currentCalls = dailyActualFor("kpi-calls", date);
    const previousAp = dailyActualFor("kpi-ap", previousDate);
    const currentAp = dailyActualFor("kpi-ap", date);
    const currentOrders = dailyActualFor("kpi-orders", date);
    const rows: { id: string; title: string; message: string; tone: "danger" | "warning" | "positive"; onClick: () => void }[] = [];
    if (previousCalls >= 10 && currentCalls <= previousCalls * 0.5) {
      rows.push({
        id: "calls-drop-" + date,
        title: "架電数の急落",
        message: `${formatDateJa(previousDate)} ${numberFormat(previousCalls)}件 → ${formatDateJa(date)} ${numberFormat(currentCalls)}件`,
        tone: "danger",
        onClick: () => openKpiBreakdown("kpi-calls", "架電数急落", previousDate, date),
      });
    }
    if ((previousAp >= 1 && currentAp >= previousAp * 1.75) || currentAp - previousAp >= 3) {
      rows.push({
        id: "ap-rise-" + date,
        title: "AP数の急伸",
        message: `${formatDateJa(previousDate)} ${numberFormat(previousAp)}件 → ${formatDateJa(date)} ${numberFormat(currentAp)}件`,
        tone: "positive",
        onClick: () => openKpiBreakdown("kpi-ap", "AP数急伸", previousDate, date),
      });
    }
    if (currentOrders >= 2) {
      rows.push({
        id: "orders-cluster-" + date,
        title: "契約が集中",
        message: `${formatDateJa(date)} に契約 ${numberFormat(currentOrders)}件`,
        tone: "warning",
        onClick: () => openKpiBreakdown("kpi-orders", "契約集中日", date, date),
      });
    }
    return rows;
  });
  const kpiChartRowFor = (kpiItemId: string) => kpiChartData.find((row) => row.id === kpiItemId);
  const salesChartRow = kpiChartRowFor("kpi-sales");
  const apChartRow = kpiChartRowFor("kpi-ap");
  const ordersChartRow = kpiChartRowFor("kpi-orders");
  const overdueActionRow = actionAnalysisRows.find((row) => row.id === "overdue");
  const adminSummaryItems = [
    salesChartRow
      ? {
          id: "sales-summary",
          title: salesChartRow.rate >= 100 ? "売上は目標達成" : salesChartRow.rate >= 80 ? "売上は順調" : "売上不足",
          detail: `${numberFormat(salesChartRow.actual)} / ${numberFormat(salesChartRow.target)} ${salesChartRow.unit}（${numberFormat(salesChartRow.rate)}%）`,
          tone: salesChartRow.rate >= 80 ? "positive" : "danger",
          onClick: () => openKpiBreakdown("kpi-sales", "売上"),
        }
      : null,
    apChartRow && apChartRow.rate < 80
      ? {
          id: "ap-summary",
          title: "AP不足",
          detail: `目標まで残り ${numberFormat(apChartRow.remaining)} ${apChartRow.unit}`,
          tone: "danger",
          onClick: () => openKpiBreakdown("kpi-ap", "AP不足"),
        }
      : null,
    ordersChartRow && ordersChartRow.rate >= 100
      ? {
          id: "orders-summary",
          title: "契約数は目標達成",
          detail: `${numberFormat(ordersChartRow.actual)} / ${numberFormat(ordersChartRow.target)} ${ordersChartRow.unit}`,
          tone: "positive",
          onClick: () => openKpiBreakdown("kpi-orders", "契約数"),
        }
      : null,
    overdueActionRow && overdueActionRow.count > 0
      ? {
          id: "overdue-summary",
          title: `期限切れ案件 ${numberFormat(overdueActionRow.count)}件`,
          detail: `${numberFormat(overdueActionRow.amount)}万円分の次回対応が期限切れです。`,
          tone: "danger",
          onClick: () => openDealBreakdown("期限切れ案件の根拠", overdueActionRow.deals),
        }
      : null,
    missingReportRows.length > 0
      ? {
          id: "missing-report-summary",
          title: `日報未提出 ${numberFormat(missingReportRows.length)}名`,
          detail: `${numberFormat(missingReportRows.reduce((sum, row) => sum + row.missingDates.length, 0))}日分が未提出です。`,
          tone: "warning",
          onClick: () =>
            openBreakdown(
              "日報未提出の根拠",
              `${reportAnalysisRange.start} - ${reportAnalysisRange.end}`,
              missingReportRows.flatMap((row) =>
                row.missingDates.map((date) => ({
                  id: row.id + "-" + date,
                  kind: "日報未提出",
                  date,
                  owner: row.name,
                  title: "日報未提出",
                  value: "未提出",
                  note: teamNameForUser(row.id),
                  source: { type: "report-date" as const, date },
                })),
              ),
            ),
        }
      : null,
    bottleneckComments[0]
      ? {
          id: "bottleneck-summary",
          title: "ボトルネックあり",
          detail: bottleneckComments[0],
          tone: "warning",
          onClick: () => openKpiBreakdown("kpi-ap", "ボトルネック確認"),
        }
      : null,
  ].filter((item): item is { id: string; title: string; detail: string; tone: string; onClick: () => void } => Boolean(item)).slice(0, 5);
  const kpiRows =
    activeKpi && (analysisKind === "all" || analysisKind === "kpi")
      ? dateKeys
          .map((date) => ({
            id: "kpi-" + activeKpi.id + "-" + date,
            date,
            kind: "KPI実績",
            team: teamId === "all" ? "選択範囲" : props.data.teams.find((team) => team.id === teamId)?.name ?? "未所属",
            user: userId === "all" ? "全メンバー" : props.data.users.find((user) => user.id === userId)?.name ?? "",
            name: activeKpi.name,
            value: actualForKpi(props.data, scopedUserIds, activeKpi.id, date, date),
            unit: activeKpi.unit,
          }))
          .filter((row) => row.value > 0)
          .map((row) => ({ ...row, value: numberFormat(row.value) + " " + row.unit, userId: scopedUserIds.join(",") }))
      : [];
  const rows = [
    ...kpiRows,
    ...(analysisKind === "all" || analysisKind === "attendance"
      ? props.data.attendanceRecords.filter((record) => scopedUserIds.includes(record.userId)).map((record) => {
          const user = props.data.users.find((item) => item.id === record.userId);
          const team = props.data.teams.find((item) => item.id === user?.teamId);
          return { id: record.id, date: record.date, kind: "出勤", team: team?.name ?? "未所属", user: user?.name ?? "", name: "出勤チェック", value: record.attended ? "○" : "×", userId: record.userId };
        })
      : []),
    ...(analysisKind === "all" || analysisKind === "deal"
      ? filteredDeals.map((deal) => {
          const user = props.data.users.find((item) => item.id === deal.userId);
          const team = props.data.teams.find((item) => item.id === user?.teamId);
          return {
            id: deal.id,
            date: dealDate(deal),
            kind: "案件",
            team: team?.name ?? "未所属",
            user: user?.name ?? "",
            name: deal.description ? deal.title + "・" + deal.description : deal.title,
            value: dealRankLabels[dealRank(deal)] + " / " + dealStageLabels[deal.stage] + " / " + deal.amount + "万円",
            userId: deal.userId,
          };
        })
      : []),
  ].filter((row) => {
    const haystack = [row.date, row.kind, row.team, row.user, row.name, row.value].join(" ");
    return inRange(row.date, dateFrom, dateTo) && haystack.toLowerCase().includes(searchText);
  });

  return (
    <div className="stack">
      <section className="analysis-toolbar">
        <div className="segmented analysis-period-tabs">
          {(["day", "week", "month"] as Extract<PeriodType, "day" | "week" | "month">[]).map((type) => (
            <button key={type} className={analysisPeriodType === type ? "active" : ""} onClick={() => setAnalysisPeriodType(type)} type="button">
              {periodLabels[type]}
            </button>
          ))}
        </div>
        <label><CalendarDays size={17} /><input type="date" value={analysisDate} onChange={(event) => setAnalysisDate(event.target.value)} /></label>
        <span className="analysis-range-label">{dateFrom} - {dateTo}</span>
        <label><Users size={17} /><select value={teamId} onChange={(event) => { setTeamId(event.target.value); setUserId("all"); }}><option value="all">全チーム</option>{props.data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label><Users size={17} /><select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="all">全メンバー</option>{usersForTeam.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label><Search size={17} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="日付・種別・メンバー・案件名で検索" /></label>
        <label><BarChart3 size={17} /><select value={analysisKind} onChange={(event) => setAnalysisKind(event.target.value as typeof analysisKind)}><option value="all">すべて</option><option value="kpi">KPI</option><option value="deal">案件</option><option value="attendance">出勤</option></select></label>
        <label><Target size={17} /><select value={dealStage} onChange={(event) => setDealStage(event.target.value as typeof dealStage)}><option value="all">全案件状態</option>{Object.entries(dealStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button onClick={() => props.exportCsv("kpi")}><Download size={17} />CSV出力</button>
      </section>
      <section className="analysis-kpi-row">
        <BarChart3 size={17} />
        <div>{props.data.kpiItems.filter((item) => item.active).map((item) => <button key={item.id} className={activeKpi?.id === item.id ? "active" : ""} onClick={() => setAnalysisKpiId(item.id)} type="button">{item.name}</button>)}</div>
      </section>
      <section className="analysis-category-tabs" aria-label="分析カテゴリ">
        {analysisCategoryItems.map((item) => (
          <button key={item.id} className={analysisCategory === item.id ? "active" : ""} type="button" onClick={() => setAnalysisCategory(item.id)}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </section>
      <section className="metrics-grid analysis-metrics">
        <StatCard label="対象実績" value={numberFormat(totalActual) + " " + (activeKpi?.unit ?? "")} sub={periodLabels[analysisPeriodType] + "別 / " + (activeKpi?.name ?? "KPI")} valueRate={achievement} onClick={() => activeKpi && openKpiBreakdown(activeKpi.id, activeKpi.name)} />
        <StatCard label="対象目標" value={numberFormat(totalTarget) + " " + (activeKpi?.unit ?? "")} sub={periodLabels[analysisPeriodType] + "別目標 / " + dateFrom + " - " + dateTo} />
        <StatCard label="達成率" value={achievement + "%"} sub={achievement >= 100 ? "目標達成" : "進捗確認中"} onClick={() => activeKpi && openKpiBreakdown(activeKpi.id, activeKpi.name + "達成率")} />
        <StatCard label="対象期間の稼働率" value={attendance.rate + "%"} sub={attendance.attended + "/" + attendance.checked + " 出勤"} onClick={() => openBreakdown("稼働率の根拠", `${dateFrom} - ${dateTo}`, attendanceEvidenceRows())} />
      </section>
      {showManagerAnalysis && <section className="analysis-command-grid">
        <div className="panel admin-summary-panel">
          <div className="panel-title"><Target size={18} /><h3>管理者向けサマリー</h3><span>今見るべきポイント</span></div>
          <div className="admin-summary-list">
            {adminSummaryItems.length === 0 && <EmptyState text="急ぎで確認すべき項目はありません。" />}
            {adminSummaryItems.map((item) => (
              <button key={item.id} className={"admin-summary-card " + item.tone} type="button" onClick={item.onClick}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel anomaly-alert-panel">
          <div className="panel-title"><Bell size={18} /><h3>異常値アラート</h3><span>{anomalyAlerts.length}件</span></div>
          <div className="anomaly-alert-list">
            {anomalyAlerts.length === 0 && <EmptyState text="対象期間に大きな異常値は検出されていません。" />}
            {anomalyAlerts.slice(0, 8).map((alert) => (
              <button key={alert.id} className={"anomaly-alert-card " + alert.tone} type="button" onClick={alert.onClick}>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
              </button>
            ))}
          </div>
        </div>
      </section>}
      {showPersonalAnalysis && <section className="analysis-funnel-grid">
        <KpiFunnelPanel
          data={props.data}
          userIds={scopedUserIds}
          start={dateFrom}
          end={dateTo}
          onSelect={(kpiItemId, label) => openKpiBreakdown(kpiItemId, label)}
        />
        <div className="panel bottleneck-panel">
          <div className="panel-title"><Target size={18} /><h3>ボトルネック検出</h3></div>
          <div className="bottleneck-rate-grid">
            <span>AP率 <strong>{numberFormat(funnelRates.ap)}%</strong></span>
            <span>商談化率 <strong>{numberFormat(funnelRates.meeting)}%</strong></span>
            <span>再クロ率 <strong>{numberFormat(funnelRates.reclose)}%</strong></span>
            <span>契約化率 <strong>{numberFormat(funnelRates.contract)}%</strong></span>
          </div>
          <div className="bottleneck-list">
            {(bottleneckComments.length > 0 ? bottleneckComments : ["大きなボトルネックは検出されていません。現在の流れを維持しつつ、各工程の母数を増やしましょう。"]).map((comment) => (
              <p key={comment}>{comment}</p>
            ))}
          </div>
        </div>
        <div className="panel previous-period-panel">
          <div className="panel-title">
            <LineChartIcon size={18} />
            <h3>前期間比較</h3>
            <span>{previousPeriodLabel} {previousRange.start} - {previousRange.end}</span>
          </div>
          <div className="previous-period-grid">
            {previousComparisonRows.map((row) => (
              <button className="previous-evidence-card" key={row.id} type="button" onClick={() => openKpiBreakdown(row.id, row.name)}>
                <div>
                  <strong>{row.name}</strong>
                  <span>{numberFormat(row.current)} {row.unit}</span>
                </div>
                <p>{previousPeriodLabel}: {numberFormat(row.previous)} {row.unit}</p>
                <em className={row.diff > 0 ? "positive" : row.diff < 0 ? "negative" : ""}>
                  {row.diff > 0 ? "+" : ""}{numberFormat(row.diff)} {row.unit} / {row.rate > 0 ? "+" : ""}{numberFormat(row.rate)}%
                </em>
              </button>
            ))}
          </div>
        </div>
      </section>}
      {showPersonalAnalysis && <section className="analysis-pace-grid">
        <div className="panel trend-analysis-panel">
          <div className="panel-title">
            <LineChartIcon size={18} />
            <h3>トレンド分析</h3>
            <span className={trendDirectionClass}>{trendDirection}</span>
          </div>
          <div className="trend-chart-grid">
            <div>
              <strong>日別推移</strong>
              <MeasuredChart>{({ width, height }) => <LineChart data={trendDailyData} width={width} height={height}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="actual" name="実績" stroke="#0b63ce" strokeWidth={2} dot={false} /></LineChart>}</MeasuredChart>
            </div>
            <div>
              <strong>週別推移</strong>
              <MeasuredChart>{({ width, height }) => <LineChart data={trendWeeklyData} width={width} height={height}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="actual" name="週合計" stroke="#0f766e" strokeWidth={2} dot /></LineChart>}</MeasuredChart>
            </div>
          </div>
        </div>
        <div className="panel pace-summary-panel">
          <div className="panel-title"><Target size={18} /><h3>予測着地・必要ペース</h3></div>
          <div className="pace-summary-grid">
            <article>
              <span>予測着地</span>
              <strong>{numberFormat(monthlyForecast)} {activeKpi?.unit ?? ""}</strong>
              <p>このペースだと月末{activeKpi?.name ?? "KPI"} {numberFormat(monthlyForecast)}{activeKpi?.unit ?? ""} 見込み</p>
            </article>
            <article>
              <span>必要ペース</span>
              <strong>{numberFormat(requiredDailyPace)} {activeKpi?.unit ?? ""}/営業日</strong>
              <p>残り営業日で毎日 {activeKpi?.name ?? "KPI"} {numberFormat(requiredDailyPace)}{activeKpi?.unit ?? ""} 必要</p>
            </article>
            <article>
              <span>月目標まで</span>
              <strong>{numberFormat(requiredRemaining)} {activeKpi?.unit ?? ""}</strong>
              <p>{monthlyRange.start} - {monthlyRange.end} / 残り営業日 {remainingBusinessDays}日</p>
            </article>
          </div>
        </div>
      </section>}
      {showDealAnalysis && <section className="deal-analysis-grid">
        <div className="panel deal-rank-analysis-panel">
          <div className="panel-title"><BriefcaseBusiness size={18} /><h3>案件ランク別分析</h3></div>
          <div className="deal-analysis-table">
            <div className="deal-analysis-row head"><span>ランク</span><span>件数</span><span>金額</span></div>
            {rankAnalysisRows.map((row) => (
              <button className="deal-analysis-row deal-analysis-button" key={row.rank} type="button" onClick={() => openDealBreakdown(row.label + "ランク案件の根拠", scopedDeals.filter((deal) => dealRank(deal) === row.rank))}>
                <strong>{row.label}</strong>
                <span>{numberFormat(row.count)} 件</span>
                <span>{numberFormat(row.amount)} 万円</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel next-action-analysis-panel">
          <div className="panel-title"><CalendarDays size={18} /><h3>次回アクション分析</h3></div>
          <div className="next-action-analysis-grid">
            {actionAnalysisRows.map((row) => (
              <button key={row.id} className={row.id} type="button" onClick={() => openDealBreakdown(row.label + "案件の根拠", row.deals)}>
                <span>{row.label}</span>
                <strong>{numberFormat(row.count)} 件</strong>
                <p>{numberFormat(row.amount)} 万円</p>
              </button>
            ))}
          </div>
        </div>
        <div className="panel stalled-deal-panel">
          <div className="panel-title">
            <History size={18} />
            <h3>滞留案件分析</h3>
            <span>次回アクション日から1日以上経過</span>
          </div>
          <div className="stalled-rank-summary">
            {stalledRankRows.map((row) => (
              <span key={row.rank}>{row.label}<strong>{numberFormat(row.count)}件</strong><em>{numberFormat(row.amount)}万円</em></span>
            ))}
          </div>
          <div className="stalled-deal-list">
            {stalledDeals.length === 0 && <EmptyState text="次回アクション日から1日以上経過している案件はありません。" />}
            {stalledDeals.slice(0, 8).map(({ deal, days }) => {
              const owner = props.data.users.find((user) => user.id === deal.userId);
              return (
                <button className="stalled-deal-button" key={deal.id} type="button" onClick={() => openDealBreakdown(deal.title + "の根拠", [deal])}>
                  <div>
                    <strong>{days}日経過 / {dealRankLabels[dealRank(deal)]}ランク</strong>
                    <span>{deal.title}</span>
                  </div>
                  <em>{owner?.name ?? "未設定"} / {numberFormat(deal.amount)}万円 / 次回 {nextActionDate(deal)}</em>
                </button>
              );
            })}
          </div>
        </div>
      </section>}
      {showManagerAnalysis && <section className="quality-analysis-grid">
        <div className="panel lost-analysis-panel">
          <div className="panel-title"><X size={18} /><h3>失注分析</h3></div>
          <div className="lost-summary-grid">
            <button type="button" onClick={() => openDealBreakdown("失注案件の根拠", lostDeals)}><span>失注件数</span><strong>{numberFormat(lostSummary.count)} 件</strong></button>
            <button type="button" onClick={() => openDealBreakdown("失注金額の根拠", lostDeals)}><span>失注金額</span><strong>{numberFormat(lostSummary.amount)} 万円</strong></button>
          </div>
          <div className="lost-owner-list">
            {lostOwnerRows.length === 0 && <EmptyState text="対象期間の失注案件はありません。" />}
            {lostOwnerRows.map((row) => (
              <button key={row.id} type="button" onClick={() => openDealBreakdown(`${row.name}の失注案件`, row.deals)}>
                <span>{row.name}</span>
                <strong>{numberFormat(row.count)}件</strong>
                <em>{numberFormat(row.amount)}万円</em>
                <Eye size={15} />
              </button>
            ))}
          </div>
          <div className="lost-reason-list">
            {lostReasonRows.map((row) => (
              <button key={row.id} type="button" onClick={() => props.openSource({ type: "deal", id: row.id })}>
                <div><strong>{row.title}</strong><span>{row.owner} / {numberFormat(row.amount)}万円</span></div>
                <p>{row.memo}</p>
                <Eye size={16} />
              </button>
            ))}
          </div>
        </div>
        <div className="panel report-analysis-panel">
          <div className="panel-title"><FileText size={18} /><h3>日報分析</h3></div>
          <button className={reportSubmissionRate >= 100 ? "report-rate-card complete" : "report-rate-card"} type="button" onClick={() => openReportBreakdown("提出済み日報の根拠", scopedDailyReports)}>
            <span>日報提出率</span>
            <strong>{numberFormat(reportSubmissionRate)}%</strong>
            <p>{numberFormat(submittedReportKeys.size)} / {numberFormat(expectedReportCount)} 件提出</p>
          </button>
          <div className="missing-report-analysis">
            <strong>未提出者</strong>
            {missingReportRows.length === 0 && <p>未提出者はいません。</p>}
            {missingReportRows.slice(0, 8).map((row) => (
              <p key={row.id}>{row.name} <span>{row.missingDates.length}日分</span></p>
            ))}
          </div>
          <div className="report-content-trends">
            {reportContentTrendRows.map((row) => (
              <span key={row.key}>{row.label}<strong>{numberFormat(row.rate)}%</strong></span>
            ))}
          </div>
          <div className="report-word-list">
            {reportWordRows.length === 0 ? <span>頻出語なし</span> : reportWordRows.map(([word, count]) => <span key={word}>{word}<em>{count}</em></span>)}
          </div>
        </div>
        <div className="panel correlation-panel">
          <div className="panel-title">
            <LineChartIcon size={18} />
            <h3>活動量と成果の相関</h3>
            <span>{strongestCorrelation ? strongestCorrelation.label + " " + formatCorrelation(strongestCorrelation.score) + "%" : "データ不足"}</span>
          </div>
          <div className="correlation-score-grid">
            {correlationSummaryRows.map((row) => (
              <article key={row.label}>
                <span>{row.label}</span>
                <strong className={row.score > 0.3 ? "positive" : row.score < -0.3 ? "negative" : ""}>{formatCorrelation(row.score)}%</strong>
                <p>{Math.abs(row.score) >= 0.6 ? "強い傾向" : Math.abs(row.score) >= 0.3 ? "中程度" : "弱い傾向"}</p>
              </article>
            ))}
          </div>
          <div className="correlation-member-table">
            <div className="correlation-member-row head"><span>メンバー</span><span>架電</span><span>AP</span><span>契約</span><span>売上</span></div>
            {correlationRows.slice(0, 8).map((row) => (
              <div className="correlation-member-row" key={row.id}>
                <strong>{row.name}</strong>
                <span>{numberFormat(row.calls)}</span>
                <span>{numberFormat(row.ap)}</span>
                <span>{numberFormat(row.orders)}</span>
                <span>{numberFormat(row.sales)}万</span>
              </div>
            ))}
          </div>
        </div>
      </section>}
      {showManagerAnalysis && <section className="analysis-insight-grid">
        <div className="panel analysis-gap-panel">
          <div className="panel-title"><Target size={18} /><h3>目標差分分析</h3></div>
          <div className="analysis-table target-gap-table">
            <div className="analysis-table-row head"><span>KPI</span><span>実績</span><span>目標</span><span>差分</span><span>残り</span><span>達成率</span></div>
            {kpiChartData.map((row) => (
              <button className="analysis-table-row analysis-table-button" key={row.id} type="button" onClick={() => openKpiBreakdown(row.id, row.name)}>
                <strong>{row.name}</strong>
                <span>{numberFormat(row.actual)} {row.unit}</span>
                <span>{numberFormat(row.target)} {row.unit}</span>
                <span className={row.gap >= 0 ? "positive" : "negative"}>{row.gap >= 0 ? "+" : ""}{numberFormat(row.gap)} {row.unit}</span>
                <span>{numberFormat(row.remaining)} {row.unit}</span>
                <em className={row.rate >= 100 ? "positive" : "negative"}>{numberFormat(row.rate)}%</em>
              </button>
            ))}
          </div>
          <div className="target-gap-bars">
            <div className="target-gap-bars-title">
              <Target size={16} />
              <strong>KPI別達成率</strong>
            </div>
            <div className="target-gap-bar-grid">
              {kpiChartData.map((row) => {
                const barRate = Math.min(Math.max(row.rate, 0), 100);
                const achieved = row.rate >= 100;
                return (
                  <button key={"bar-" + row.id} type="button" onClick={() => openKpiBreakdown(row.id, row.name + "達成率")}>
                    <div className="target-gap-bar-head">
                      <strong>{row.name}</strong>
                      <em className={achieved ? "positive" : "negative"}>{numberFormat(row.rate)}%</em>
                    </div>
                    <div className="target-gap-bar-track">
                      <i className={achieved ? "achieved" : "behind"} style={{ width: barRate + "%" }} />
                    </div>
                    <p>{numberFormat(row.actual)} / {numberFormat(row.target)} {row.unit}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="panel contribution-panel-analytics">
          <div className="panel-title"><Users size={18} /><h3>メンバー別貢献度</h3></div>
          <div className="contribution-ranking">
            {contributionRows.length === 0 && <EmptyState text="対象メンバーの実績がありません。" />}
            {contributionRows.map((row, index) => (
              <button key={row.id} type="button" onClick={() => openKpiBreakdown("kpi-sales", row.name + "の貢献度", dateFrom, dateTo, [row.id])}>
                <div className="contribution-rank-head">
                  <span>{index + 1}</span>
                  <div><strong>{row.name}</strong><em>{row.team}</em></div>
                </div>
                <div className="contribution-bar"><i style={{ width: (maxContributionSales > 0 ? Math.max((row.sales / maxContributionSales) * 100, 4) : 0) + "%" }} /></div>
                <div className="contribution-metrics">
                  <span>売上 <strong>{numberFormat(row.sales)}万円</strong></span>
                  <span>契約 <strong>{numberFormat(row.orders)}件</strong></span>
                  <span>AP <strong>{numberFormat(row.ap)}件</strong></span>
                  <span>架電 <strong>{numberFormat(row.calls)}件</strong></span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>}
      {showPersonalAnalysis && <section className="chart-grid">
        <button className="panel wide chart-evidence-button" type="button" onClick={() => activeKpi && openKpiBreakdown(activeKpi.id, activeKpi.name + "の日別推移")}><div className="panel-title"><LineChartIcon size={18} /><h3>{activeKpi?.name}の日別推移</h3></div><MeasuredChart>{({ width, height }) => <AreaChart data={trendData} width={width} height={height}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Area dataKey="actual" name="実績" stroke="#0f766e" fill="#ccfbf1" strokeWidth={2} /></AreaChart>}</MeasuredChart></button>
        <button className="panel chart-evidence-button" type="button" onClick={() => openBreakdown("KPI別達成率の根拠", `${dateFrom} - ${dateTo}`, kpiChartData.map((row) => ({ id: row.id, kind: "KPI集計", date: dateTo, owner: "選択範囲", title: row.name, value: `${numberFormat(row.actual)} / ${numberFormat(row.target)} ${row.unit}`, note: `達成率 ${numberFormat(row.rate)}%` })))}><div className="panel-title"><PieChartIcon size={18} /><h3>KPI別達成率</h3></div><MeasuredChart>{({ width, height }) => <BarChart data={kpiChartData} width={width} height={height}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="rate" name="達成率(%)" fill="#f59e0b" radius={[6, 6, 0, 0]} /></BarChart>}</MeasuredChart></button>
      </section>}
      {analysisBreakdown && (
        <section className="panel analysis-breakdown-panel">
          <div className="panel-title">
            <Search size={18} />
            <h3>{analysisBreakdown.title}</h3>
            <span>{analysisBreakdown.description}</span>
            <button type="button" onClick={() => setAnalysisBreakdown(null)}><X size={16} /></button>
          </div>
          <div className="analysis-breakdown-list">
            {analysisBreakdown.rows.length === 0 && <EmptyState text="対象となる根拠データはありません。" />}
            {analysisBreakdown.rows.map((row) => (
              <article key={row.kind + "-" + row.id}>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.kind} / {row.date} / {row.owner}</span>
                </div>
                <em>{row.value}</em>
                {row.source ? (
                  <button type="button" onClick={() => props.openSource(row.source!)}>
                    {sourceActionLabel(row.source)}
                  </button>
                ) : null}
                {row.note ? <p>{row.note}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}
      <FoldablePanel title="検索結果" description={rows.length + "件"} icon={BarChart3} open={resultsOpen} onToggle={() => setResultsOpen((value) => !value)}>
        <div className="data-table">
          <div className="table-row head"><span>日付</span><span>種別</span><span>チーム</span><span>メンバー</span><span>内容</span></div>
          {rows.length === 0 && <EmptyState text="条件に一致する明細はありません。" />}
          {rows.map((row) => <div className="table-row" key={row.kind + "-" + row.id}><span>{row.date}</span><span>{row.kind}</span><span>{row.team}</span><span>{row.user}</span><span>{row.name} / {row.value}</span></div>)}
        </div>
      </FoldablePanel>
      <section className="panel">
        <div className="panel-title"><Edit3 size={18} /><h3>編集履歴</h3></div>
        <div className="history-list">
          {props.histories.length === 0 && <EmptyState text="編集履歴はまだありません。" />}
          {props.histories.map((history) => <article key={history.id}><strong>{numberFormat(history.previousValue)} → {numberFormat(history.nextValue)}</strong><span>{new Date(history.changedAt).toLocaleString("ja-JP")}</span></article>)}
        </div>
      </section>
    </div>
  );
}
