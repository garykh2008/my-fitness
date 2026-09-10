-- 範例訓練卡：胸肌感受度優先
--
-- 用來看「一張卡實際長什麼樣子」。內容取自 fitness-platform-spec.md 的例子：
-- 先用飛鳥預先疲勞，再進臥推抓感受度，最後用等長收縮把張力留在胸口。
--
-- 冪等：靠 source_note 認人，重跑會先清掉舊的範例再重建，不會累積。
-- 不想要了就整段刪掉：
--   delete from fitness.workout_cards where source_note = 'sample:chest-feel-v1';
--   delete from fitness.exercises   where notes       = 'sample:chest-feel-v1';
--
-- 執行：
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed-sample-card.sql

do $$
declare
  uid uuid;
  card_id uuid;
  ex_fly uuid;
  ex_press uuid;
  ex_squeeze uuid;
begin
  select id into uid from auth.users where email = 'garykh2008@gmail.com';
  if uid is null then
    raise exception '找不到使用者 garykh2008@gmail.com';
  end if;

  -- 先清掉上一次的範例（card_exercises 是 on delete cascade）
  delete from fitness.workout_cards where user_id = uid and source_note = 'sample:chest-feel-v1';
  delete from fitness.exercises     where user_id = uid and notes       = 'sample:chest-feel-v1';

  -- --- 動作庫 ---
  insert into fitness.exercises (user_id, name_zh, name_en, category, default_equipment, default_cue, notes)
  values (uid, '啞鈴飛鳥', 'Dumbbell Fly', 'chest', '啞鈴',
          '手肘保持微彎不變角度，想像用胸口把兩隻手臂「抱」起來，不是用手推。',
          'sample:chest-feel-v1')
  returning id into ex_fly;

  insert into fitness.exercises (user_id, name_zh, name_en, category, default_equipment, default_cue, notes)
  values (uid, '啞鈴臥推', 'Dumbbell Bench Press', 'chest', '啞鈴',
          '肩胛骨收好壓在椅面上，下放時讓胸口張開，推起來時不要把肩膀往前頂。',
          'sample:chest-feel-v1')
  returning id into ex_press;

  insert into fitness.exercises (user_id, name_zh, name_en, category, default_equipment, default_cue, notes)
  values (uid, '等長夾胸', 'Isometric Chest Squeeze', 'chest', '徒手',
          '雙掌在胸前互推，全程用力夾住不放鬆，呼吸不要憋。',
          'sample:chest-feel-v1')
  returning id into ex_squeeze;

  -- --- 訓練卡 ---
  insert into fitness.workout_cards (user_id, title, thesis, source_note, status)
  values (uid, '胸肌感受度優先',
          '先用飛鳥預先疲勞，讓胸肌在臥推時搶先出力，把三頭的參與壓下去。',
          'sample:chest-feel-v1',
          'active')
  returning id into card_id;

  -- --- 卡片內動作（順序就是訓練邏輯：預先疲勞 → 主項 → 收尾）---
  insert into fitness.card_exercises
    (workout_card_id, exercise_id, order_index, mode,
     target_sets, target_reps_min, target_reps_max, target_hold_seconds,
     tempo_text, cue_text, rest_seconds)
  values
    (card_id, ex_fly, 0, 'reps',
     3, 12, 15, null,
     '下放3秒/底部停1秒/夾起1秒',
     '重量放輕，這組的目的是把胸口點起來，不是練力量。',
     60),

    (card_id, ex_press, 1, 'reps',
     4, 8, 12, null,
     '下放3秒/頂端擠壓1秒/上推1秒',
     '下放到底上臂感受變多，頂端不要鎖死手肘，留一點彎度維持張力。',
     90),

    (card_id, ex_squeeze, 2, 'hold',
     3, null, null, 30,
     '全程持續發力',
     '練到這裡胸口應該已經很脹，這組是把張力留住，不用追求時間長。',
     45);
end $$;

-- 確認結果
select c.title,
       ce.order_index + 1 as 順序,
       e.name_zh,
       ce.mode,
       ce.target_sets,
       coalesce(ce.target_reps_min::text || '-' || ce.target_reps_max::text,
                ce.target_hold_seconds::text || 's') as 目標,
       ce.tempo_text
from fitness.workout_cards c
join fitness.card_exercises ce on ce.workout_card_id = c.id
join fitness.exercises e on e.id = ce.exercise_id
where c.source_note = 'sample:chest-feel-v1'
order by ce.order_index;
