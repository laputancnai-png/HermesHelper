# Chat Feature Design — HermesHelper

**Date:** 2026-04-17  
**Status:** Approved

---

## Overview

Add a full-page chat tab to HermesHelper that lets the user send messages to the local Hermes agent via `hermes chat -q ... -Q --resume <session_id>`. The session ID is persisted so conversation context survives across messages within a session. Users can start a new session at any time.

---

## Architecture

### Navigation Change (App.tsx)

Replace the single-page scroll layout with two-tab navigation in the sticky navbar, matching OpenClawHelper style:

- **`🤖 管理`** tab — existing panels (HermesStatusPanel, InstallPanel, ModelPanel, MigratePanel)
- **`💬 聊天`** tab — new ChatPage component

Tab state: `const [page, setPage] = useState<"manage" | "chat">("manage")`

Active tab: indigo bottom-border + indigo text color. Inactive: gray soft text. Same button pattern as OpenClaw's nav links.

---

## New Files

### Frontend

```
src/features/chat/
  ChatPage.tsx      — UI component
  useChat.ts        — state hook
```

### Backend

```
src-tauri/src/commands/chat.rs
```

---

## Backend: `chat.rs`

### Data types

```rust
pub struct ChatReply {
    pub reply: String,
    pub session_id: String,
}
```

### Command

```rust
#[tauri::command]
pub async fn hermes_chat(message: String, session_id: Option<String>) -> Result<ChatReply, String>
```

**Implementation:**

1. Build args: `["chat", "-q", &message, "-Q"]` + optionally `["--resume", &session_id]`
2. Spawn `hermes` via `tokio::process::Command`, capture stdout + stderr
3. Parse stdout:
   - The `-Q` flag outputs the reply followed by a session info line. Test the actual format on first run; likely `Session: <id>` or similar at the end.
   - Strategy: split stdout on the last line that matches a session pattern. Everything before = reply. The matched line yields session_id.
   - Fallback: if no session line found, generate a UUID as session_id and return full stdout as reply.
4. Return `ChatReply { reply, session_id }`

Register in `lib.rs` invoke_handler.

---

## Frontend: `useChat.ts`

**State:**

```ts
messages: Message[]          // { role: "user"|"assistant", text: string, ts: number }
sessionId: string            // current Hermes session ID, persisted to localStorage
pending: boolean
error: string
```

**localStorage keys:**
- `hermeshelper.chat.messages.v1` — message history (capped at 200)
- `hermeshelper.chat.sessionId.v1` — current session ID

**Actions:**
- `send(text)` — optimistically append user message → call `Commands.hermesChat(text, sessionId)` → append reply + update sessionId
- `newSession()` — clear messages + sessionId from state and localStorage

---

## Frontend: `ChatPage.tsx`

**Layout:**

```
┌─────────────────────────────────────────┐
│ 💬 Hermes 聊天   [session: abc12]  [新对话] │  ← header row
├─────────────────────────────────────────┤
│                                         │
│   [assistant bubble] 你好，我是 Hermes  │
│                                         │
│               [user bubble] 你好        │
│                                         │
│   [assistant bubble] 有什么可以帮你？   │
│                        ↕ auto-scroll    │
├─────────────────────────────────────────┤
│ [textarea ──────────────────] [发送]    │  ← input row
│  Cmd+Enter 发送                         │
└─────────────────────────────────────────┘
```

**Bubble style (matching OpenClaw ChatsPage):**
- User: right-aligned, `#EAF7F2` bg, `#BFE8D8` border
- Assistant: left-aligned, `#EEF0FF` bg, `#D5DAFF` border
- `pre-wrap`, `word-break: break-word`

**Pending state:** Show a "Hermes 思考中…" bubble (indigo, animated dots or static) while waiting.

**Error state:** Show error inline below the input in `P.coral`.

**Empty state:** Show a centered greeting: "发消息开始与 Hermes 对话"

---

## Tauri Command Registration

In `src/lib/tauri.ts`:
```ts
hermesChat: (message: string, sessionId?: string): Promise<ChatReply> =>
  tauriInvoke("hermes_chat", { message, sessionId })
```

In `src-tauri/src/lib.rs`: add `chat::hermes_chat` to invoke_handler.

---

## i18n Additions

Both `ZH` and `EN` objects in `i18n.tsx`:

```ts
chat: {
  title: "Hermes 聊天",
  subtitle: "与 Hermes AI 助手直接对话",
  send: "发送",
  sending: "发送中",
  placeholder: "输入消息… (Cmd+Enter 发送)",
  newSession: "新对话",
  sessionLabel: "会话",
  thinking: "Hermes 思考中…",
  empty: "发消息开始与 Hermes 对话",
  error: "发送失败",
}
```

---

## Error Handling

- If `hermes` binary not found → return error "Hermes 未安装，请先安装"
- If command times out (>120s) → return timeout error
- If exit code != 0 → return stderr as error message
- Frontend shows error inline; does not crash session state

---

## Constraints

- No streaming — single round-trip per message (Hermes `-Q` mode outputs final reply only)
- Session context maintained via `--resume SESSION_ID` flag
- One session at a time (no multi-session switching)
- Message history capped at 200 entries in localStorage
