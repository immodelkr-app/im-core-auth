"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  chartData: {
    date: string;
    signups: number;
    earn: number;
    use: number;
  }[];
  appDistribution: {
    name: string;
    value: number;
  }[];
}

const COLORS = ["#8b5cf6", "#a78bfa"]; // MOCA, IMFF 브랜드 컬러 매칭

export default function AnalyticsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // SSR Hydration 에러 방지
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnalytics = async (selectedRange: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("통계 데이터 패치 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
  }, [range]);

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계 및 분석</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
            신규 회원 가입 추이 및 포인트 유입/유출 현황을 모니터링합니다.
          </p>
        </div>
        
        {/* 기간 필터 */}
        <div className="flex gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200">
          {([
            { key: "7d", label: "최근 7일" },
            { key: "30d", label: "최근 30일" },
            { key: "90d", label: "최근 90일" },
          ] as const).map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: range === r.key ? "white" : "transparent",
                color: range === r.key ? "var(--color-accent)" : "var(--color-text-muted)",
                boxShadow: range === r.key ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">데이터 통계 분석 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 차트 1: 신규 가입 회원 수 */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 flex flex-col justify-between">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-800">일별 신규 가입자 현황</h2>
              <p className="text-xs text-gray-400 mt-0.5">선택한 기간 내 마스터 계정 등록 추이</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} style={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tickLine={false} style={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(124, 58, 237, 0.1)",
                    }}
                    labelStyle={{ fontSize: 11, fontWeight: "bold", color: "#374151" }}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="signups" name="신규 회원(명)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 차트 2: 앱 분포 */}
          <div className="lg:col-span-1 glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 flex flex-col justify-between">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-800">서비스별 회원 연동 비율</h2>
              <p className="text-xs text-gray-400 mt-0.5">MOCA 및 IMFF 누적 연동 현황</p>
            </div>
            <div className="h-48 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.appDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.appDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                    }}
                    itemStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* 도넛 차트 내부 텍스트 */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-gray-400">총 연동</span>
                <span className="text-lg font-black text-gray-800">
                  {data.appDistribution.reduce((s, a) => s + a.value, 0).toLocaleString()}
                </span>
              </div>
            </div>
            
            {/* 범례 표시 */}
            <div className="flex justify-center gap-6 text-xs mt-2 border-t border-gray-50 pt-4">
              {data.appDistribution.map((app, index) => (
                <div key={app.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-gray-500 font-medium">{app.name}</span>
                  <span className="font-bold text-gray-800">{app.value.toLocaleString()}명</span>
                </div>
              ))}
            </div>
          </div>

          {/* 차트 3: 포인트 지급 vs 차감 추이 */}
          <div className="lg:col-span-3 glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 flex flex-col justify-between">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-800">포인트 흐름 분석</h2>
              <p className="text-xs text-gray-400 mt-0.5">일별 적립(Earn)과 사용(Use) 규모 추이</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} style={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tickLine={false} style={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(124, 58, 237, 0.1)",
                    }}
                    labelStyle={{ fontSize: 11, fontWeight: "bold", color: "#374151" }}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" style={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="earn" name="적립 포인트 (+)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="use" name="사용 포인트 (-)" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
