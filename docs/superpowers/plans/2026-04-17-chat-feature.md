# Chat Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-page 💬 Chat tab to HermesHelper that lets the user converse with the local Hermes agent via `hermes chat -q ... -Q --source tool [--resume SESSION_ID]`.

**Architecture:** Backend Tauri command spawns the Hermes CLI per message and parses the `session_id: <id>` first line from stdout; frontend `useChat` hook maintains message history and session ID in localStorage; `App.tsx` gains two-tab navigation (管理 / 聊天).

**Tech Stack:** Rust (tokio::process::Command), React + TypeScript, Tauri v2, localStorage persistence.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src-tauri/src/commands/chat.rs` |
| Modify | `src-tauri/src/commands/mod.rs` |
| Modify | `src-tauri/src/lib.rs` |
| Modify | `src/lib/tauri.ts` |
| Modify | `src/i18n.tsx` |
| Create | `src/features/chat/useChat.ts` |
| Create | `src/features/chat/ChatPage.tsx` |
| Modify | `src/App.tsx` |

---

## Confirmed CLI behaviour

```
$ hermes chat -q "hi" -Q --source tool
session_id: 20260417_205314_7cff2b
Hello! How can I help?

$ hermes chat -q "follow-up" -Q --source tool --resume 20260417_205314_7cff2b
↻ Resumed session 20260417_205314_7cff2b (...)

session_id: 20260417_205314_7cff2b
<reply>
```

Parsing rule: find the line beginning with `session_id: `, extract the ID, join every line **after** it as the reply (trimmed).

---

## Task 1: Rust backend `chat.rs`

**Files:**
- Create: `src-tauri/src/commands/chat.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `chat.rs`**

```rust
// src-tauri/src/commands/chat.rs
use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub reply: String,
    pub session_id: String,
}

fn parse_hermes_output(raw: &str) -> (String, String) {
    let mut session_id = String::new();
    let mut reply_lines: Vec<&str> = Vec::new();
    let mut found = false;

    for line in raw.lines() {
        if !found {
            if let Some(id) = line.strip_prefix("session_id: ") {
                session_id = id.trim().to_string();
                found = true;
            }
            // skip lines before session_id (e.g. "↻ Resumed session ...")
        } else {
            reply_lines.push(line);
        }
    }

    let reply = reply_lines.join("\n").trim().to_string();
    (reply, session_id)
}

#[tauri::command]
pub async fn hermes_chat(
    message: String,
    session_id: Option<String>,
) -> Result<ChatReply, String> {
    let mut args = vec![
        "chat".to_string(),
        "-q".to_string(),
        message,
        "-Q".to_string(),
        "--source".to_string(),
        "tool".to_string(),
    ];
    if let Some(ref id) = session_id {
        if !id.is_empty() {
            args.push("--resume".to_string());
            args.push(id.clone());
        }
    }

    let output = Command::new("hermes")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Hermes 未安装或无法启动: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() && stdout.trim().is_empty() {
        let msg = if stderr.is_empty() { "Hermes 返回错误".to_string() } else { stderr.trim().to_string() };
        return Err(msg);
    }

    let (reply, sid) = parse_hermes_output(&stdout);

    if sid.is_empty() {
        return Err(format!("无法解析 session_id，原始输出: {}", stdout.trim()));
    }

    Ok(ChatReply { reply, session_id: sid })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_new_session() {
        let raw = "session_id: abc123\nHello, world!";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "abc123");
        assert_eq!(reply, "Hello, world!");
    }

    #[test]
    fn test_parse_resumed_session() {
        let raw = "↻ Resumed session abc123 (2 messages)\n\nsession_id: abc123\nHi again!";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "abc123");
        assert_eq!(reply, "Hi again!");
    }

    #[test]
    fn test_parse_multiline_reply() {
        let raw = "session_id: xyz\nLine one\nLine two\nLine three";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "xyz");
        assert_eq!(reply, "Line one\nLine two\nLine three");
    }

    #[test]
    fn test_parse_missing_session_id() {
        let raw = "some unexpected output";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "");
        assert_eq!(reply, "");
    }
}
```

