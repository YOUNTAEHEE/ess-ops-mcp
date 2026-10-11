import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESS Ops MCP | 설비 운영 조회 데모",
  description: "모의 ESS 데이터, 읽기 전용 MCP, 부분 장애 복구와 요청 기록을 확인하는 개인 데모.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
