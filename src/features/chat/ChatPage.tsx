// src/features/chat/ChatPage.tsx
import { useEffect, useRef, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { useChat, ChatMessage } from "./useChat";

function bubbleStyle(msg: ChatMessage): React.CSSProperties {
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
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
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
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 140px)", minHeight: 500,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 8,
      }}>
        <div>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 20, color: P.ink }}>
            {t.chat.title}
          </div>
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
          flex: 1, overflowY: "auto",
          border: "1px solid #E8E8F5", borderRadius: 12,
          background: "#FAFAFE", padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
          marginBottom: 12,
        }}
      >
        {messages.length === 0 && !pending && (
          <div style={{ margin: "auto", textAlign: "center", color: P.soft, fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            {t.chat.empty}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={bubbleStyle(m)}>{m.text}</div>
        ))}
        {pending && (
          <div style={{
            alignSelf: "flex-start", background: "#EEF0FF",
            border: "1px solid #D5DAFF", borderRadius: 12,
            padding: "8px 14px", fontSize: 13, color: P.indigo, fontWeight: 700,
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
