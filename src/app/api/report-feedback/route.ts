import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCriteriaReportFeedback, buildReportEvidenceSummary, type ReportFeedbackInput } from "@/lib/report-feedback";
import { readAppAuthData } from "@/lib/store";
import type { ReportContent, ReportKpiPlan, ReportType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

const feedbackSchema = z.object({
  specificPoints: z.array(z.string().min(1).max(280)).min(1).max(4),
  goodPoints: z.array(z.string().min(1).max(240)).max(5),
  missingPoints: z.array(z.string().min(1).max(240)).max(5),
  improvementPoints: z.array(z.string().min(1).max(240)).min(1).max(5),
});

function cleanContent(content: Partial<ReportContent> | undefined): ReportContent {
  return {
    activity: String(content?.activity ?? "").slice(0, 4000),
    result: String(content?.result ?? "").slice(0, 4000),
    issue: String(content?.issue ?? "").slice(0, 4000),
    nextPlan: String(content?.nextPlan ?? "").slice(0, 4000),
    insight: String(content?.insight ?? "").slice(0, 4000),
  };
}

function reportTypeLabel(reportType: ReportType) {
  if (reportType === "weekly") return "週報";
  if (reportType === "monthly") return "月報";
  return "日報";
}

export async function POST(request: Request) {
  const authData = await readAppAuthData();
  const userId = request.headers.get("x-app-user-id") ?? "";
  const password = (request.headers.get("x-app-password") ?? "").trim();
  const user = authData.users.find((item) => item.id === userId && item.password === password);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = (await request.json()) as Partial<ReportFeedbackInput>;
  const reportType: ReportType = body.reportType === "weekly" || body.reportType === "monthly" ? body.reportType : "daily";
  const content = cleanContent(body.content);
  const nextKpis: ReportKpiPlan[] = Array.isArray(body.nextKpis)
    ? body.nextKpis.slice(0, 30).map((plan) => ({
        kpiItemId: String(plan.kpiItemId ?? ""),
        targetValue: Number(plan.targetValue) || 0,
      }))
    : [];
  const kpiItems = Array.isArray(body.kpiItems)
    ? body.kpiItems.slice(0, 30).map((item) => ({
        id: String(item.id ?? ""),
        name: String(item.name ?? "").slice(0, 80),
        unit: String(item.unit ?? "").slice(0, 30),
      }))
    : [];
  const periodKpis = Array.isArray(body.periodKpis)
    ? body.periodKpis.slice(0, 30).map((item) => ({
        kpiItemId: String(item.kpiItemId ?? ""),
        name: String(item.name ?? "").slice(0, 80),
        unit: String(item.unit ?? "").slice(0, 30),
        actualValue: Number(item.actualValue) || 0,
        targetValue: Number(item.targetValue) || 0,
      }))
    : [];
  const input: ReportFeedbackInput = { reportType, content, nextKpis, kpiItems, periodKpis };
  const fallback = buildCriteriaReportFeedback(input);
  const evidenceSummary = buildReportEvidenceSummary(input);
  const kpiSummary = nextKpis
    .filter((plan) => plan.targetValue > 0)
    .map((plan) => {
      const item = kpiItems.find((candidate) => candidate.id === plan.kpiItemId);
      return `${item?.name ?? "KPI"}: ${plan.targetValue}${item?.unit ?? ""}`;
    })
    .join("、");
  const periodKpiSummary = periodKpis
    .map((item) => {
      const gap = item.actualValue - item.targetValue;
      const achievement = item.targetValue > 0 ? Math.round((item.actualValue / item.targetValue) * 100) : null;
      return `${item.name}: 実績${item.actualValue}${item.unit} / 目標${item.targetValue}${item.unit} / 差分${gap >= 0 ? "+" : ""}${gap}${item.unit}${achievement === null ? "" : ` / 達成率${achievement}%`}`;
    })
    .join("、");

  try {
    const { output } = await generateText({
      model: "openai/gpt-5.4",
      output: Output.object({
        schema: feedbackSchema,
        name: "report_feedback",
        description: "提出された営業日報・週報・月報への日本語フィードバック",
      }),
      maxOutputTokens: 1600,
      abortSignal: AbortSignal.timeout(20000),
      system: [
        "あなたは営業組織の報告書を評価する実務コーチです。",
        "出力は日本語の簡潔な文章にし、記載内容から確認できる事実だけを評価してください。",
        "specificPointsは必ず1件以上にし、本文中の具体的な行動、成果、課題、予定、所感、数字、案件状況のいずれかに直接触れた個別フィードバックにしてください。",
        "specificPointsでは汎用的な助言だけを並べず、できる限り本文の具体表現を短く引用または言及して、その記載に対する次の改善を書いてください。",
        "同じ報告内容でなければ成立しない文章にし、どの報告にも当てはまるテンプレート文は避けてください。",
        "良い点がなければgoodPointsを空配列にしてください。",
        "不足点がなければmissingPointsを空配列にしてください。",
        "improvementPointsは必ず1件以上にしてください。",
        "基本評価軸は、具体的に記入できているか、不足点と改善点が明確か、数字に基づいた記入か、の3点です。",
        "追加評価軸1は進捗と結果です。対象期間KPIの実績・目標・差分・達成率を確認し、未達の場合は遅れの原因が本文に記載されているか評価してください。",
        "追加評価軸2は顧客のリアルな反応と市場動向です。顧客の生の声、競合状況、サービスへの反応、断られた理由、案件フェーズ、受注確度が具体的か評価してください。",
        "追加評価軸3は次のアクションです。課題に対する仮説、具体的な改善策、実施期限、自分なりの判断や対策案が記載されているか評価してください。",
        "追加評価軸4は組織への展開価値です。成功・失敗事例から、他メンバーが再現または回避できるノウハウや注意点が含まれているか評価してください。",
        "対象期間KPIはシステム集計値です。本文と食い違う場合は不足点として指摘し、本文にない原因・顧客反応・案件確度を推測で補わないでください。",
        "抽象的な称賛や人格評価は避け、どの記載をどう改善すべきか具体的に示してください。",
        "Markdown記法や見出し記号は使わず、各配列要素を一つの短い文章にしてください。",
      ].join("\n"),
      prompt: [
        `対象: ${reportTypeLabel(reportType)}`,
        `活動内容: ${content.activity || "未記入"}`,
        `達成した成果: ${content.result || "未記入"}`,
        `課題・困りごと: ${content.issue || "未記入"}`,
        `次の予定・目標: ${content.nextPlan || "未記入"}`,
        `所感・気づき: ${content.insight || "未記入"}`,
        `本文から抽出した具体要素: ${evidenceSummary || "具体要素なし"}`,
        `対象期間KPI: ${periodKpiSummary || "集計対象なし"}`,
        `次回KPI目標: ${kpiSummary || "未設定"}`,
      ].join("\n"),
    });
    return NextResponse.json(
      {
        ...output,
        generatedAt: new Date().toISOString(),
        source: "ai",
      },
      { headers },
    );
  } catch (error) {
    console.warn("AI report feedback generation failed; criteria fallback used.", error instanceof Error ? error.message : error);
    return NextResponse.json(fallback, { headers: { ...headers, "x-report-feedback-source": "criteria" } });
  }
}
