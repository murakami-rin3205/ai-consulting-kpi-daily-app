import { NextResponse } from "next/server";
import { appDataCollections, normalizeAppData, readAppAuthData, readAppData, readAppDataMeta, writeAppData } from "@/lib/store";
import type { AppData, User } from "@/lib/types";
import type { AppDataCollection } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const appDataHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type SyncCollection = AppDataCollection;

const syncCollections = appDataCollections;
const untimedCollections = new Set<SyncCollection>(["users", "teams", "kpiItems"]);

type AppDataPatch = {
  baseRevision?: string;
  collections?: Partial<Pick<AppData, SyncCollection>>;
  deletedIds?: Partial<Record<SyncCollection, string[]>>;
};

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401, headers: appDataHeaders });
}

function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403, headers: appDataHeaders });
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function timestampFor(collection: SyncCollection, item: { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }) {
  if (collection === "notifications") return item.resolvedAt ?? item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
  return item.updatedAt ?? item.changedAt ?? item.createdAt ?? "";
}

function computeAppDataRevision(data: AppData) {
  return syncCollections.reduce((latest, collection) => {
    if (untimedCollections.has(collection)) return latest;
    const items = data[collection] as { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }[];
    const collectionLatest = items.reduce((entryLatest, item) => {
      const timestamp = timestampFor(collection, item);
      return timestamp > entryLatest ? timestamp : entryLatest;
    }, "");
    return collectionLatest > latest ? collectionLatest : latest;
  }, "");
}

function collectionSince(url: URL, collection: SyncCollection, fallback: string) {
  return url.searchParams.get(`${collection}Since`) ?? fallback;
}

function pickCollectionRevisions(meta: { collectionRevisions: Record<SyncCollection, string> }, collections: SyncCollection[]) {
  return Object.fromEntries(collections.map((collection) => [collection, meta.collectionRevisions[collection] ?? ""])) as Partial<
    Record<SyncCollection, string>
  >;
}

async function authenticateLightweight(request: Request) {
  const authData = await readAppAuthData();
  const userId = request.headers.get("x-app-user-id") ?? "";
  const password = (request.headers.get("x-app-password") ?? "").trim();
  const user = authData.users.find((item) => item.id === userId && item.password === password);
  return { authData, user };
}

async function authenticate(request: Request) {
  const { user } = await authenticateLightweight(request);
  if (!user) return { data: null, user: null };
  const data = await readAppData();
  return { data, user };
}

function canMutateUsers(currentUsers: User[], nextUsers: User[], actor: User) {
  if (actor.role === "admin") return true;
  if (currentUsers.length !== nextUsers.length) return false;
  const currentById = new Map(currentUsers.map((user) => [user.id, user]));
  return nextUsers.every((nextUser) => {
    const currentUser = currentById.get(nextUser.id);
    if (!currentUser) return false;
    if (nextUser.id !== actor.id) return sameJson(nextUser, currentUser);
    return (
      nextUser.id === currentUser.id &&
      nextUser.name === currentUser.name &&
      nextUser.role === currentUser.role &&
      nextUser.teamId === currentUser.teamId &&
      nextUser.position === currentUser.position
    );
  });
}

function canMutateAppData(current: AppData, next: AppData, actor: User) {
  if (actor.role === "admin") return true;
  return sameJson(current.teams, next.teams) && canMutateUsers(current.users, next.users, actor);
}

function preserveNewerItems<T extends { id: string }>(
  currentItems: T[],
  nextItems: T[],
  baseRevision: string,
  timestampFor: (item: T) => string,
) {
  if (!baseRevision) return nextItems;
  const nextById = new Map(nextItems.map((item) => [item.id, item]));
  const mergedById = new Map(nextById);
  currentItems.forEach((currentItem) => {
    const currentTimestamp = timestampFor(currentItem);
    const nextItem = nextById.get(currentItem.id);
    const nextTimestamp = nextItem ? timestampFor(nextItem) : "";
    if (currentTimestamp > baseRevision && currentTimestamp > nextTimestamp) {
      mergedById.set(currentItem.id, currentItem);
    }
  });
  return Array.from(mergedById.values());
}

function mergeConcurrentUpdates(current: AppData, next: AppData, baseRevision: string): AppData {
  return {
    ...next,
    kpiTargets: preserveNewerItems(current.kpiTargets, next.kpiTargets, baseRevision, (item) => item.updatedAt),
    kpiRecords: preserveNewerItems(current.kpiRecords, next.kpiRecords, baseRevision, (item) => item.updatedAt),
    kpiRecordHistories: preserveNewerItems(current.kpiRecordHistories, next.kpiRecordHistories, baseRevision, (item) => item.changedAt),
    attendanceRecords: preserveNewerItems(current.attendanceRecords, next.attendanceRecords, baseRevision, (item) => item.updatedAt),
    deals: preserveNewerItems(current.deals, next.deals, baseRevision, (item) => item.updatedAt),
    trainingSchedules: preserveNewerItems(current.trainingSchedules, next.trainingSchedules, baseRevision, (item) => item.updatedAt),
    reports: preserveNewerItems(current.reports, next.reports, baseRevision, (item) => item.updatedAt),
    reportComments: preserveNewerItems(current.reportComments, next.reportComments, baseRevision, (item) => item.createdAt),
    notifications: preserveNewerItems(current.notifications, next.notifications, baseRevision, (item) => item.resolvedAt ?? item.createdAt),
    announcements: preserveNewerItems(current.announcements, next.announcements, baseRevision, (item) => item.updatedAt),
    auditLogs: preserveNewerItems(current.auditLogs, next.auditLogs, baseRevision, (item) => item.createdAt),
  };
}

