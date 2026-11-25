-- =========================================================
-- BizCard: 명함 사진 보관함(Storage bucket) 만들기
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 Run 하면 실행된다.
-- =========================================================

-- 1) 사진 보관함 만들기
--    public = false : 링크만 안다고 아무나 볼 수 없는 "비공개" 보관함
--    5MB 이하, 사진 파일만 허용
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- 2) 안전장치: 사진은 "사용자ID/파일이름" 위치에 저장한다.
--    폴더 이름(첫 칸)이 내 사용자ID와 같은 사진만 보고, 올리고, 바꾸고, 지울 수 있다.
create policy "본인 명함 사진만 보기"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 폴더에만 사진 올리기"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 명함 사진만 바꾸기"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 명함 사진만 지우기"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
