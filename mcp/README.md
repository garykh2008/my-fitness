# fitness-coach MCP server

讓 Claude 在對話中直接讀你的訓練歷史、開新的訓練卡。

零依賴 —— 純 Node（≥ 18）跑一個檔案，不需要 `npm install`。
它只是把 `/api/coach/*` 那三個端點包成 MCP 工具。

## 提供的工具

| 工具 | 用途 |
|---|---|
| `list_exercises` | 看動作庫裡已經有什麼，開課表前先沿用既有名稱 |
| `get_training_history` | 讀最近 N 次的重量／次數／感受筆記 |
| `create_workout_card` | 一次送出整份菜單，建立一張新的訓練卡 |

## 需要的環境變數

| 變數 | 值 |
|---|---|
| `FITNESS_API_URL` | `https://fitness.garyhsieh-proj.com` |
| `COACH_API_TOKEN` | VPS 上 `/root/coach-token.txt` 的內容 |

取得 token：

```bash
ssh root@vps.garyhsieh-proj.com "cat /root/coach-token.txt"
```

## 註冊到 Claude Code

有裝 `claude` CLI 的話最快（把 `<TOKEN>` 換成上面拿到的值）：

```bash
claude mcp add --scope user fitness-coach --env FITNESS_API_URL=https://fitness.garyhsieh-proj.com --env COACH_API_TOKEN=<TOKEN> -- node D:/code/my-fitness/mcp/fitness-coach-mcp.mjs
```

**只用桌面版、沒有 CLI 的話**（這台機器就是這種情況），直接編輯 `~/.claude.json`，
在最外層加一個 `mcpServers`（user scope，所有專案都吃得到）：

```json
{
  "mcpServers": {
    "fitness-coach": {
      "type": "stdio",
      "command": "node",
      "args": ["D:/code/my-fitness/mcp/fitness-coach-mcp.mjs"],
      "env": {
        "FITNESS_API_URL": "https://fitness.garyhsieh-proj.com",
        "COACH_API_TOKEN": "<TOKEN>"
      }
    }
  }
}
```

改完要開新的 session 才會載入。這個檔案很大而且是 app 在管的，動手前先備份。

> 桌面版的**一般對話**（非 Code 分頁）讀的是另一個檔
> （`%APPDATA%\Claude\claude_desktop_config.json`），新版是走 Settings 的
> Connectors／Extensions UI 設定，不是直接編這個檔。

## 自己驗證有沒有通

不需要 MCP client，直接把 JSON-RPC 灌進去就能測：

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | FITNESS_API_URL=https://fitness.garyhsieh-proj.com COACH_API_TOKEN=<TOKEN> node mcp/fitness-coach-mcp.mjs
```

應該看到 `initialize` 的回應與三個工具的定義。

## 典型用法

在對話中討論完菜單後，直接說「幫我把這份課表建成訓練卡」。Claude 會：

1. `get_training_history` 看你上次練了什麼、用多重、哪裡卡住
2. `list_exercises` 確認動作名稱，能沿用就沿用（避免歷史趨勢斷掉）
3. `create_workout_card` 建卡，回傳可直接點開的網址

## 設計上的兩個取捨

- **一次 POST 建整張卡**，而不是照 REST 慣例拆成建動作／建卡／加動作三步。
  教練吐出來的本來就是一整份菜單，拆成多次呼叫只會增加寫錯的機會。
- **工具執行失敗回 `isError: true` 而非 JSON-RPC error**，
  這樣模型看得到錯誤訊息（例如「hold 型必須提供 hold_seconds」）並且能自己修正後重試。
