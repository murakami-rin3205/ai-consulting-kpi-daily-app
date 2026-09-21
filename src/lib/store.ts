import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { seedData } from "./seed";
import { normalizeReportFeedback } from "./report-feedback";
import type { AppData, User } from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "app-db.json");
const runtimeDataDir = path.join(tmpdir(), "ai-consulting-kpi-daily-app");
const runtimeDbPath = path.join(runtimeDataDir, "app-db.json");
const blobDbPath = "ai-consulting-kpi-daily-app/app-db.json";
const metaPath = path.join(dataDir, "app-db-meta.json");
const runtimeMetaPath = path.join(runtimeDataDir, "app-db-meta.json");
const authPath = path.join(dataDir, "app-auth.json");
const runtimeAuthPath = path.join(runtimeDataDir, "app-auth.json");
const blobMetaPath = "ai-consulting-kpi-daily-app/app-db-meta.json";
const blobAuthPath = "ai-consulting-kpi-daily-app/app-auth.json";
const sidecarCacheTtlMs = 2000;

let appDataMemoryCache: { revision: string; data: AppData } | null = null;
let metaMemoryCache: { cachedAt: number; data: AppDataMeta } | null = null;
let authMemoryCache: { cachedAt: number; data: AppAuthData } | null = null;

export type AppDataCollection = keyof Pick<
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

export type AppDataMeta = {
  revision: string;
  updatedAt: string;
  collectionRevisions: Record<AppDataCollection, string>;
};

export type AppAuthData = {
  updatedAt: string;
  users: User[];
  teams: AppData["teams"];
  kpiItems: AppData["kpiItems"];
};

