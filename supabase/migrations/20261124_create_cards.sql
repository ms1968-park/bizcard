-- =========================================================
-- BizCard: 명함 표(cards) 만들기
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 Run 하면 실행된다.
-- =========================================================

-- 1) 명함 표 만들기
create table public.cards (
  -- 시스템이 자동으로 채우는 칸
  id              uuid primary key default gen_random_uuid(),            -- 명함 고유 번호
  user_id         uuid not null default auth.uid()                        -- 주인 (로그인한 사람)
                  references auth.users (id) on delete cascade,           -- 회원 탈퇴 시 명함도 함께 삭제

  -- 명함에 적힌 정보 (OCR이 채워 줄 칸)
  name            text,   -- 이름
  company         text,   -- 회사
  department      text,   -- 부서
  title           text,   -- 직책
  mobile          text,   -- 휴대폰
  phone           text,   -- 회사 전화
  fax             text,   -- 팩스
  email           text,   -- 이메일
  address         text,   -- 주소
  website         text,   -- 홈페이지
  linkedin        text,   -- LinkedIn 주소

  -- 사용자가 직접 관리하는 칸
  memo            text,                              -- 메모
  tags            text[] not null default '{}',      -- 그룹·태그 (여러 개)

  -- 사진 위치 (사진 파일은 Storage에 따로 보관)
  image_path      text,   -- 앞면 사진 (필수 아님)
  image_back_path text,   -- 뒷면 사진 (원할 때만)

  created_at      timestamptz not null default now(),  -- 등록 시각
  updated_at      timestamptz not null default now()   -- 마지막 수정 시각
);

-- 2) 빨리 찾기 위한 색인(목차)
create index cards_user_id_idx on public.cards (user_id);          -- "내 명함" 빨리 찾기
create index cards_tags_idx    on public.cards using gin (tags);   -- 태그로 빨리 찾기

-- 3) 수정할 때마다 updated_at 을 자동으로 현재 시각으로 바꾸기
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- 4) 안전장치(RLS): 주인만 자기 명함을 보고, 넣고, 고치고, 지울 수 있다
alter table public.cards enable row level security;

create policy "본인 명함만 보기"
  on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "본인 명함만 추가"
  on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "본인 명함만 수정"
  on public.cards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "본인 명함만 삭제"
  on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5) 로그인한 사용자에게 이 표를 쓸 수 있는 문을 열어 주기
--    (로그인하지 않은 손님(anon)에게는 열지 않는다)
grant select, insert, update, delete on public.cards to authenticated;
