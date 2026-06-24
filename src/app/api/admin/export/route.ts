import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 문자열을 CSV 셀에 안전하게 래핑하는 헬퍼
function csvCell(val: unknown): string {
  const str = val == null ? "" : String(val);
  // 쉼표, 줄바꿈, 큰따옴표가 있으면 따옴표로 감싸고 내부 따옴표를 이스케이프
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const header = headers.map(csvCell).join(",");
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return `\uFEFF${header}\n${body}`; // BOM 추가 (Excel 한글 깨짐 방지)
}

function formatKST(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // members | points | coupons

  try {
    if (type === "members") {
      // 회원 목록 CSV
      const { data: members, error } = await supabase
        .from("master_users")
        .select(`
          id, name, phone_number, integrated_points, created_at,
          app_user_mapping ( app_name, local_user_id )
        `)
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const headers = ["UUID", "이름", "전화번호", "통합 포인트(P)", "연동 앱", "연동 아이디", "가입일시(KST)"];
      const rows = (members ?? []).map((m) => {
        const mappings = (m.app_user_mapping as any[] ?? []);
        const apps = mappings.map((a: any) => a.app_name).join(" / ") || "없음";
        const appIds = mappings.map((a: any) => a.local_user_id).join(" / ") || "-";
        return [
          m.id,
          m.name ?? "",
          m.phone_number,
          String(m.integrated_points),
          apps,
          appIds,
          formatKST(m.created_at),
        ];
      });

      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="members_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "points") {
      // 포인트 거래 내역 CSV (기간 필터 지원)
      const startDate = searchParams.get("startDate") || "";
      const endDate = searchParams.get("endDate") || "";
      const txType = searchParams.get("txType") || ""; // earn | use | ""

      let query = supabase
        .from("point_transactions")
        .select(`
          id, source_app, type, amount, description, created_at,
          master_users ( name, phone_number )
        `)
        .order("created_at", { ascending: false });

      if (txType) query = query.eq("type", txType);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        query = query.lt("created_at", end.toISOString());
      }

      const { data: txs, error } = await query;

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const headers = ["거래ID", "구분", "앱", "이름", "전화번호", "포인트(P)", "설명", "거래일시(KST)"];
      const rows = (txs ?? []).map((tx: any) => [
        tx.id,
        tx.type === "earn" ? "적립" : "사용",
        tx.source_app,
        tx.master_users?.name ?? "",
        tx.master_users?.phone_number ?? "",
        tx.type === "earn" ? `+${tx.amount}` : `-${tx.amount}`,
        tx.description ?? "",
        formatKST(tx.created_at),
      ]);

      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="points_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "coupons") {
      // 쿠폰 발급/사용 내역 CSV
      const { data: issued, error } = await supabase
        .from("user_coupons")
        .select(`
          id, coupon_code, is_used, used_at, expires_at, created_at,
          master_users ( name, phone_number ),
          coupon_master ( coupon_name, discount_type, discount_value )
        `)
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const headers = ["발급ID", "쿠폰코드", "쿠폰명", "할인", "이름", "전화번호", "사용여부", "사용일시(KST)", "만료일(KST)", "발급일시(KST)"];
      const rows = (issued ?? []).map((uc: any) => {
        const master = uc.coupon_master;
        const discountStr = master
          ? master.discount_type === "percent"
            ? `${master.discount_value}%`
            : `${master.discount_value}원`
          : "";
        return [
          uc.id,
          uc.coupon_code,
          master?.coupon_name ?? "",
          discountStr,
          uc.master_users?.name ?? "",
          uc.master_users?.phone_number ?? "",
          uc.is_used ? "사용완료" : "미사용",
          uc.used_at ? formatKST(uc.used_at) : "-",
          formatKST(uc.expires_at),
          formatKST(uc.created_at),
        ];
      });

      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="coupons_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "type 파라미터가 필요합니다. (members | points | coupons)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Export 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
