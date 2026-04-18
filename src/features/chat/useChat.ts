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
