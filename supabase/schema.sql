-- my-fitness — 個人運動紀錄平台 schema（Phase 1 / MVP）
--
-- 表全部放在獨立的 fitness schema，與 public 以及其他 app（library / routine / todo）隔離。
-- 這個專案接 Supabase Auth（email + 密碼），所以 RLS 一開始就打開：
-- 每一列資料都綁 auth.users，子表透過上層表回推擁有者。
--
-- 執行方式（VPS）：
--   docker exec -i supabase-db psql -U postgres -d postgres < supabase/schema.sql
--
-- 自架 Supabase 額外一步：PostgREST 預設只暴露 public，
-- 必須把 fitness 加進 docker/.env 的 PGRST_DB_SCHEMAS 再 --force-recreate rest。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- 1) schema 與角色授權
-- ---------------------------------------------------------------
create schema if not exists fitness;

-- 只給 authenticated 與 service_role；不給 anon，未登入連 schema 都碰不到。
grant usage on schema fitness to authenticated, service_role;

alter default privileges in schema fitness
  grant all on tables to authenticated, service_role;
alter default privileges in schema fitness
  grant all on sequences to authenticated, service_role;
alter default privileges in schema fitness
  grant all on routines to authenticated, service_role;

-- ---------------------------------------------------------------
-- 2) 動作庫
-- ---------------------------------------------------------------
create table if not exists fitness.exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name_zh           text not null,
  name_en           text,
  category          text,                 -- chest / back / legs / core ...
  default_equipment text,                 -- 啞鈴 / 瑜珈墊 / 徒手 ...
  default_cue       text,                 -- 預設提示語，可在卡片內覆寫
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists exercises_user_idx     on fitness.exercises (user_id);
create index if not exists exercises_category_idx on fitness.exercises (user_id, category);

-- ---------------------------------------------------------------
-- 3) 訓練卡（某次討論出的菜單模板）
-- ---------------------------------------------------------------
create table if not exists fitness.workout_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,              -- 例：胸肌感受度優先
  thesis      text,                       -- 一句話訓練邏輯
  source_note text,                       -- 對應哪次對話／討論重點
  status      text not null default 'active'
              check (status in ('draft', 'active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workout_cards_user_idx on fitness.workout_cards (user_id, status, created_at desc);

-- ---------------------------------------------------------------
-- 4) 卡片內的動作設定（順序本身就是訓練資訊，例如預先疲勞）
-- ---------------------------------------------------------------
create table if not exists fitness.card_exercises (
  id                  uuid primary key default gen_random_uuid(),
  workout_card_id     uuid not null references fitness.workout_cards(id) on delete cascade,
  exercise_id         uuid not null references fitness.exercises(id) on delete restrict,
  order_index         int  not null default 0,
  mode                text not null default 'reps' check (mode in ('reps', 'hold')),
  target_sets         int,
  target_reps_min     int,                -- mode = reps 時使用
  target_reps_max     int,
  target_hold_seconds int,                -- mode = hold 時使用
  tempo_text          text,               -- 例："下放3秒/頂端擠壓1秒/上推1秒"
  cue_text            text,               -- 覆寫 exercises.default_cue
  rest_seconds        int,                -- 這個動作的組間休息秒數
  created_at          timestamptz not null default now(),

  -- mode 與目標欄位要對得起來
  constraint card_exercises_mode_targets check (
    (mode = 'reps' and target_hold_seconds is null)
    or (mode = 'hold' and target_reps_min is null and target_reps_max is null)
  )
);

create index if not exists card_exercises_card_idx on fitness.card_exercises (workout_card_id, order_index);

-- ---------------------------------------------------------------
-- 5) 某次實際執行的紀錄
-- ---------------------------------------------------------------
create table if not exists fitness.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workout_card_id uuid not null references fitness.workout_cards(id) on delete cascade,
  performed_at    timestamptz not null default now(),
  overall_note    text,                   -- 整場的整體感受／備註
  created_at      timestamptz not null default now()
);

