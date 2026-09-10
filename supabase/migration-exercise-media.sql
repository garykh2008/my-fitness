-- 動作示意媒體
--
-- 目的：AI 教練會排入沒做過的動作，光有文字 cue 不足以確認姿勢對不對。
-- 讓每個動作能帶一份示範參考。
--
-- 一次把外部連結與自存媒體的欄位都加好，顯示優先序是 media_path > media_url。
-- 這樣之後補自拍素材時不用改顯示邏輯，也不用先刪掉原本的連結。
--
-- 冪等（add column if not exists），重跑安全。
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/migration-exercise-media.sql

alter table fitness.exercises
  add column if not exists media_url  text,
  add column if not exists media_path text,
  add column if not exists media_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_media_type_check'
  ) then
    alter table fitness.exercises
      add constraint exercises_media_type_check
      check (media_type is null or media_type in ('image', 'video'));
  end if;
end $$;

comment on column fitness.exercises.media_url is
  '外部示範連結（YouTube 等）。空的時候 UI 會顯示「搜尋示範影片」按鈕。';
comment on column fitness.exercises.media_path is
  '自存媒體在 Supabase Storage 的路徑（Phase 2）。優先於 media_url。';
comment on column fitness.exercises.media_type is
  '自存媒體的型態：image 或 video。media_path 為 null 時無意義。';

-- 驗收
select
  count(*)                                  as 動作總數,
  count(media_url)                          as 有外部連結,
  count(media_path)                         as 有自存媒體
from fitness.exercises;
