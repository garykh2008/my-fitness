-- 範例訓練紀錄
--
-- 目的：讓 /history 有東西可看。四次訓練涵蓋三張在家課表，
-- 其中推日有兩次，可以看出組間與週間的變化。
--
-- ⚠️ 這是假資料。AI 教練會讀 /api/coach/history 來決定下一張課表的重量，
--    所以每一筆的 overall_note 都以「[範例]」開頭，在 UI 與 API 輸出裡都看得見。
--    開始記錄真實訓練後請清掉：
--      delete from fitness.workout_sessions where overall_note like '[範例]%';
--
-- 冪等：會先刪掉舊的範例再重建。
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/seed-example-sessions.sql

delete from fitness.workout_sessions where overall_note like '[範例]%';

create temp table _seed (
  card       text,
  days_ago   int,
  at_time    time,
  ex         text,
  set_index  int,
  weight     numeric,
  reps       int,
  hold       int,
  feel       text,
  overall    text
);
-- 不用 on commit drop：psql 預設每個語句各自 commit，temp table 建完就會消失。
-- temp table 本來就只活在這個連線裡，結尾再手動 drop。

-- ---------------------------------------------------------------
-- 推日 #1（9 天前，晚上）
-- ---------------------------------------------------------------
insert into _seed (card, days_ago, at_time, ex, set_index, weight, reps, hold, feel, overall) values
('在家推日：胸肩三頭', 9, '19:30', '彈力帶外旋',       1, null, 18, null, null, '[範例] 久沒練，肩推掉得比想像快。'),
('在家推日：胸肩三頭', 9, '19:30', '彈力帶外旋',       2, null, 16, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '伏地挺身',         1, null, 14, null, '第三組開始胸口才有感覺，前兩組還是手臂在推。', null),
('在家推日：胸肩三頭', 9, '19:30', '伏地挺身',         2, null, 12, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '伏地挺身',         3, null, 10, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '伏地挺身',         4, null,  9, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴肩推',         1, 10,   11, null, '右肩比較緊，第四組明顯偏掉。', null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴肩推',         2, 10,   10, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴肩推',         3, 10,    9, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴肩推',         4, 10,    8, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴側平舉',       1, 6,    15, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴側平舉',       2, 6,    13, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴側平舉',       3, 6,    12, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴過頭三頭伸展', 1, 8,    13, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴過頭三頭伸展', 2, 8,    11, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '啞鈴過頭三頭伸展', 3, 8,    10, null, null, null),
('在家推日：胸肩三頭', 9, '19:30', '等長夾胸',         1, null, null, 30, null, null),
('在家推日：胸肩三頭', 9, '19:30', '等長夾胸',         2, null, null, 30, null, null),
('在家推日：胸肩三頭', 9, '19:30', '棒式',             1, null, null, 45, '最後一組腰開始塌，撐到 38 秒就停。', null),
('在家推日：胸肩三頭', 9, '19:30', '棒式',             2, null, null, 45, null, null),
('在家推日：胸肩三頭', 9, '19:30', '棒式',             3, null, null, 38, null, null);

-- ---------------------------------------------------------------
-- 拉日（7 天前，晚上）
-- ---------------------------------------------------------------
insert into _seed (card, days_ago, at_time, ex, set_index, weight, reps, hold, feel, overall) values
('在家拉日：背後三角二頭', 7, '20:00', '彈力帶下拉',   1, null, 18, null, null, '[範例] 背的感受比上次好，握力還是先到極限。'),
('在家拉日：背後三角二頭', 7, '20:00', '彈力帶下拉',   2, null, 16, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '單臂啞鈴划船', 1, 12.5, 12, null, '用手肘往後拉的意識比較有背感。', null),
('在家拉日：背後三角二頭', 7, '20:00', '單臂啞鈴划船', 2, 12.5, 11, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '單臂啞鈴划船', 3, 12.5, 10, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '單臂啞鈴划船', 4, 12.5,  9, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴俯身划船', 1, 12.5, 12, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴俯身划船', 2, 12.5, 11, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴俯身划船', 3, 12.5, 10, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '俯身側平舉',   1, 5,    16, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '俯身側平舉',   2, 5,    14, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '俯身側平舉',   3, 5,    12, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '錘式彎舉',     1, 10,   12, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '錘式彎舉',     2, 10,   11, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '錘式彎舉',     3, 10,   10, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴二頭彎舉', 1, 8,    14, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴二頭彎舉', 2, 8,    12, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '啞鈴二頭彎舉', 3, 8,    11, null, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '農夫走路',     1, null, null, 40, '握力先到極限，背還有餘裕。', null),
('在家拉日：背後三角二頭', 7, '20:00', '農夫走路',     2, null, null, 40, null, null),
('在家拉日：背後三角二頭', 7, '20:00', '農夫走路',     3, null, null, 33, null, null);

-- ---------------------------------------------------------------
-- 腿日（5 天前，早上 —— 刻意排早上，可以順便驗證時區沒有差一天）
-- ---------------------------------------------------------------
insert into _seed (card, days_ago, at_time, ex, set_index, weight, reps, hold, feel, overall) values
('在家腿日：股四頭臀腿後', 5, '07:15', '彈力帶側走',     1, null, 14, null, null, '[範例] 早上練狀態普通，但腿後的拉伸感比預期好。'),
('在家腿日：股四頭臀腿後', 5, '07:15', '彈力帶側走',     2, null, 12, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '高腳杯深蹲',     1, 16,   12, null, '蹲到底腳踝有點卡，下次先鬆一下小腿。', null),
('在家腿日：股四頭臀腿後', 5, '07:15', '高腳杯深蹲',     2, 16,   11, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '高腳杯深蹲',     3, 16,   10, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '高腳杯深蹲',     4, 16,    9, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '羅馬尼亞硬舉',   1, 15,   12, null, '腿後拉伸感很明顯，重量可以再加。', null),
('在家腿日：股四頭臀腿後', 5, '07:15', '羅馬尼亞硬舉',   2, 15,   12, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '羅馬尼亞硬舉',   3, 15,   11, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '羅馬尼亞硬舉',   4, 15,   10, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '保加利亞分腿蹲', 1, 10,   10, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '保加利亞分腿蹲', 2, 10,    9, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '保加利亞分腿蹲', 3, 10,    8, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '單腿臀橋',       1, null, 15, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '單腿臀橋',       2, null, 14, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '單腿臀橋',       3, null, 12, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '站姿提踵',       1, 12.5, 20, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '站姿提踵',       2, 12.5, 18, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '站姿提踵',       3, 12.5, 16, null, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '側棒式',         1, null, null, 30, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '側棒式',         2, null, null, 30, null, null),
('在家腿日：股四頭臀腿後', 5, '07:15', '側棒式',         3, null, null, 26, null, null);

-- ---------------------------------------------------------------
-- 推日 #2（2 天前）—— 跟 9 天前那次比，肩推次數上來了
-- 側平舉沒做（那天時間不夠），刻意留一個「跳過的動作」給明細頁呈現
-- ---------------------------------------------------------------
insert into _seed (card, days_ago, at_time, ex, set_index, weight, reps, hold, feel, overall) values
('在家推日：胸肩三頭', 2, '19:45', '彈力帶外旋',       1, null, 20, null, null, '[範例] 肩推每組都多做一下，右肩也沒那麼緊了。時間不夠，側平舉跳過。'),
('在家推日：胸肩三頭', 2, '19:45', '彈力帶外旋',       2, null, 18, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '伏地挺身',         1, null, 16, null, '這次一開始就找得到胸的感覺。', null),
('在家推日：胸肩三頭', 2, '19:45', '伏地挺身',         2, null, 14, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '伏地挺身',         3, null, 12, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '伏地挺身',         4, null, 10, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴肩推',         1, 10,   12, null, '右肩比上次鬆，第四組還能控制住。', null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴肩推',         2, 10,   11, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴肩推',         3, 10,   10, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴肩推',         4, 10,    9, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴過頭三頭伸展', 1, 8,    14, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴過頭三頭伸展', 2, 8,    12, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '啞鈴過頭三頭伸展', 3, 8,    11, null, null, null),
('在家推日：胸肩三頭', 2, '19:45', '等長夾胸',         1, null, null, 30, null, null),
('在家推日：胸肩三頭', 2, '19:45', '等長夾胸',         2, null, null, 30, null, null),
('在家推日：胸肩三頭', 2, '19:45', '棒式',             1, null, null, 45, '腰沒塌，三組都撐滿。', null),
('在家推日：胸肩三頭', 2, '19:45', '棒式',             2, null, null, 45, null, null),
('在家推日：胸肩三頭', 2, '19:45', '棒式',             3, null, null, 45, null, null);

-- ---------------------------------------------------------------
-- 寫入
-- ---------------------------------------------------------------
do $$
declare
  uid uuid;
  s record;
  e record;
  r record;
  card_id uuid;
  sess_id uuid;
  ce_id uuid;
  log_id uuid;
  performed timestamptz;
begin
  select id into uid from auth.users where email = 'garykh2008@gmail.com';
  if uid is null then
    raise exception '找不到使用者';
  end if;

  -- 每一組 (card, days_ago) 就是一次訓練
  for s in
    select distinct card, days_ago, at_time,
           max(overall) as overall
    from _seed group by card, days_ago, at_time
  loop
    select id into card_id from fitness.workout_cards
      where user_id = uid and title = s.card and status = 'active' limit 1;
    if card_id is null then
      raise notice '找不到訓練卡「%」，略過', s.card;
      continue;
    end if;

    -- 在台北時區組出當地時間，再交給 timestamptz 存成正確的時刻
    performed := ((((now() at time zone 'Asia/Taipei')::date - s.days_ago)
                   + s.at_time) at time zone 'Asia/Taipei');

    insert into fitness.workout_sessions (user_id, workout_card_id, performed_at, overall_note)
    values (uid, card_id, performed, s.overall)
    returning id into sess_id;

    for e in
      select ex, max(feel) as feel
      from _seed
      where card = s.card and days_ago = s.days_ago
      group by ex
    loop
      select ce.id into ce_id
      from fitness.card_exercises ce
      join fitness.exercises x on x.id = ce.exercise_id
      where ce.workout_card_id = card_id and x.name_zh = e.ex
      limit 1;

      if ce_id is null then
        raise notice '卡片「%」裡找不到動作「%」，略過', s.card, e.ex;
        continue;
      end if;

      insert into fitness.exercise_logs (session_id, card_exercise_id, feel_note)
      values (sess_id, ce_id, e.feel)
      returning id into log_id;

      for r in
        select set_index, weight, reps, hold
        from _seed
        where card = s.card and days_ago = s.days_ago and ex = e.ex
        order by set_index
      loop
        insert into fitness.set_logs
          (exercise_log_id, set_index, weight_kg, reps_done, hold_seconds_done, completed_at)
        values (log_id, r.set_index, r.weight, r.reps, r.hold, performed);
      end loop;
    end loop;
  end loop;
end $$;

drop table _seed;

-- ---------------------------------------------------------------
-- 驗收
-- ---------------------------------------------------------------
select
  to_char(s.performed_at at time zone 'Asia/Taipei', 'MM/DD HH24:MI') as 台北時間,
  c.title as 卡片,
  count(distinct el.id) as 動作數,
  count(sl.id)          as 組數,
  left(s.overall_note, 28) as 備註
from fitness.workout_sessions s
join fitness.workout_cards c on c.id = s.workout_card_id
left join fitness.exercise_logs el on el.session_id = s.id
left join fitness.set_logs sl on sl.exercise_log_id = el.id
group by s.id, s.performed_at, c.title, s.overall_note
order by s.performed_at desc;
