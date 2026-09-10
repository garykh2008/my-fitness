-- 動作庫加上「預設訓練參數」
--
-- 目的：建訓練卡時只要挑動作就好，不用每次重填組數／次數／休息秒數。
-- 動作本身帶著一組合理的預設值，加進卡片時直接複製過去，之後想改再改。
--
-- 這支是冪等的（add column if not exists + 只補 null 的欄位），重跑安全。
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/migration-exercise-defaults.sql

-- ---------------------------------------------------------------
-- 1) 欄位
-- ---------------------------------------------------------------
alter table fitness.exercises
  add column if not exists default_mode text not null default 'reps',
  add column if not exists default_sets int,
  add column if not exists default_reps_min int,
  add column if not exists default_reps_max int,
  add column if not exists default_hold_seconds int,
  add column if not exists default_tempo text,
  add column if not exists default_rest_seconds int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_default_mode_check'
  ) then
    alter table fitness.exercises
      add constraint exercises_default_mode_check
      check (default_mode in ('reps', 'hold'));
  end if;

  -- 跟 card_exercises 同樣的規則：mode 與目標欄位要對得起來，
  -- 免得預設值複製進卡片時撞上那邊的 check constraint
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_default_targets_check'
  ) then
    alter table fitness.exercises
      add constraint exercises_default_targets_check
      check (
        (default_mode = 'reps' and default_hold_seconds is null)
        or (default_mode = 'hold'
            and default_reps_min is null and default_reps_max is null)
      );
  end if;
end $$;

-- ---------------------------------------------------------------
-- 2) 已經用在訓練卡裡的動作 —— 直接沿用實際用過的設定
--    同一個動作出現在多張卡時，取最新那張（那是最近一次想清楚的版本）
-- ---------------------------------------------------------------
with latest as (
  select distinct on (ce.exercise_id)
    ce.exercise_id,
    ce.mode,
    ce.target_sets,
    ce.target_reps_min,
    ce.target_reps_max,
    ce.target_hold_seconds,
    ce.tempo_text,
    ce.rest_seconds
  from fitness.card_exercises ce
  join fitness.workout_cards c on c.id = ce.workout_card_id
  order by ce.exercise_id, c.created_at desc
)
update fitness.exercises e
set
  default_mode         = l.mode,
  default_sets         = coalesce(e.default_sets, l.target_sets),
  default_reps_min     = case when l.mode = 'reps'
                              then coalesce(e.default_reps_min, l.target_reps_min) end,
  default_reps_max     = case when l.mode = 'reps'
                              then coalesce(e.default_reps_max, l.target_reps_max) end,
  default_hold_seconds = case when l.mode = 'hold'
                              then coalesce(e.default_hold_seconds, l.target_hold_seconds) end,
  default_tempo        = coalesce(e.default_tempo, l.tempo_text),
  default_rest_seconds = coalesce(e.default_rest_seconds, l.rest_seconds)
from latest l
where l.exercise_id = e.id
  and e.default_sets is null;   -- 已經自己設過就不要蓋掉

-- 順手修掉一個明顯的錯字（原本是「上戉1秒」）
update fitness.exercises
set default_tempo = '上舉1秒/下放3秒'
where name_zh = '啞鈴二頭彎舉' and default_tempo like '%戉%';

-- ---------------------------------------------------------------
-- 3) 還沒用在任何卡片上的動作 —— 依動作性質給合理預設
--
--    原則跟既有卡片一致：
--      大重量複合動作  組數多、次數低、休息長（4 組 / 6-10 下 / 90-120 秒）
--      一般複合動作    3-4 組 / 8-12 下 / 75-90 秒
--      孤立動作        3 組 / 12-15 下 / 60 秒
--      核心／輕負荷    3 組 / 12-20 下 / 45 秒
--
--    tempo 一律留空：節奏比較屬於「這張卡想怎麼練」，不是動作的固有屬性，
--    所以只有實際用過的動作才會有（來自上面第 2 段）。
-- ---------------------------------------------------------------
update fitness.exercises e
set
  default_mode         = 'reps',
  default_sets         = v.sets,
  default_reps_min     = v.rmin,
  default_reps_max     = v.rmax,
  default_rest_seconds = v.rest
from (values
  -- arms：孤立動作為主
  ('仰臥三頭伸展',   3, 10, 15,  60),
  ('彈力帶彎舉',     3, 12, 20,  45),
  ('滑輪三頭下壓',   3, 10, 15,  60),
  ('窄距伏地挺身',   3, 10, 15,  60),
  ('集中彎舉',       3, 10, 15,  60),

  -- back
  ('引體向上',       3,  6, 10,  90),
  ('反手引體向上',   3,  6, 10,  90),
  ('槓鈴硬舉',       4,  5,  8, 120),
  ('槓鈴划船',       4,  8, 12,  90),
  ('坐姿滑輪划船',   3, 10, 12,  75),
  ('滑輪下拉',       3, 10, 12,  75),
  ('直臂下壓',       3, 12, 15,  60),

  -- chest
  ('槓鈴臥推',       4,  8, 12,  90),
  ('上斜啞鈴臥推',   4,  8, 12,  90),
  ('雙槓撐體',       3,  6, 12,  90),
  ('上斜伏地挺身',   3, 10, 20,  60),
  ('彈力帶夾胸',     3, 12, 15,  60),
  ('滑輪夾胸',       3, 12, 15,  60),

  -- core
  ('捲腹',           3, 15, 20,  45),
  ('反向捲腹',       3, 12, 20,  45),
  ('俄羅斯轉體',     3, 12, 20,  45),
  ('滑輪捲腹',       3, 12, 15,  60),
  ('懸吊舉腿',       3,  8, 15,  60),
  ('鳥狗式',         3, 10, 12,  45),

  -- legs
  ('槓鈴深蹲',       4,  6, 10, 120),
  ('腿推機',         4, 10, 15,  90),
  ('啞鈴弓步蹲',     3, 10, 12,  75),
  ('徒手深蹲',       3, 15, 25,  60),
  ('腿伸展',         3, 12, 15,  60),
  ('腿彎舉',         3, 12, 15,  60),
  ('臀橋',           3, 12, 20,  60),

  -- shoulders
  ('槓鈴肩推',       4,  8, 12,  90),
  ('啞鈴前平舉',     3, 12, 20,  60),
  ('彈力帶側平舉',   3, 12, 20,  45),
  ('臉拉',           3, 15, 20,  45)
) as v(name, sets, rmin, rmax, rest)
where e.name_zh = v.name
  and e.default_sets is null;

-- ---------------------------------------------------------------
-- 4) 保底：真的還有漏的（之後新增又沒填的）給一組通用值
-- ---------------------------------------------------------------
update fitness.exercises
set
  default_sets         = coalesce(default_sets, 3),
  default_reps_min     = case when default_mode = 'reps'
                              then coalesce(default_reps_min, 10) end,
  default_reps_max     = case when default_mode = 'reps'
                              then coalesce(default_reps_max, 15) end,
  default_hold_seconds = case when default_mode = 'hold'
                              then coalesce(default_hold_seconds, 30) end,
  default_rest_seconds = coalesce(default_rest_seconds, 60)
where default_sets is null or default_rest_seconds is null;

-- ---------------------------------------------------------------
-- 驗收
-- ---------------------------------------------------------------
select
  count(*) as 動作總數,
  count(*) filter (where default_sets is null)         as 缺組數,
  count(*) filter (where default_rest_seconds is null) as 缺休息,
  count(*) filter (where default_mode = 'hold')        as hold型,
  count(*) filter (where default_tempo is not null)    as 有節奏
from fitness.exercises;
