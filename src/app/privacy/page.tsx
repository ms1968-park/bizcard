import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 | BizCard" };

// 문의 받을 이메일 (Google Cloud 브랜딩의 "사용자 지원 이메일"과 같게)
const CONTACT_EMAIL = "ms1968.park@gmail.com";
const UPDATED = "2026년 11월 27일";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 text-ink">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← BizCard
      </Link>
      <h1 className="mt-4 text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-ink-faint">시행일: {UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 leading-relaxed text-ink-soft [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
        <p>
          BizCard(bizcard.okfactory.kr, 이하 &ldquo;서비스&rdquo;)는 명함을 촬영해 정리하는 개인 포트폴리오 프로젝트입니다.
          서비스는 이용자의 개인정보를 소중히 여기며, 아래와 같이 처리합니다.
        </p>

        <section>
          <h2>1. 수집하는 정보</h2>
          <ul>
            <li>회원 정보: 이메일 주소, 비밀번호(암호화되어 저장되며 서비스 운영자도 볼 수 없음)</li>
            <li>Google로 로그인한 경우: Google 계정의 이메일 주소, 이름, 프로필 사진 주소</li>
            <li>이용자가 등록한 명함 정보: 명함 사진(앞면·뒷면)과 사진에서 읽은 이름, 회사, 연락처, 주소 등, 그리고 이용자가 직접 적은 메모와 태그</li>
            <li>서비스 운영에 필요한 기록: 접속 시각, 오류 기록</li>
          </ul>
        </section>

        <section>
          <h2>2. 이용 목적</h2>
          <ul>
            <li>회원 가입, 로그인, 본인 확인, 비밀번호 재설정</li>
            <li>명함 사진에서 글자를 읽어 정보를 정리하고, 이용자가 검색·열람·연락처로 저장할 수 있게 하기</li>
            <li>서비스 오류 확인과 남용 방지</li>
          </ul>
          <p className="mt-2">광고나 마케팅에는 사용하지 않으며, 개인정보를 판매하지 않습니다.</p>
        </section>

        <section>
          <h2>3. 처리를 맡기는 곳</h2>
          <ul>
            <li>Supabase: 회원 정보, 명함 정보와 사진 보관 (서울 리전)</li>
            <li>Vercel: 웹사이트 호스팅 (서울 리전)</li>
            <li>
              Google Gemini API: 명함 사진에서 글자를 읽기 위해 사진을 보냅니다. 현재 무료 등급을 사용하고 있어, Google의
              약관에 따라 보낸 내용이 Google 제품 개선에 활용될 수 있습니다.
            </li>
            <li>Google: Google 로그인을 선택한 경우의 본인 확인</li>
            <li>DreamHost: 인증·비밀번호 재설정 메일 발송</li>
          </ul>
        </section>

        <section>
          <h2>4. 보관 기간과 삭제</h2>
          <ul>
            <li>명함은 이용자가 삭제하면 사진과 정보가 함께 즉시 삭제됩니다.</li>
            <li>회원 탈퇴를 원하시면 아래 이메일로 요청해 주세요. 계정과 모든 명함 정보를 지체 없이 삭제합니다.</li>
          </ul>
        </section>

        <section>
          <h2>5. 안전 조치</h2>
          <ul>
            <li>모든 통신은 HTTPS로 암호화됩니다.</li>
            <li>데이터베이스 행 단위 권한(RLS)으로, 이용자는 자기 명함만 볼 수 있습니다.</li>
            <li>명함 사진은 비공개 저장소에 보관하고, 본인에게만 짧은 시간 유효한 링크로 보여 줍니다.</li>
          </ul>
        </section>

        <section>
          <h2>6. 이용자의 권리</h2>
          <p>
            이용자는 언제든지 자신의 정보를 열람·수정·삭제할 수 있으며, 서비스 화면에서 직접 하거나 이메일로 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>7. 문의</h2>
          <p>
            개인정보 관련 문의:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <p className="text-sm">이 방침이 바뀌면 이 페이지에 시행일과 함께 알려 드립니다.</p>
      </div>
    </main>
  );
}
