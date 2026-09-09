"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCard } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "建立中…" : "建立並加入動作"}
    </button>
  );
}

export default function NewCardForm() {
  const [state, action] = useActionState(createCard, undefined);

  return (
    <form action={action}>
      {state?.error && <div className="notice error">{state.error}</div>}

      <div className="field">
        <label>標題</label>
        <input name="title" placeholder="例：胸肌感受度優先" required />
      </div>

      <div className="field">
        <label>訓練邏輯（一句話）</label>
        <textarea
          name="thesis"
          rows={2}
          placeholder="例：先用飛鳥預先疲勞，再進臥推抓感受度"
        />
      </div>

      <div className="field">
        <label>來源備註</label>
        <textarea
          name="source_note"
          rows={2}
          placeholder="對應哪次對話、討論了什麼"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
