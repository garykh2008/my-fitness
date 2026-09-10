#!/usr/bin/env node
/**
 * fitness-coach MCP server
 *
 * 讓 Claude 在對話中直接讀訓練歷史、開新的訓練卡。
 * 走 stdio 傳輸（換行分隔的 JSON-RPC 2.0），零依賴 —— 不需要 npm install。
 *
 * 環境變數：
 *   FITNESS_API_URL    例：https://fitness.garyhsieh-proj.com
 *   COACH_API_TOKEN    VPS 上 /root/coach-token.txt 裡那組
 *
 * 註冊方式見 mcp/README.md。
 *
 * 注意：stdout 只能出現 JSON-RPC 訊息，任何 log 一律走 stderr，
 * 否則會把協定串流弄壞。
 */

const API_URL = (process.env.FITNESS_API_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.COACH_API_TOKEN || "";

const SERVER_INFO = { name: "fitness-coach", version: "1.0.0" };
const DEFAULT_PROTOCOL = "2025-06-18";

function log(...args) {
  console.error("[fitness-coach]", ...args);
}

// --- 工具定義 ---------------------------------------------------

const EXERCISE_ITEM_SCHEMA = {
  type: "object",
  required: ["name_zh"],
  properties: {
    name_zh: {
      type: "string",
      description:
        "動作的中文名稱。先用 list_exercises 看動作庫有什麼，能沿用就沿用；" +
        "同一個動作被寫成兩個名字會讓歷史趨勢斷掉。庫裡沒有的會自動建立。",
    },
    name_en: { type: "string", description: "英文名稱（選填）" },
    category: {
      type: "string",
      description: "分類，例如 chest / back / legs / core / shoulders / arms",
    },
    equipment: { type: "string", description: "器材，例如 啞鈴 / 瑜珈墊 / 徒手" },
    mode: {
      type: "string",
      enum: ["reps", "hold"],
      description:
        "reps = 次數型；hold = 持續秒數型（等長收縮）。預設 reps。" +
        "選 hold 時必須給 hold_seconds。",
    },
    sets: { type: "integer", description: "目標組數" },
    reps_min: { type: "integer", description: "次數下限（mode=reps 時使用）" },
    reps_max: { type: "integer", description: "次數上限（mode=reps 時使用）" },
    hold_seconds: {
      type: "integer",
      description: "持續秒數（mode=hold 時必填）",
    },
    tempo: {
      type: "string",
      description: '節奏文字，例如 "下放3秒/頂端擠壓1秒/上推1秒"',
    },
    cue: {
      type: "string",
      description: "這張卡裡的提示語，會覆寫動作庫的預設 cue",
    },
    rest_seconds: { type: "integer", description: "組間休息秒數" },
  },
};

const TOOLS = [
  {
    name: "list_exercises",
    description:
      "列出動作庫裡已經有的動作（名稱、分類、器材、預設 cue）。" +
      "開新課表前先呼叫這個，盡量沿用既有名稱，讓同一個動作的歷史能串起來。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_training_history",
    description:
      "讀最近幾次的實際訓練紀錄：每個動作用了多少重量、做了幾下（或撐幾秒）、" +
      "當下的感受筆記，以及整場備註。開下一張課表前先看這個，" +
      "才知道上次練到哪、哪裡卡住。",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "要讀最近幾次訓練，預設 5，最多 30",
        },
        exercise: {
          type: "string",
          description: "只看某個動作的紀錄（填中文名稱），不填則全部",
        },
      },
    },
  },
  {
    name: "create_workout_card",
    description:
      "建立一張新的訓練卡。一次送出整份菜單，動作的先後順序就是訓練邏輯" +
      "（例如預先疲勞要把孤立動作排在複合動作前面）。" +
      "動作庫裡沒有的動作會依名稱自動建立。",
    inputSchema: {
      type: "object",
      required: ["title", "exercises"],
      properties: {
        title: {
          type: "string",
          description: '訓練卡標題，例如 "胸肌感受度優先"',
        },
        thesis: {
          type: "string",
          description: "一句話講清楚這張卡的訓練邏輯，練的時候會顯示在最上面",
        },
        source_note: {
          type: "string",
          description: "這張卡是從哪次討論來的、重點是什麼",
        },
        status: {
          type: "string",
          enum: ["draft", "active", "archived"],
          description: "預設 active",
        },
        exercises: {
          type: "array",
          minItems: 1,
          description: "依訓練順序排列的動作清單",
          items: EXERCISE_ITEM_SCHEMA,
        },
      },
    },
  },
];

// --- 呼叫後端 API -----------------------------------------------

async function callApi(path, { method = "GET", body } = {}) {
  if (!API_URL) throw new Error("未設定 FITNESS_API_URL");
  if (!TOKEN) throw new Error("未設定 COACH_API_TOKEN");

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}：回應不是 JSON —— ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(parsed?.error ?? `HTTP ${res.status}`);
  }
  return parsed;
}

async function runTool(name, args = {}) {
  switch (name) {
    case "list_exercises":
      return await callApi("/api/coach/exercises");

    case "get_training_history": {
      const params = new URLSearchParams();
      if (args.limit != null) params.set("limit", String(args.limit));
      if (args.exercise) params.set("exercise", String(args.exercise));
      const qs = params.toString();
      return await callApi(`/api/coach/history${qs ? `?${qs}` : ""}`);
    }

    case "create_workout_card":
      return await callApi("/api/coach/cards", { method: "POST", body: args });

    default:
      throw new Error(`未知的工具：${name}`);
  }
}

// --- JSON-RPC ---------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  // 通知（沒有 id）不需要回應
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      // 回報對方要求的協定版本，避免版本協商失敗
      const requested = params?.protocolVersion;
      sendResult(id, {
        protocolVersion:
          typeof requested === "string" ? requested : DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    case "notifications/initialized":
    case "initialized":
      return;

    case "ping":
      if (!isNotification) sendResult(id, {});
      return;

    case "tools/list":
      sendResult(id, { tools: TOOLS });
      return;

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments ?? {};
      try {
        const data = await runTool(toolName, args);
        sendResult(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        });
      } catch (e) {
        // 工具執行失敗回 isError，不是 JSON-RPC error ——
        // 這樣模型看得到錯誤訊息並且能自己修正後重試
        sendResult(id, {
          content: [{ type: "text", text: `呼叫失敗：${e.message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (!isNotification) {
        sendError(id, -32601, `不支援的 method：${method}`);
      }
  }
}

// --- 讀 stdin，一行一個訊息 --------------------------------------

let buffer = "";

// stdin 關閉時可能還有呼叫在飛（tools/call 要等 HTTP 回來）。
// 直接 exit 會把回應吃掉，所以等手上的請求都結束再收工。
let inFlight = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && inFlight === 0) process.exit(0);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      sendError(null, -32700, "JSON 解析失敗");
      continue;
    }

    inFlight += 1;
    handle(msg)
      .catch((e) => {
        log("處理訊息時發生未預期錯誤:", e);
        if (msg.id !== undefined && msg.id !== null) {
          sendError(msg.id, -32603, e.message);
        }
      })
      .finally(() => {
        inFlight -= 1;
        maybeExit();
      });
  }
});

process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});

log(`已啟動，API = ${API_URL || "(未設定)"}`);