- [ ] **Step 2: Expose module in `mod.rs`**

Open `src-tauri/src/commands/mod.rs` and add:

```rust
pub mod chat;
```

(Add after the existing `pub mod` lines.)

- [ ] **Step 3: Register command in `lib.rs`**

In `src-tauri/src/lib.rs`, add `chat` to the imports and invoke_handler:

```rust
// top of file — add chat to the use statement:
use commands::{chat, config, gateway, installer, migrate, process, status, tools};

// in invoke_handler list, add:
chat::hermes_chat,
```

- [ ] **Step 4: Run the Rust unit tests**

```bash
cd /Users/laputancnai/HermesHelper/src-tauri
cargo test chat -- --nocapture
```

Expected output: 4 tests pass (`test_parse_new_session`, `test_parse_resumed_session`, `test_parse_multiline_reply`, `test_parse_missing_session_id`).

- [ ] **Step 5: Verify build**

```bash
cd /Users/laputancnai/HermesHelper/src-tauri
cargo build 2>&1 | tail -5
```

Expected: `Finished` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src-tauri/src/commands/chat.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(backend): add hermes_chat Tauri command with session ID support"
```

---

## Task 2: Frontend types + `tauri.ts`

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add `ChatReply` interface and `hermesChat` command**

In `src/lib/tauri.ts`, add after the `ImportSummary` interface:

```typescript
export interface ChatReply {
  reply: string;
  sessionId: string;
}
```

In the `Commands` object, add after `executeImport`:

```typescript
  hermesChat: (message: string, sessionId?: string): Promise<ChatReply> =>
    tauriInvoke("hermes_chat", { message, sessionId: sessionId ?? null }),
```

- [ ] **Step 2: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src/lib/tauri.ts
git commit -m "feat(frontend): add ChatReply type and hermesChat command"
```

---

## Task 3: i18n additions

**Files:**
- Modify: `src/i18n.tsx`

- [ ] **Step 1: Add `chat` namespace to ZH object**

In `src/i18n.tsx`, add to the `ZH` object before the closing `}`:

```typescript
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
    cleared: "已开始新对话",
  },
```

- [ ] **Step 2: Add `chat` namespace to EN object**

In `src/i18n.tsx`, add to the `EN` object before its closing `}`:

```typescript
  chat: {
    title: "Hermes Chat",
    subtitle: "Chat directly with your Hermes AI agent",
    send: "Send",
    sending: "Sending",
    placeholder: "Type a message… (Cmd+Enter to send)",
    newSession: "New Chat",
    sessionLabel: "Session",
    thinking: "Hermes is thinking…",
    empty: "Send a message to start chatting with Hermes",
    error: "Send failed",
    cleared: "New conversation started",
  },
```

- [ ] **Step 3: Add `nav` entries for tabs**

In `src/i18n.tsx`, update the `nav` object in both `ZH` and `EN`:

ZH:
```typescript
  nav: { lang: "语言", manage: "管理", chat: "💬 聊天" },
```

EN:
```typescript
  nav: { lang: "Language", manage: "Manage", chat: "💬 Chat" },
```

- [ ] **Step 4: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src/i18n.tsx
git commit -m "feat(i18n): add chat namespace and nav tab labels"
```

---

## Task 4: `useChat.ts` hook

**Files:**
- Create: `src/features/chat/useChat.ts`

- [ ] **Step 1: Create `src/features/chat/useChat.ts`**

```typescript
// src/features/chat/useChat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { Commands } from "../../lib/tauri";

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  text: string;
  ts: number;
}

