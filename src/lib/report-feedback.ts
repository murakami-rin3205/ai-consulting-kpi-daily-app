import type { KpiItem, ReportAiFeedback, ReportContent, ReportKpiPlan, ReportType } from "./types";

export type ReportFeedbackInput = {
  reportType: ReportType;
  content: ReportContent;
  nextKpis: ReportKpiPlan[];
  kpiItems: Pick<KpiItem, "id" | "name" | "unit">[];
  periodKpis: Array<{
    kpiItemId: string;
    name: string;
    unit: string;
    actualValue: number;
    targetValue: number;
  }>;
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

const reportContentLabels: Record<keyof ReportContent, string> = {
  activity: "活動内容",
  result: "成果",
  issue: "課題",
  nextPlan: "次の予定",
  insight: "所感",
};

function snippetText(value: string, maxLength = 56) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

function reportSpecificSnippets(content: ReportContent) {
  return (Object.entries(reportContentLabels) as [keyof ReportContent, string][])
    .map(([key, label]) => ({ key, label, text: snippetText(content[key]) }))
    .filter((item) => item.text.length > 0);
}

export function buildReportEvidenceSummary(input: ReportFeedbackInput) {
  const snippets = reportSpecificSnippets(input.content)
    .slice(0, 8)
    .map((item) => `${item.label}: 「${item.text}」`);
  const notableKpis = input.periodKpis
    .filter((item) => item.targetValue > 0)
    .slice(0, 8)
    .map((item) => {
      const achievement = Math.round((item.actualValue / item.targetValue) * 100);
      const gap = item.actualValue - item.targetValue;
      return `${item.name}: 実績${item.actualValue}${item.unit} / 目標${item.targetValue}${item.unit} / 差分${gap >= 0 ? "+" : ""}${gap}${item.unit} / 達成率${achievement}%`;
    });
  return [...snippets, ...notableKpis].join("\n");
}

export function normalizeReportFeedback(feedback: Partial<ReportAiFeedback> | null | undefined): ReportAiFeedback | undefined {
  if (!feedback) return undefined;
  const improvementPoints = unique((feedback.improvementPoints ?? []).map(compactText));
  if (improvementPoints.length === 0) return undefined;
  return {
    specificPoints: unique((feedback.specificPoints ?? []).map(compactText)).slice(0, 4),
    goodPoints: unique((feedback.goodPoints ?? []).map(compactText)).slice(0, 5),
    missingPoints: unique((feedback.missingPoints ?? []).map(compactText)).slice(0, 5),
    improvementPoints: improvementPoints.slice(0, 5),
    generatedAt: feedback.generatedAt || new Date().toISOString(),
    source: feedback.source === "ai" ? "ai" : "criteria",
  };
}

export function buildCriteriaReportFeedback(input: ReportFeedbackInput): ReportAiFeedback {
  const values = Object.values(input.content).map(compactText);
  const filledCount = values.filter(Boolean).length;
  const totalLength = values.join("").length;
  const bodyText = values.join(" ");
  const hasNumber = /\d/.test(bodyText);
  const hasConcreteSubject = /(顧客|企業|会社|案件|担当|架電|AP|アポ|商談|相手|先方|チーム|メンバー)/i.test(bodyText);
  const hasConcreteTiming = /(\d{1,2}[月日時分]|今日|明日|今週|来週|午前|午後)/.test(bodyText);
  const hasProgressReference = /(目標|実績|差分|達成率|進捗|計画|予実)/.test(bodyText);
  const hasGapCause = /(原因|要因|理由|ため|不足|遅れ|未達|課題)/.test(
    [input.content.result, input.content.issue, input.content.insight].join(" "),
  );
  const hasCustomerReaction = /(顧客|先方|相手).{0,16}(反応|声|要望|懸念|評価|断|失注|好感|興味|検討)/.test(bodyText);
  const hasMarketInsight = /(競合|市場|相場|ニーズ|トレンド|失注要因|断られた理由)/.test(bodyText);
  const hasDealCertainty = /(フェーズ|検討|見積|交渉|稟議|決裁|受注確度|確度|契約予定|\d{1,3}%)/.test(bodyText);
  const hasHypothesis = /(仮説|想定|見立て|と考え|と判断|試す|検証)/.test(
    [input.content.issue, input.content.nextPlan, input.content.insight].join(" "),
  );
  const hasKnowledgeValue = /(横展開|共有|再現|ノウハウ|成功事例|失敗事例|注意点|地雷|学び|他メンバー)/.test(bodyText);
  const issueText = compactText(input.content.issue);
  const nextPlanText = compactText(input.content.nextPlan);
  const resultText = compactText(input.content.result);
  const insightText = compactText(input.content.insight);
  const positiveNextKpis = input.nextKpis.filter((plan) => Number(plan.targetValue) > 0);
  const periodKpisWithTargets = input.periodKpis.filter((item) => item.targetValue > 0);
  const behindTargetKpis = periodKpisWithTargets.filter((item) => item.actualValue < item.targetValue);
  const specificSnippets = reportSpecificSnippets(input.content);
  const strongestBehindKpi = behindTargetKpis.sort((a, b) => {
    const aRate = a.targetValue > 0 ? a.actualValue / a.targetValue : 1;
    const bRate = b.targetValue > 0 ? b.actualValue / b.targetValue : 1;
    return aRate - bRate;
  })[0];
  const specificPoints: string[] = [];
  const goodPoints: string[] = [];
  const missingPoints: string[] = [];
  const improvementPoints: string[] = [];

  const activitySnippet = specificSnippets.find((item) => item.key === "activity")?.text;
  const resultSnippet = specificSnippets.find((item) => item.key === "result")?.text;
  const issueSnippet = specificSnippets.find((item) => item.key === "issue")?.text;
  const nextPlanSnippet = specificSnippets.find((item) => item.key === "nextPlan")?.text;
  const insightSnippet = specificSnippets.find((item) => item.key === "insight")?.text;

  if (resultSnippet) {
    specificPoints.push(`成果欄の「${resultSnippet}」は今回の結果として扱えます。次回は、その成果につながった行動と目標との差分を併記すると再現性が高まります。`);
  }
  if (issueSnippet) {
    specificPoints.push(`課題欄の「${issueSnippet}」は改善対象として見えています。原因仮説、次に変える行動、実施期限を同じ文脈で書くと支援しやすくなります。`);
  }
  if (nextPlanSnippet) {
    specificPoints.push(`次の予定の「${nextPlanSnippet}」は行動方針として使えます。誰に、いつ、何件実行するかまで落とすと進捗確認がしやすくなります。`);
  }
  if (activitySnippet && specificPoints.length < 3) {
    specificPoints.push(`活動内容の「${activitySnippet}」は行動の概要が伝わります。対象案件名、接触数、相手の反応を分けて書くと内容がより具体的になります。`);
  }
  if (insightSnippet && specificPoints.length < 3) {
    specificPoints.push(`所感の「${insightSnippet}」は振り返りの材料になります。次回は、この気づきをどの行動に反映するかまで結び付けてください。`);
  }
  if (strongestBehindKpi && specificPoints.length < 4) {
    specificPoints.push(`${strongestBehindKpi.name}は実績${strongestBehindKpi.actualValue}${strongestBehindKpi.unit} / 目標${strongestBehindKpi.targetValue}${strongestBehindKpi.unit}です。本文内の行動と未達理由をつなげると、次の打ち手が判断しやすくなります。`);
  }
  if (specificPoints.length === 0) {
    specificPoints.push("今回の本文は具体的な行動・成果・課題の記載が少ないため、次回は実施した行動、相手の反応、数字、次の打ち手を一つの流れで記載してください。");
  }

  if (filledCount >= 4 && totalLength >= 120) {
    goodPoints.push("活動・成果・課題・次の予定が複数の項目に分けて記載され、振り返りの流れを追いやすくできています。");
  }
  if (hasNumber && resultText.length >= 8) {
    goodPoints.push("成果を件数や金額などの数字と結び付けており、実績を客観的に確認できます。");
  }
  if (issueText.length >= 20 && nextPlanText.length >= 15) {
    goodPoints.push("課題と次の行動がそれぞれ記載され、不足点から改善行動へのつながりが明確です。");
  }
  if (periodKpisWithTargets.length > 0 && hasProgressReference && hasNumber) {
    goodPoints.push("対象期間の実績を目標や進捗と結び付けており、予実の差を確認できる内容です。");
  }
  if (hasCustomerReaction || hasMarketInsight) {
    goodPoints.push("顧客の反応や市場・競合の情報が含まれ、現場で得た一次情報を共有できています。");
  }
  if (hasDealCertainty) {
    goodPoints.push("案件のフェーズや受注確度が記載され、今後の見通しを判断できます。");
  }
  if (nextPlanText.length >= 20 && hasConcreteTiming && hasHypothesis) {
    goodPoints.push("仮説を踏まえた次の行動と実施時期が具体的で、自立的な改善行動につながっています。");
  }
  if (hasKnowledgeValue) {
    goodPoints.push("成功・失敗から得た学びが、他メンバーにも展開できるナレッジとして記載されています。");
  }

  if (filledCount < 4 || totalLength < 90) {
    missingPoints.push("記載量が少なく、実施したこと・得られた成果・課題・次の行動の関係を十分に確認できません。");
  }
  if (!hasConcreteSubject || !hasConcreteTiming) {
    missingPoints.push("誰に、いつ、何を行ったかという対象・時期・行動の情報が不足しています。");
  }
  if (!hasNumber && positiveNextKpis.length === 0) {
    missingPoints.push("件数、金額、達成率、目標値など、判断の根拠となる数字が記載されていません。");
  }
  if (issueText.length < 10) {
    missingPoints.push("不足している点や困っている点が具体化されておらず、改善対象を判断しにくい状態です。");
  }
  if (periodKpisWithTargets.length > 0 && (!hasProgressReference || !hasNumber)) {
    missingPoints.push("対象期間の実績、目標、差分、達成率の関係が本文から確認できません。");
  }
  if (behindTargetKpis.length > 0 && !hasGapCause) {
    missingPoints.push("目標未達のKPIがありますが、計画との差が生じた原因や遅れている理由が明確ではありません。");
  }
  if (!hasCustomerReaction && !hasMarketInsight) {
    missingPoints.push("顧客の生の反応、断られた理由、競合・市場動向などの現場情報が不足しています。");
  }
  if (!hasDealCertainty) {
    missingPoints.push("商談の現在フェーズや受注確度が記載されておらず、案件の見通しを判断できません。");
  }
  if (nextPlanText.length < 15 || !hasHypothesis) {
    missingPoints.push("課題に対する仮説と、次に行う具体的な改善策が十分に示されていません。");
  }
  if (!hasKnowledgeValue) {
    missingPoints.push("他メンバーへ横展開できる成功・失敗の学びや注意点が明確ではありません。");
  }

  if (!hasNumber) {
    improvementPoints.push("活動量・成果・目標について、「実績○件 / 目標○件」のように数字で記載してください。");
  } else {
    improvementPoints.push("記載した数字に対して、目標との差分とその数字になった理由まで加えると、次の打ち手を判断しやすくなります。");
  }
  if (!hasConcreteSubject || !hasConcreteTiming) {
    improvementPoints.push("対象者、実施日時、行動内容、相手の反応を一組にして記載し、第三者が状況を再現できる具体性を持たせてください。");
  }
  if (issueText.length < 10 || nextPlanText.length < 10) {
    improvementPoints.push("課題を一つに絞り、その原因と次回行う具体的な改善行動を期限付きで記載してください。");
  } else if (insightText.length < 12) {
    improvementPoints.push("今回の結果から得た気づきと、次回どの行動を変えるかを一文ずつ対応させて記載してください。");
  }
  if (periodKpisWithTargets.length > 0) {
    improvementPoints.push("主要KPIを「実績 / 目標 / 差分 / 達成率」で示し、未達の場合は原因を一つ以上記載してください。");
  }
  if (!hasCustomerReaction || !hasDealCertainty) {
    improvementPoints.push("顧客の発言や断られた理由を事実として記載し、案件フェーズと受注確度を併記してください。");
  }
  if (!hasHypothesis) {
    improvementPoints.push("課題への仮説、自分の判断、次に試す行動、実施期限を一組にして記載してください。");
  }
  if (!hasKnowledgeValue) {
    improvementPoints.push("今回の成功・失敗から、他メンバーが再現または回避できるノウハウ・注意点を一つ記載してください。");
  }

  return {
    specificPoints: unique(specificPoints).slice(0, 4),
    goodPoints: unique(goodPoints).slice(0, 5),
    missingPoints: unique(missingPoints).slice(0, 5),
    improvementPoints: unique(improvementPoints).slice(0, 5),
    generatedAt: new Date().toISOString(),
    source: "criteria",
  };
}
