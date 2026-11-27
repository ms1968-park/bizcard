import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 한글이 예쁘게 보이는 글꼴
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "BizCard",
  description: "명함을 찍으면, 연락처가 됩니다.",
  // 아이폰 홈 화면에 추가했을 때의 이름과 모양
  appleWebApp: {
    capable: true,
    title: "BizCard",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef", // 폰 상단 상태 표시줄 색
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
