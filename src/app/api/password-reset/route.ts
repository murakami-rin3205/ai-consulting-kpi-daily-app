import { NextResponse } from "next/server";
import { readAppData, writeAppData } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  const loginEmail = String(email ?? "").trim().toLowerCase();
  const nextPassword = String(password ?? "").trim();

  if (!loginEmail || !nextPassword) {
    return NextResponse.json({ error: "メールアドレスと新しいパスワードを入力してください。" }, { status: 400, headers });
  }

  if (nextPassword.length < 4) {
    return NextResponse.json({ error: "新しいパスワードは4文字以上で入力してください。" }, { status: 400, headers });
  }

  const data = await readAppData();
  const user = data.users.find((item) => item.email.toLowerCase() === loginEmail);

  if (!user) {
    return NextResponse.json({ error: "登録済みのメールアドレスが見つかりません。" }, { status: 404, headers });
  }

  const now = new Date().toISOString();
  const savedData = await writeAppData({
    ...data,
    users: data.users.map((item) => (item.id === user.id ? { ...item, password: nextPassword } : item)),
    auditLogs: [
      {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        actorId: user.id,
        action: "パスワード再設定",
        targetType: "member",
        targetId: user.id,
        summary: `ログイン画面から「${user.name}」のパスワードを再設定`,
        createdAt: now,
      },
      ...(data.auditLogs ?? []),
    ],
  });

  return NextResponse.json({ ok: true, userId: user.id, data: savedData }, { headers });
}
