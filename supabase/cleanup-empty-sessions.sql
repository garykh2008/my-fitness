-- 清掉完全沒有紀錄的 session
--
-- 來源：startSession() 原本每按一次「開始訓練」就插一列，
-- 沒用「放棄這次訓練」就離開的話會留下空殼。
-- 那個行為已經改成「先找可沿用的 session」，這支是清掉改之前累積的。
--
-- 條件刻意只看 exercise_logs：有感受筆記但還沒記重量的 session
-- 仍是一次真的訓練，不該被刪。
--
-- 冪等，重跑安全。
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/cleanup-empty-sessions.sql

select count(*) as 清理前的總數 from fitness.workout_sessions;

select count(*) as 即將刪除
from fitness.workout_sessions s
where not exists (
  select 1 from fitness.exercise_logs el where el.session_id = s.id
);

delete from fitness.workout_sessions s
where not exists (
  select 1 from fitness.exercise_logs el where el.session_id = s.id
);

select
  count(*)                                   as 清理後的總數,
  (select count(*) from fitness.exercise_logs) as 動作紀錄,
  (select count(*) from fitness.set_logs)      as 組數紀錄
from fitness.workout_sessions;