create index if not exists workout_sessions_user_idx on fitness.workout_sessions (user_id, performed_at desc);
create index if not exists workout_sessions_card_idx on fitness.workout_sessions (workout_card_id, performed_at desc);

-- ---------------------------------------------------------------
-- 6) 該次 session 中，某個動作的執行紀錄
-- ---------------------------------------------------------------
create table if not exists fitness.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references fitness.workout_sessions(id) on delete cascade,
  card_exercise_id uuid not null references fitness.card_exercises(id) on delete cascade,
  feel_note        text,                  -- 例：「下放到底上臂感受變多」
  created_at       timestamptz not null default now(),
  unique (session_id, card_exercise_id)
);

create index if not exists exercise_logs_session_idx on fitness.exercise_logs (session_id);

-- ---------------------------------------------------------------
-- 7) 單組紀錄
-- ---------------------------------------------------------------
create table if not exists fitness.set_logs (
  id                uuid primary key default gen_random_uuid(),
  exercise_log_id   uuid not null references fitness.exercise_logs(id) on delete cascade,
  set_index         int  not null,
  weight_kg         numeric(6,2),         -- mode = reps
  reps_done         int,                  -- mode = reps
  hold_seconds_done int,                  -- mode = hold
  completed_at      timestamptz not null default now(),
  unique (exercise_log_id, set_index)
);

create index if not exists set_logs_log_idx on fitness.set_logs (exercise_log_id, set_index);

-- ---------------------------------------------------------------
-- 8) Row Level Security
--    上層表直接比對 user_id；子表用 exists 回推到擁有者。
-- ---------------------------------------------------------------
alter table fitness.exercises        enable row level security;
alter table fitness.workout_cards    enable row level security;
alter table fitness.card_exercises   enable row level security;
alter table fitness.workout_sessions enable row level security;
alter table fitness.exercise_logs    enable row level security;
alter table fitness.set_logs         enable row level security;

drop policy if exists own_exercises on fitness.exercises;
create policy own_exercises on fitness.exercises
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists own_workout_cards on fitness.workout_cards;
create policy own_workout_cards on fitness.workout_cards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists own_workout_sessions on fitness.workout_sessions;
create policy own_workout_sessions on fitness.workout_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists own_card_exercises on fitness.card_exercises;
create policy own_card_exercises on fitness.card_exercises
  for all to authenticated
  using (exists (
    select 1 from fitness.workout_cards c
    where c.id = card_exercises.workout_card_id
      and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from fitness.workout_cards c
    where c.id = card_exercises.workout_card_id
      and c.user_id = (select auth.uid())
  ));

drop policy if exists own_exercise_logs on fitness.exercise_logs;
create policy own_exercise_logs on fitness.exercise_logs
  for all to authenticated
  using (exists (
    select 1 from fitness.workout_sessions s
    where s.id = exercise_logs.session_id
      and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from fitness.workout_sessions s
    where s.id = exercise_logs.session_id
      and s.user_id = (select auth.uid())
  ));

drop policy if exists own_set_logs on fitness.set_logs;
create policy own_set_logs on fitness.set_logs
  for all to authenticated
  using (exists (
    select 1
    from fitness.exercise_logs el
    join fitness.workout_sessions s on s.id = el.session_id
    where el.id = set_logs.exercise_log_id
      and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from fitness.exercise_logs el
    join fitness.workout_sessions s on s.id = el.session_id
    where el.id = set_logs.exercise_log_id
      and s.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------
-- 9) 既有物件補授權（default privileges 只對「之後建立」的表生效）
-- ---------------------------------------------------------------
grant all on all tables    in schema fitness to authenticated, service_role;
grant all on all sequences in schema fitness to authenticated, service_role;

-- 明確把 anon 擋在外面（就算之後有人誤加授權也收回）
revoke all on all tables in schema fitness from anon;
revoke usage on schema fitness from anon;