const MSG_KEY = "hermeshelper.chat.messages.v1";
const SID_KEY = "hermeshelper.chat.sessionId.v1";
const MAX_MESSAGES = 200;

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MSG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function loadSessionId(): string {
  try {
    return localStorage.getItem(SID_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(MSG_KEY, JSON.stringify(msgs.slice(-MAX_MESSAGES)));
  } catch {}
}

function saveSessionId(id: string) {
  try {
    localStorage.setItem(SID_KEY, id);
  } catch {}
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [sessionId, setSessionId] = useState<string>(loadSessionId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);

  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => { saveSessionId(sessionId); }, [sessionId]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setError("");

    const userMsg: ChatMessage = { role: "user", text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await Commands.hermesChat(trimmed, sessionId || undefined);
      const assistantMsg: ChatMessage = { role: "assistant", text: result.reply, ts: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      setSessionId(result.sessionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      const errMsg: ChatMessage = { role: "error", text: `❌ ${msg}`, ts: Date.now() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setPending(false);
      pendingRef.current = false;
    }
  }, [sessionId]);

  const newSession = useCallback(() => {
    setMessages([]);
    setSessionId("");
    setError("");
    saveMessages([]);
    saveSessionId("");
  }, []);

  return { messages, sessionId, pending, error, send, newSession };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src/features/chat/useChat.ts
git commit -m "feat(frontend): add useChat hook with localStorage persistence"
```

---

## Task 5: `ChatPage.tsx` component

**Files:**
- Create: `src/features/chat/ChatPage.tsx`

- [ ] **Step 1: Create `src/features/chat/ChatPage.tsx`**

```tsx
// src/features/chat/ChatPage.tsx
import { useEffect, useRef, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { useChat, ChatMessage } from "./useChat";

function bubble(msg: ChatMessage) {
  const isUser = msg.role === "user";
  const isError = msg.role === "error";
  return {
    alignSelf: isUser ? "flex-end" : "flex-start",
    background: isUser ? "#EAF7F2" : isError ? "#FFF0EE" : "#EEF0FF",
    border: `1px solid ${isUser ? "#BFE8D8" : isError ? "#FFD5CF" : "#D5DAFF"}`,
    borderRadius: 12,
    padding: "8px 12px",
    fontSize: 13,
    maxWidth: "82%",
    whiteSpace: "pre-wrap" as const,
    overflowWrap: "anywhere" as const,
    wordBreak: "break-word" as const,
    color: P.ink,
    lineHeight: 1.5,
  };
}

export function ChatPage() {
  const { t } = useLang();
  const { messages, sessionId, pending, send, newSession } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    await send(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div style={{
      background: P.white, borderRadius: 22, padding: "20px 24px",
      boxShadow: "0 8px 24px #00000010", border: "2px solid #EBEBF8",
      display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", minHeight: 500,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 20, color: P.ink }}>{t.chat.title}</div>
          <div style={{ fontSize: 12, color: P.soft }}>{t.chat.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sessionId && (
            <span style={{
              fontSize: 10, color: P.soft, background: "#F5F6FE",
              border: "1px solid #E1E4FA", borderRadius: 999, padding: "3px 8px",
            }}>
              <b>{t.chat.sessionLabel}:</b> {sessionId}
            </span>
          )}
          <Btn small ghost onClick={newSession} disabled={pending}>
            {t.chat.newSession}
          </Btn>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", border: "1px solid #E8E8F5",
          borderRadius: 12, background: "#FAFAFE", padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8, marginBottom: 12,
        }}
      >
        {messages.length === 0 && !pending && (
          <div style={{ margin: "auto", textAlign: "center", color: P.soft, fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            {t.chat.empty}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={bubble(m)}>{m.text}</div>
        ))}
        {pending && (
          <div style={{
            alignSelf: "flex-start", background: "#EEF0FF", border: "1px solid #D5DAFF",
            borderRadius: 12, padding: "8px 14px", fontSize: 13, color: P.indigo, fontWeight: 700,
          }}>
            <span className="spin" style={{ marginRight: 6 }}>⚙️</span>
            {t.chat.thinking}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chat.placeholder}
          rows={3}
          disabled={pending}
          style={{
            flex: 1, border: "2px solid #E8E8F5", borderRadius: 12,
            padding: "10px 12px", fontSize: 13, resize: "vertical",
            minHeight: 72, lineHeight: 1.5, fontFamily: "Nunito,sans-serif",
            opacity: pending ? 0.7 : 1,
          }}
        />
        <Btn
          color={P.indigo}
          onClick={() => void handleSend()}
          disabled={pending || !input.trim()}
          loading={pending}
          small
        >
          {pending ? t.chat.sending : t.chat.send}
        </Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src/features/chat/ChatPage.tsx
git commit -m "feat(frontend): add ChatPage component with bubble UI"
```

---

## Task 6: `App.tsx` tab navigation

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update imports in `App.tsx`**

Add to the top of `src/App.tsx`:

```typescript
import { useState } from "react";
import { ChatPage } from "./features/chat/ChatPage";
```

(Remove any existing `useState` import duplicate if present; it's likely already imported.)

- [ ] **Step 2: Replace `AppInner` content with tabbed layout**

Replace the entire `AppInner` function body with:

```tsx
function AppInner() {
  const { t } = useLang();
  const [page, setPage] = useState<"manage" | "chat">("manage");

  const NAV_TABS = [
    { id: "manage" as const, label: t.nav.manage, emoji: "🤖" },
    { id: "chat"   as const, label: t.nav.chat,   emoji: "💬" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Nunito,sans-serif" }}>
      {/* Sticky Navbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        height: P.nav.height,
        background: P.nav.bg,
        borderBottom: `1.5px solid ${P.nav.border}`,
        display: "flex", alignItems: "center",
        padding: "0 24px",
        boxShadow: "0 2px 8px rgba(91,95,239,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <span style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.app.brand}
          </span>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 0 }}>
          {NAV_TABS.map(tab => {
            const active = page === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPage(tab.id)}
                style={{
                  background: "transparent",
                  color: active ? P.indigo : P.soft,
                  border: "none",
                  borderBottom: active ? `3px solid ${P.indigo}` : "3px solid transparent",
                  borderTop: "3px solid transparent",
                  padding: "0 16px",
                  height: P.nav.height,
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Nunito,sans-serif",
                  transition: "color 0.12s",
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = P.ink; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = P.soft; }}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <LangPicker />
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 880, margin: "28px auto 0", padding: "0 20px 40px" }}>
        {page === "manage" && (
          <>
            <HermesStatusPanel />
            <InstallPanel />
            <ModelPanel />
            <MigratePanel />
          </>
        )}
        {page === "chat" && <ChatPage />}
      </main>

      <Toast />
    </div>
  );
}
```

- [ ] **Step 3: Add `ChatPage` import to `App.tsx`**

Add to the imports section at the top of `App.tsx` (alongside other feature imports):

```typescript
import { ChatPage } from "./features/chat/ChatPage";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/laputancnai/HermesHelper
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to our changes).

- [ ] **Step 5: Commit**

```bash
cd /Users/laputancnai/HermesHelper
git add src/App.tsx
git commit -m "feat(frontend): add two-tab navigation (Manage / Chat)"
```

---

## Task 7: Integration smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/laputancnai/HermesHelper
npm run tauri dev
```

- [ ] **Step 2: Manual test checklist**

In the running app:

1. **Tab switching** — click 💬 聊天 tab; page switches to chat UI with empty state message
2. **Send a message** — type "你好" and press Cmd+Enter; user bubble appears, spinner shows, Hermes replies
3. **Session continuity** — send a second message referencing the first; Hermes should remember context
4. **Session ID pill** — appears in header after first reply
5. **新对话** button — click it; messages clear, session ID disappears, empty state returns
6. **Return to 管理 tab** — all existing panels still work (status, install, model, migrate)
7. **Page refresh** — chat history and session ID restored from localStorage

- [ ] **Step 3: Final commit**

```bash
cd /Users/laputancnai/HermesHelper
git add -A
git commit -m "feat: chat feature complete — tab nav + Hermes CLI integration"
```
