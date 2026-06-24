import { redirect } from "next/navigation";

/** 루트 경로(/) 접속 시 어드민 대시보드로 리다이렉트 */
export default function RootPage() {
  redirect("/admin");
}
