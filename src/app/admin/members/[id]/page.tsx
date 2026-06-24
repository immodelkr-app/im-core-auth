"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface MemberDetail {
  member: {
    id: string;
    name: string;
    phone_number: string;
    integrated_points: number;
    created_at: string;
    updated_at: string;
  };
  mappings: {
    app_name: string;
    local_user_id: string;
    created_at: string;
  }[];
  transactions: {
    id: string;
    source_app: string;
    type: string;
    amount: number;
    description: string | null;
    created_at: string;
  }[];
  coupons: {
    id: string;
    coupon_code: string;
    is_used: boolean;
    used_at: string | null;
    expires_at: string;
    created_at: string;
    coupon_master: {
      coupon_name: string;
      discount_type: string;
      discount_value: number;
    } | null;
  }[];
}

function formatPhone(p: string) {
  return p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const res = await fetch(`/api/admin/members/${id}`);
        const json = await res.json();
        if (json.success) {
          setData(json);
        } else {
          setError(json.error || "회원 정보를 불러오지 못했습니다.");
        }
      } catch (err) {
        setError("네트워크 에러가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchMember();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">회원 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-red-500 mx-auto">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800">오류가 발생했습니다</h2>
        <p className="text-sm text-gray-500">{error || "회원 정보를 표시할 수 없습니다."}</p>
        <Link href="/admin" className="inline-block px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const { member, mappings, transactions, coupons } = data;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 뒤로가기 & 상단 정보 */}
      <div className="flex flex-col gap-2">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          회원 목록 대시보드로 돌아가기
        </Link>
        <h1 className="text-2xl font-black text-gray-900 mt-2">
          회원 <span className="gradient-text">상세 정보</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 정보 프로필 카드 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg mb-4">
              <span className="text-white text-3xl font-black">{member.name.slice(0, 1)}</span>
            </div>
            <h2 className="text-lg font-black text-gray-900">{member.name}</h2>
            <p className="text-sm font-mono text-gray-500 mt-1">{formatPhone(member.phone_number)}</p>
            
            <div className="w-full border-t border-purple-50 my-5" />

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-purple-50/50 rounded-xl p-3">
                <span className="text-[11px] font-bold text-purple-400 block mb-1">통합 포인트</span>
                <span className="text-base font-black text-amber-600">
                  {member.integrated_points.toLocaleString()}
                  <span className="text-xs font-medium text-gray-500 ml-0.5">P</span>
                </span>
              </div>
              <div className="bg-purple-50/50 rounded-xl p-3">
                <span className="text-[11px] font-bold text-purple-400 block mb-1">가입일자</span>
                <span className="text-xs font-bold text-gray-700 block mt-1">
                  {formatDate(member.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* 앱 연동 현황 */}
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">앱 연동 현황</h3>
            {mappings.length === 0 ? (
              <p className="text-xs text-gray-400">연동된 앱 정보가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((m) => (
                  <div key={m.app_name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        m.app_name === "MOCA" ? "bg-purple-100 text-purple-700" : "bg-violet-100 text-violet-700"
                      }`}>{m.app_name}</span>
                      <span className="text-xs font-mono font-bold text-gray-700 max-w-[120px] truncate">{m.local_user_id}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{formatDate(m.created_at)} 연동</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 쿠폰 목록 + 포인트 내역 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 쿠폰 보유 현황 */}
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-purple-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">보유 쿠폰 내역</h3>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-violet-100 text-violet-700">
                총 {coupons.length}개
              </span>
            </div>

            {coupons.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">보유 중인 쿠폰이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coupons.map((c) => {
                  const master = c.coupon_master;
                  const discountStr = master
                    ? master.discount_type === "percent"
                      ? `${master.discount_value}%`
                      : `${master.discount_value.toLocaleString()}원`
                    : "정보 없음";

                  const isExpired = new Date(c.expires_at).getTime() < Date.now();
                  let statusText = "사용 가능";
                  let statusClass = "bg-emerald-100 text-emerald-700";

                  if (c.is_used) {
                    statusText = "사용 완료";
                    statusClass = "bg-gray-100 text-gray-500";
                  } else if (isExpired) {
                    statusText = "기간 만료";
                    statusClass = "bg-red-100 text-red-700";
                  }

                  return (
                    <div key={c.id} className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 flex flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 truncate max-w-[150px]">
                            {master?.coupon_name || "삭제된 쿠폰"}
                          </h4>
                          <span className="text-[10px] font-mono text-gray-400">{c.coupon_code}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusClass}`}>
                          {statusText}
                        </span>
                      </div>
                      <div className="flex items-end justify-between mt-1">
                        <span className="text-base font-black text-violet-600">{discountStr} 할인</span>
                        <span className="text-[9px] text-gray-400">만료: {formatDate(c.expires_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 포인트 타임라인 */}
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-purple-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">포인트 거래 내역 (최근 100건)</h3>
            
            {transactions.length === 0 ? (
              <p className="text-xs text-gray-400 py-10 text-center">포인트 적립/사용 내역이 존재하지 않습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50/50" style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {["구분", "서비스", "금액", "사유", "거래시각"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-semibold text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid var(--color-border)" }} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === "earn" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                          }`}>
                            {tx.type === "earn" ? "적립" : "차감"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-600">{tx.source_app}</td>
                        <td className="px-4 py-3 font-bold">
                          <span className={tx.type === "earn" ? "text-emerald-600" : "text-red-500"}>
                            {tx.type === "earn" ? "+" : "-"}{tx.amount.toLocaleString()} P
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[150px] truncate">{tx.description ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDatetime(tx.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