export async function GET(request: Request) {
  const { authData, user } = await authenticateLightweight(request);
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (mode === "changes" || mode === "notifications") {
    const since = url.searchParams.get("since") ?? "";
    const meta = await readAppDataMeta();
    const requestedCollections =
      mode === "notifications"
        ? (["notifications", "announcements", "deals", "reports"] as SyncCollection[])
        : [...url.searchParams.getAll("collection"), ...url.searchParams.getAll("collections")].filter(
            (collection): collection is SyncCollection => syncCollections.includes(collection as SyncCollection),
          );
    const collectionRevisions = pickCollectionRevisions(meta, requestedCollections);
    const changedCollections = requestedCollections.filter((collection) => (meta.collectionRevisions[collection] ?? "") > collectionSince(url, collection, since));
    if (changedCollections.length === 0) {
      return NextResponse.json({ revision: meta.revision, collections: {}, collectionRevisions }, { headers: appDataHeaders });
    }
    if (changedCollections.every((collection) => untimedCollections.has(collection))) {
      const untimedData: Pick<AppData, "users" | "teams" | "kpiItems"> = {
        users: authData.users,
        teams: authData.teams,
        kpiItems: authData.kpiItems,
      };
      const collections = Object.fromEntries(
        changedCollections.map((collection) => [collection, untimedData[collection as keyof typeof untimedData]]),
      );
      return NextResponse.json(
        {
          revision: meta.revision,
          collections,
          collectionRevisions,
          replaceCollections: changedCollections,
        },
        { headers: appDataHeaders },
      );
    }
    const data = await readAppData();
    const collections = Object.fromEntries(
      changedCollections.map((collection) => [
        collection,
        mode === "notifications" || untimedCollections.has(collection)
          ? data[collection]
          : (data[collection] as { updatedAt?: string; createdAt?: string; changedAt?: string; resolvedAt?: string }[]).filter(
              (item) => timestampFor(collection, item) > collectionSince(url, collection, since),
            ),
      ]),
    );
    return NextResponse.json(
      {
        revision: meta.revision,
        collections,
        collectionRevisions,
        replaceCollections: changedCollections.filter((collection) => mode === "notifications" || untimedCollections.has(collection)),
      },
      { headers: appDataHeaders },
    );
  }
  const data = await readAppData();
  return NextResponse.json(data, { headers: appDataHeaders });
}

export async function PUT(request: Request) {
  const { data: currentData, user } = await authenticate(request);
  if (!user || !currentData) return unauthorized();
  const data = normalizeAppData((await request.json()) as AppData);
  if (!canMutateAppData(currentData, data, user)) return forbidden("権限のない設定変更は保存できません。");
  const mergedData = mergeConcurrentUpdates(currentData, data, request.headers.get("x-app-data-revision") ?? "");
  const savedData = await writeAppData(mergedData);
  return NextResponse.json(savedData, { headers: appDataHeaders });
}

function applyPatch(current: AppData, patch: AppDataPatch): AppData {
  const next: AppData = { ...current };
  for (const collection of syncCollections) {
    const incoming = patch.collections?.[collection];
    const deletedIds = new Set(patch.deletedIds?.[collection] ?? []);
    if (!incoming && deletedIds.size === 0) continue;

    const currentItems = current[collection] as { id: string }[];
    const incomingItems = (incoming ?? []) as { id: string }[];
    const byId = new Map(currentItems.filter((item) => !deletedIds.has(item.id)).map((item) => [item.id, item]));
    incomingItems.forEach((item) => byId.set(item.id, item));
    (next[collection] as { id: string }[]) = Array.from(byId.values());
  }
  return next;
}

function pickChangedCollections(savedData: AppData, patch: AppDataPatch) {
  const collections: Partial<Pick<AppData, SyncCollection>> = {};
  for (const collection of syncCollections) {
    const incoming = patch.collections?.[collection];
    const deletedIds = patch.deletedIds?.[collection] ?? [];
    if (!incoming && deletedIds.length === 0) continue;
    if (untimedCollections.has(collection) || deletedIds.length > 0) {
      collections[collection] = savedData[collection] as never;
      continue;
    }
    const ids = new Set(((incoming ?? []) as { id: string }[]).map((item) => item.id));
    collections[collection] = (savedData[collection] as { id: string }[]).filter((item) => ids.has(item.id)) as never;
  }
  return collections;
}

function replaceCollectionsForPatch(patch: AppDataPatch) {
  return syncCollections.filter((collection) => {
    const deleted = (patch.deletedIds?.[collection] ?? []).length > 0;
    const untimedChanged = untimedCollections.has(collection) && (patch.collections?.[collection]?.length ?? 0) > 0;
    return deleted || untimedChanged;
  });
}

export async function PATCH(request: Request) {
  const { data: currentData, user } = await authenticate(request);
  if (!user || !currentData) return unauthorized();
  const patch = (await request.json()) as AppDataPatch;
  const patchedData = normalizeAppData(applyPatch(currentData, patch));
  if (!canMutateAppData(currentData, patchedData, user)) return forbidden("このアカウントでは権限外の設定変更は保存できません。");
  const savedData = await writeAppData(patchedData);
  const meta = await readAppDataMeta();
  const changedCollections = Array.from(new Set([...Object.keys(patch.collections ?? {}), ...Object.keys(patch.deletedIds ?? {})])).filter(
    (collection): collection is SyncCollection => syncCollections.includes(collection as SyncCollection),
  );
  return NextResponse.json(
    {
      revision: meta.revision || computeAppDataRevision(savedData),
      collections: pickChangedCollections(savedData, patch),
      replaceCollections: replaceCollectionsForPatch(patch),
      collectionRevisions: pickCollectionRevisions(meta, changedCollections),
    },
    { headers: appDataHeaders },
  );
}