export const appDataCollections: AppDataCollection[] = [
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

const untimedCollections = new Set<AppDataCollection>(["users", "teams", "kpiItems"]);

function canUseBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

async function readBlobAppData() {
  if (!canUseBlobStore()) return null;
  try {
    const blob = await get(blobDbPath, { access: "private", useCache: false });
    if (!blob?.stream) return null;
    const raw = await new Response(blob.stream).text();
    return normalizeAppData(JSON.parse(raw) as AppData);
  } catch {
    return null;
  }
}

async function readBlobJson<T>(blobPath: string) {
  if (!canUseBlobStore()) return null;
  try {
    const blob = await get(blobPath, { access: "private", useCache: false });
    if (!blob?.stream) return null;
    return (await new Response(blob.stream).json()) as T;
  } catch {
    return null;
  }
}

async function writeBlobJson(blobPath: string, data: unknown) {
  if (!canUseBlobStore()) return false;
  try {
    await put(blobPath, JSON.stringify(data, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch {
    return false;
  }
}

async function writeBlobAppData(data: AppData) {
  if (!canUseBlobStore()) return null;
  const normalized = normalizeAppData(data);
  try {
    await put(blobDbPath, JSON.stringify(normalized, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      cacheControlMaxAge: 60,
    });
    return normalized;
  } catch {
    return null;
  }
}

function readPaths() {
  return process.env.VERCEL ? [runtimeDbPath, dbPath] : [dbPath, runtimeDbPath];
}

function metaReadPaths() {
  return process.env.VERCEL ? [runtimeMetaPath, metaPath] : [metaPath, runtimeMetaPath];
}

function authReadPaths() {
  return process.env.VERCEL ? [runtimeAuthPath, authPath] : [authPath, runtimeAuthPath];
}

function timestampFor(collection: AppDataCollection, item: { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }) {
  if (collection === "notifications") return item.resolvedAt ?? item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
  return item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
}

function collectionRevision(data: AppData, collection: AppDataCollection, updatedAt: string) {
  if (untimedCollections.has(collection)) return updatedAt;
  const latestItemTimestamp = (data[collection] as { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }[]).reduce((latest, item) => {
    const timestamp = timestampFor(collection, item);
    return timestamp > latest ? timestamp : latest;
  }, "");
  if (collection === "notifications" || collection === "announcements") {
    return updatedAt > latestItemTimestamp ? updatedAt : latestItemTimestamp;
  }
  return latestItemTimestamp;
}

export function buildAppDataMeta(data: AppData, updatedAt = new Date().toISOString()): AppDataMeta {
  const collectionRevisions = Object.fromEntries(
    appDataCollections.map((collection) => [collection, collectionRevision(data, collection, updatedAt)]),
  ) as Record<AppDataCollection, string>;
  const revision = Object.values(collectionRevisions).reduce((latest, timestamp) => (timestamp > latest ? timestamp : latest), updatedAt);
  return { revision, updatedAt, collectionRevisions };
}

export function buildAppAuthData(data: AppData, updatedAt = new Date().toISOString()): AppAuthData {
  return {
    updatedAt,
    users: data.users,
    teams: data.teams,
    kpiItems: data.kpiItems,
  };
}

async function readLocalJson<T>(paths: string[]) {
  for (const filePath of paths) {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as T;
    } catch {
      // Try the next available storage location.
    }
  }
  return null;
}

async function writeLocalJson(paths: { dir: string; file: string }[], data: unknown) {
  for (const target of paths) {
    try {
      await mkdir(target.dir, { recursive: true });
      await writeFile(target.file, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch {
      // Vercel deployments are read-only except for tmp; keep the fallback path.
    }
  }
  return false;
}

function writeTargets(filePath: string, runtimeFilePath: string) {
  return process.env.VERCEL
    ? [
        { dir: runtimeDataDir, file: runtimeFilePath },
        { dir: dataDir, file: filePath },
      ]
    : [
        { dir: dataDir, file: filePath },
        { dir: runtimeDataDir, file: runtimeFilePath },
      ];
}

async function writeSidecarData(data: AppData, updatedAt = new Date().toISOString()) {
  const meta = buildAppDataMeta(data, updatedAt);
  const auth = buildAppAuthData(data, updatedAt);
  await Promise.all([
    writeBlobJson(blobMetaPath, meta),
    writeBlobJson(blobAuthPath, auth),
    writeLocalJson(writeTargets(metaPath, runtimeMetaPath), meta),
    writeLocalJson(writeTargets(authPath, runtimeAuthPath), auth),
  ]);
  metaMemoryCache = { cachedAt: Date.now(), data: meta };
  authMemoryCache = { cachedAt: Date.now(), data: auth };
  return { meta, auth };
}

async function ensureSidecarData() {
  const data = await readAppData({ skipMetaCheck: true });
  return writeSidecarData(data);
}

export async function readAppDataMeta(): Promise<AppDataMeta> {
  if (metaMemoryCache && Date.now() - metaMemoryCache.cachedAt < sidecarCacheTtlMs) return metaMemoryCache.data;
  const blobMeta = await readBlobJson<AppDataMeta>(blobMetaPath);
  if (blobMeta) {
    metaMemoryCache = { cachedAt: Date.now(), data: blobMeta };
    return blobMeta;
  }
  const localMeta = await readLocalJson<AppDataMeta>(metaReadPaths());
  if (localMeta) {
    metaMemoryCache = { cachedAt: Date.now(), data: localMeta };
    return localMeta;
  }
  return (await ensureSidecarData()).meta;
}

export async function readAppAuthData(): Promise<AppAuthData> {
  if (authMemoryCache && Date.now() - authMemoryCache.cachedAt < sidecarCacheTtlMs) return authMemoryCache.data;
  const blobAuth = await readBlobJson<AppAuthData>(blobAuthPath);
  if (blobAuth) {
    authMemoryCache = { cachedAt: Date.now(), data: blobAuth };
    return blobAuth;
  }
  const localAuth = await readLocalJson<AppAuthData>(authReadPaths());
  if (localAuth) {
    authMemoryCache = { cachedAt: Date.now(), data: localAuth };
    return localAuth;
  }
  return (await ensureSidecarData()).auth;
}

export async function readAppData(options: { skipMetaCheck?: boolean } = {}): Promise<AppData> {
  const meta = options.skipMetaCheck ? null : await readAppDataMeta().catch(() => null);
  if (meta && appDataMemoryCache?.revision === meta.revision) return appDataMemoryCache.data;

  const blobData = await readBlobAppData();
  if (blobData) {
    appDataMemoryCache = { revision: meta?.revision ?? buildAppDataMeta(blobData).revision, data: blobData };
    return blobData;
  }

  for (const filePath of readPaths()) {
    try {
      const raw = await readFile(filePath, "utf8");
      const normalized = normalizeAppData(JSON.parse(raw) as AppData);
      appDataMemoryCache = { revision: meta?.revision ?? buildAppDataMeta(normalized).revision, data: normalized };
      return normalized;
    } catch {
      // Try the next available storage location.
    }
  }

  if (process.env.VERCEL || canUseBlobStore()) {
    throw new Error("App data storage is unavailable.");
  }

  return seedData;
}

export async function writeAppData(data: AppData) {
  const blobData = await writeBlobAppData(data);
  if (blobData) {
    const { meta } = await writeSidecarData(blobData);
    appDataMemoryCache = { revision: meta.revision, data: blobData };
    return blobData;
  }

  const normalized = normalizeAppData(data);
  const { meta } = await writeSidecarData(normalized);
  appDataMemoryCache = { revision: meta.revision, data: normalized };
  for (const target of writeTargets(dbPath, runtimeDbPath)) {
    try {
      await mkdir(target.dir, { recursive: true });
      await writeFile(target.file, JSON.stringify(normalized, null, 2), "utf8");
      return normalized;
    } catch {
      // Vercel deployments are read-only except for tmp; keep the fallback path.
    }
  }

  throw new Error("Unable to persist app data.");
}

export function normalizeAppData(data: AppData): AppData {
  const fixed = fixMojibakeStrings(data) as AppData;
  return {
    ...fixed,
    users: (fixed.users ?? []).map((user) => normalizeUserLogin(user)),
    teams: fixed.teams ?? [],
    kpiItems: ensureCoreKpis(fixed.kpiItems ?? []),
    kpiTargets: fixed.kpiTargets ?? [],
    kpiRecords: fixed.kpiRecords ?? [],
    kpiRecordHistories: fixed.kpiRecordHistories ?? [],
    attendanceRecords: fixed.attendanceRecords ?? [],
    deals: normalizeDeals(fixed.deals ?? [], fixed.users ?? []),
    trainingSchedules: (fixed.trainingSchedules ?? []).map((schedule) => ({
      ...schedule,
      sessions: (schedule.sessions ?? []).map((session, index) => ({
        ...session,
        sessionNumber: Number.isFinite(Number(session.sessionNumber)) && Number(session.sessionNumber) > 0
          ? Math.floor(Number(session.sessionNumber))
          : index + 1,
        endDate: session.endDate || session.startDate,
        notes: session.notes ?? "",
        updatedAt: session.updatedAt || schedule.updatedAt,
      })),
    })),
    reports: (fixed.reports ?? []).map((report) => ({
      ...report,
      nextKpis: report.nextKpis ?? [],
      aiFeedback: normalizeReportFeedback(report.aiFeedback),
      readByUserIds: report.readByUserIds ?? [],
    })),
    reportComments: fixed.reportComments ?? [],
    notifications: fixed.notifications ?? [],
    announcements: (fixed.announcements ?? []).map((announcement) => ({
      ...announcement,
      important: announcement.important ?? /重要|至急|緊急|必須/.test(announcement.message ?? ""),
      attachments: announcement.attachments ?? [],
      readByUserIds: announcement.readByUserIds ?? [],
    })),
    qualitativeInsights: fixed.qualitativeInsights ?? [],
    auditLogs: fixed.auditLogs ?? [],
  };
}

function defaultEmailForUser(userId: string) {
  const defaults: Record<string, string> = {
    "u-murakami-rin": "r.murakami@saitekidenki.jp",
    "u-nojiri-kota": "nojiri@example.com",
    "u-kanemitsu-keita": "kanemitsu@example.com",
  };
  return defaults[userId] ?? `${userId.replace(/[^a-zA-Z0-9]/g, "-")}@example.com`;
}

function defaultPasswordForUser(userId: string) {
  const defaults: Record<string, string> = {
    "u-murakami-rin": "Pass3205",
    "u-nojiri-kota": "nojiri123",
    "u-kanemitsu-keita": "kanemitsu123",
  };
  return defaults[userId] ?? "password123";
}

function normalizeUserLogin(user: AppData["users"][number]) {
  const email = user.email || defaultEmailForUser(user.id);
  const password = user.password || defaultPasswordForUser(user.id);
  if (user.id !== "u-murakami-rin") return { ...user, email, password };
  return {
    ...user,
    name: user.name === "村上 凛" ? "村上 輪" : user.name,
    email: !user.email || user.email === "rin@example.com" ? "r.murakami@saitekidenki.jp" : user.email,
    password: !user.password || user.password === "rin123" ? "Pass3205" : user.password,
  };
}

function normalizeDeals(deals: AppData["deals"], users: AppData["users"]) {
  const demoDealIds = new Set(["deal-1", "deal-2", "deal-3", "deal-4"]);
  const userIds = new Set(users.map((user) => user.id));
  const legacyUserMap: Record<string, string> = {
    "u-member-1": "u-murakami-rin",
    "u-member-2": "u-nojiri-kota",
    "u-member-3": "u-kanemitsu-keita",
  };
  return deals
    .filter((deal) => !demoDealIds.has(deal.id))
    .map((deal) => {
      const mappedUserId = userIds.has(deal.userId) ? deal.userId : legacyUserMap[deal.userId] ?? deal.userId;
      return {
        ...deal,
        userId: mappedUserId,
        description: deal.description ?? "",
        rank: deal.rank ?? rankFromStage(deal.stage),
        lastActionDate: deal.lastActionDate ?? deal.completedAt ?? deal.createdAt,
      };
    });
}

function rankFromStage(stage: AppData["deals"][number]["stage"]): AppData["deals"][number]["rank"] {
  if (stage === "contract_planned" || stage === "contract" || stage === "lost") return stage;
  return "a";
}

function ensureCoreKpis(items: AppData["kpiItems"]) {
  const coreItems: AppData["kpiItems"] = [
    { id: "kpi-calls", name: "架電数", unit: "件", description: "電話による接触数", active: true },
    { id: "kpi-ap", name: "AP数", unit: "件", description: "日次入力ベースのAP数", active: true },
    { id: "kpi-meetings", name: "初回商談数", unit: "件", description: "日次入力ベースの初回商談数", active: true },
    { id: "kpi-reclose", name: "再クロ数", unit: "件", description: "日次入力ベースの再クロ数", active: true },
    { id: "kpi-orders", name: "契約数", unit: "件", description: "案件ベースの契約数", active: true },
    { id: "kpi-sales", name: "売上", unit: "万円", description: "税抜売上", active: true },
    { id: "kpi-utilization", name: "稼働率", unit: "%", description: "出勤チェックへ移行済み", active: false },
  ];
  const coreIds = new Set(coreItems.map((item) => item.id));
  const existingById = new Map(items.map((item) => [item.id, item]));
  const core = coreItems.map((item) => ({ ...existingById.get(item.id), ...item }));
  const custom = items.filter((item) => !coreIds.has(item.id));
  return [...core, ...custom];
}

function fixMojibakeStrings(value: unknown): unknown {
  if (typeof value === "string") return fixLatin1Mojibake(value);
  if (Array.isArray(value)) return value.map(fixMojibakeStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, fixMojibakeStrings(entry)]));
  }
  return value;
}

function fixLatin1Mojibake(text: string) {
  if (!/[ÃÂãäåæçèé]/.test(text)) return text;
  const fixed = Buffer.from(text, "latin1").toString("utf8");
  return fixed.includes("・ｽ") ? text : fixed;
}
