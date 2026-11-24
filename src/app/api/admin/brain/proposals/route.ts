import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";

// 제안서 작성은 1~3분 걸릴 수 있음 (Vercel 함수 최대 실행 시간)
export const maxDuration = 300;

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `당신은 한국 정부·지자체 지원사업 제안서 작성을 돕는 전문 컨설턴트입니다.
신청 기업 정보와 지원사업 공고를 분석해, 서류 심사에 바로 다듬어 쓸 수 있는 제안서 초안을 한국어 마크다운으로 작성합니다.

작성 원칙:
- 공고의 지원 대상·지원 내용·평가 방식에 맞춰 기업의 실제 자산(플랫폼, 커뮤니티, 산학 네트워크, 공간)을 연결해 설득합니다.
- 기업 정보에 없는 수치(매출, 회원 수, 실적 등)는 지어내지 말고 "[확인 필요: ...]" 자리표시로 남깁니다.
- 공고상 신청 자격과 기업이 맞지 않아 보이는 부분이 있으면 초안 맨 앞 "⚠️ 자격 검토" 항목에 짧게 적습니다.
- 기업 정보에 alt_applicants(다른 신청 주체, 예: 대학)가 있으면, 글로벌아임 명의와 그 주체 명의 중 이 공고에 더 유리한 쪽을 자격 검토에서 추천하고 그 주체 기준으로 작성합니다.
- 기업 정보에 relocation(사업장 이전 예정)이 있으면, 지역 소재 요건을 판단할 때 이전 시점과 공고 접수·협약 시점을 비교해 언급합니다.
- 전문적이고 신뢰감 있는 비즈니스 톤을 유지합니다.

구성:
1. 신청 기업 개요 및 핵심 역량
2. 신청 배경 및 필요성
3. 사업 추진 계획 (세부 과제, 일정, 지원금 활용 항목과 비율)
4. 기대 효과 및 성과 목표 (정량·정성)`;

// GET: 최근 제안서 50건
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brain_proposals")
    .select("id, notice_id, notice_title, memo, content, model, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, proposals: data ?? [] });
}

// POST: 공고 + 사업자 프로필로 제안서 초안 생성. 본문을 텍스트 스트림으로 흘려보내고, 끝나면 DB에 저장.
export async function POST(request: Request) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!hasRole(getAdminRole(user), "manager")) {
    return forbiddenResponse("제안서 작성은 매니저 이상만 가능합니다.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ success: false, error: "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  let body: { noticeId?: unknown; memo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const noticeId = typeof body.noticeId === "string" ? body.noticeId : "";
  const memo = typeof body.memo === "string" ? body.memo.slice(0, 2000).trim() : "";
  if (!noticeId) {
    return NextResponse.json({ success: false, error: "noticeId가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: notice, error: noticeError }, { data: profileRow }] = await Promise.all([
    supabase.from("brain_notices").select("id, title, org, region, category, apply_start, deadline, target, description, url").eq("id", noticeId).maybeSingle(),
    supabase.from("brain_company_profile").select("profile").eq("id", 1).maybeSingle(),
  ]);
  if (noticeError || !notice) {
    return NextResponse.json({ success: false, error: "공고를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!profileRow?.profile) {
    return NextResponse.json({ success: false, error: "사업자 프로필을 먼저 저장해 주세요." }, { status: 400 });
  }

  const userPrompt = `<company_profile>
${JSON.stringify(profileRow.profile, null, 2)}
</company_profile>

<notice>
${JSON.stringify(notice, null, 2)}
</notice>

<memo>
${memo || "없음"}
</memo>

위 기업이 이 공고에 지원하는 제안서 초안을 작성해 주세요. 메모가 있으면 그 내용을 반드시 반영하세요.`;

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const msgStream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 32000,
          output_config: { effort: "high" },
          // 안전 분류기가 거절하면 서버에서 권장 모델로 자동 재시도
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await msgStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n[[ERROR]] Claude가 이 요청을 거절했습니다. 메모를 바꿔 다시 시도해 주세요."));
          return;
        }
        const content = final.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();
        if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n[[ERROR]] 길이 한도에 걸려 초안이 중간에 끊겼습니다."));
        }

        const { error } = await supabase.from("brain_proposals").insert({
          notice_id: notice.id,
          notice_title: notice.title,
          memo: memo || null,
          content,
          model: final.model,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          created_by: user?.email ?? null,
        });
        if (error) {
          controller.enqueue(encoder.encode(`\n\n[[ERROR]] 초안 저장 실패: ${error.message}`));
        }
      } catch (e) {
        const msg =
          e instanceof Anthropic.AuthenticationError ? "Anthropic API 키가 올바르지 않습니다."
          : e instanceof Anthropic.RateLimitError ? "요청이 많아 잠시 후 다시 시도해 주세요."
          : e instanceof Anthropic.APIError ? `Claude API 오류 (${e.status}): ${e.message}`
          : `제안서 생성 오류: ${(e as Error).message}`;
        controller.enqueue(encoder.encode(`\n\n[[ERROR]] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
