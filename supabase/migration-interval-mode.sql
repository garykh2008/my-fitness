-- 第三種訓練型態：interval（做固定秒數，記錄實際做了幾下）
--
-- 由來：follow-along 型的影片課表多半是時間制（「這個動作做 50 秒」），
-- 塞不進原本的兩種 mode ——
--   reps 記得到重量次數但沒有「做多久」
--   hold 記得到秒數但記不到重量次數
-- interval 兩者兼具：目標是秒數，記錄的是重量 + 次數。
--
-- 冪等，重跑安全。
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/migration-interval-mode.sql

-- ---------------------------------------------------------------
-- 1) 欄位
-- ---------------------------------------------------------------
alter table fitness.card_exercises
  add column if not exists target_interval_seconds int;

alter table fitness.exercises
  add column if not exists default_interval_seconds int;

-- ---------------------------------------------------------------
-- 2) mode 放寬成三種
-- ---------------------------------------------------------------
alter table fitness.card_exercises
  drop constraint if exists card_exercises_mode_check;
alter table fitness.card_exercises
  add constraint card_exercises_mode_check
  check (mode in ('reps', 'hold', 'interval'));

alter table fitness.exercises
  drop constraint if exists exercises_default_mode_check;
alter table fitness.exercises
  add constraint exercises_default_mode_check
  check (default_mode in ('reps', 'hold', 'interval'));

-- ---------------------------------------------------------------
-- 3) mode 與目標欄位要對得起來
--
--    interval 刻意不接受 reps_min/max：做幾下是結果不是目標，
--    這正是它跟 reps 的差別。
-- ---------------------------------------------------------------
alter table fitness.card_exercises
  drop constraint if exists card_exercises_mode_targets;
alter table fitness.card_exercises
  add constraint card_exercises_mode_targets
  check (
    (mode = 'reps'
      and target_hold_seconds is null
      and target_interval_seconds is null)
    or (mode = 'hold'
      and target_reps_min is null
      and target_reps_max is null
      and target_interval_seconds is null)
    or (mode = 'interval'
      and target_hold_seconds is null
      and target_reps_min is null
      and target_reps_max is null)
  );

alter table fitness.exercises
  drop constraint if exists exercises_default_targets_check;
alter table fitness.exercises
  add constraint exercises_default_targets_check
  check (
    (default_mode = 'reps'
      and default_hold_seconds is null
      and default_interval_seconds is null)
    or (default_mode = 'hold'
      and default_reps_min is null
      and default_reps_max is null
      and default_interval_seconds is null)
    or (default_mode = 'interval'
      and default_hold_seconds is null
      and default_reps_min is null
      and default_reps_max is null)
  );

comment on column fitness.card_exercises.target_interval_seconds is
  'interval 型的目標秒數。這段時間內做幾下記在 set_logs.reps_done，'
  '提早停下的實際秒數記在 set_logs.hold_seconds_done。';

-- ---------------------------------------------------------------
-- 驗收
-- ---------------------------------------------------------------
select
  count(*)                                        as 卡內動作總數,
  count(*) filter (where mode = 'reps')           as reps,
  count(*) filter (where mode = 'hold')           as hold,
  count(*) filter (where mode = 'interval')       as interval
from fitness.card_exercises;
