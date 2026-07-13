import { NextResponse } from "next/server";
import { readAppAuthData, readAppData } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  const loginEmail = String(email ?? "").trim().toLowerCase();
  const loginPassword = String(password ?? "").trim();
  const authData = await readAppAuthData();
  const user = authData.users.find((item) => item.email.toLowerCase() === loginEmail && item.password === loginPassword);
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers });
  const data = await readAppData();
  return NextResponse.json({ userId: user.id, data }, { headers });
}
