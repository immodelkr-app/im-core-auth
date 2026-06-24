"use client";

import { useEffect, useState } from "react";

interface Coupon {
  coupon_code: string;
  coupon_name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  validity_days: number;
  is_active: boolean;
  created_at: string;
  issuedCount: number;
  usedCount: number;
}

interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  totalIssued: number;
  totalUsed: number;
}

export default function CouponsAdminPage() {
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    coupon_code: "",
    coupon_name: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    validity_days: "30",
  });
  const [formError, setFormError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const json = await res.json();
      if (json.success) { setStats(json.stats); setCoupons(json.coupons); }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (code: string, current: boolean) => {
    await fetch("/api/admin/coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coupon_code: code, is_active: !current }),
    });
    fetchData();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.coupon_code || !form.coupon_name || !form.discount_value) {
      setFormError("모든 필드를 입력해 주세요."); return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        discount_value: Number(form.discount_value),
        validity_days: Number(form.validity_days),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!json.success) { setFormError(json.error); return; }
    setShowForm(false);
    setForm({ coupon_code: "", coupon_name: "", discount_type: "percent", discount_value: "", validity_days: "30" });
    fetchData();
  };

  const inputStyle = {
    backgroundColor: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    outline: "none",
    width: "100%",
  } as React.CSSProperties;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
            쿠폰을 생성하고 발급 현황을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open("/api/admin/export?type=coupons", "_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV 내보내기
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            새로고침
          </button>
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            쿠폰 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "전체 쿠폰 종류", value: stats.totalCoupons, unit: "종", color: "#a78bfa" },
            { label: "활성 쿠폰", value: stats.activeCoupons, unit: "종", color: "#4ade80" },
            { label: "총 발급 수", value: stats.totalIssued, unit: "건", color: "#fbbf24" },
            { label: "총 사용 수", value: stats.totalUsed, unit: "건", color: "#f87171" },
          ].map((c) => (
            <div key={c.label} className="glass-card p-5 rounded-2xl">
              <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>{c.label}</p>
              <p className="text-3xl font-bold" style={{ color: c.color }}>
                {c.value}
                <span className="text-sm ml-1" style={{ color: "var(--color-text-muted)" }}>{c.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 쿠폰 생성 폼 */}
      {showForm && (
        <div className="glass-card rounded-2xl p-6 border" style={{ borderColor: "rgba(139,92,246,0.3)" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-5">새 쿠폰 생성</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>쿠폰 코드 *</label>
                <input style={inputStyle} placeholder="예: WELCOME2026" value={form.coupon_code}
                  onChange={(e) => setForm((f) => ({ ...f, coupon_code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>쿠폰 이름 *</label>
                <input style={inputStyle} placeholder="예: 신규 가입 환영 쿠폰" value={form.coupon_name}
                  onChange={(e) => setForm((f) => ({ ...f, coupon_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>할인 방식 *</label>
                <select style={inputStyle} value={form.discount_type}
                  onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))}>
                  <option value="percent">퍼센트 (%)</option>
                  <option value="fixed">정액 (원)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  할인값 * {form.discount_type === "percent" ? "(1~100%)" : "(원)"}
                </label>
                <input style={inputStyle} type="number" placeholder={form.discount_type === "percent" ? "10" : "5000"}
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>유효기간 (일) *</label>
                <input style={inputStyle} type="number" placeholder="30" value={form.validity_days}
                  onChange={(e) => setForm((f) => ({ ...f, validity_days: e.target.value }))} />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-400 mt-3">{formError}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)" }}>
                {saving ? "저장 중..." : "저장"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 쿠폰 목록 */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold text-gray-900">쿠폰 목록</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                {["쿠폰 코드", "쿠폰명", "할인", "유효기간", "발급", "사용", "상태", "관리"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : coupons.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center"
                  style={{ color: "var(--color-text-muted)" }}>
                  <div className="flex flex-col items-center gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 opacity-30">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                    </svg>
                    <p>등록된 쿠폰이 없습니다. 위의 쿠폰 생성 버튼을 눌러 추가하세요.</p>
                  </div>
                </td></tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.coupon_code}
                    className="transition-colors duration-150 hover:bg-white/[0.03]"
                    style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-5 py-4">
                      <code className="text-xs px-2 py-1 rounded-lg font-mono"
                        style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#c4b5fd" }}>
                        {c.coupon_code}
                      </code>
                    </td>
                    <td className="px-5 py-4 font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {c.coupon_name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold" style={{ color: "#fbbf24" }}>
                        {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {c.validity_days}일
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {c.issuedCount}건
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {c.usedCount}건
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        c.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/20 text-gray-400"
                      }`}>
                        {c.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggle(c.coupon_code, c.is_active)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 hover:opacity-80"
                        style={{
                          backgroundColor: c.is_active ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.15)",
                          color: c.is_active ? "#f87171" : "#4ade80",
                        }}>
                        {c.is_active ? "비활성화" : "활성화"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
