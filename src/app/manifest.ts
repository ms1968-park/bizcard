import type { MetadataRoute } from "next";

// 홈 화면에 추가했을 때 "앱처럼" 보이게 하는 설명서
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BizCard - 명함 관리",
    short_name: "BizCard",
    description: "명함을 찍으면, 연락처가 됩니다.",
    start_url: "/cards",
    display: "standalone", // 주소창 없이 앱처럼 열기
    background_color: "#fbf6ef",
    theme_color: "#fbf6ef",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
