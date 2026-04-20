// src/features/channels/ChannelsPanel.tsx
import { useState } from "react";
import { theme as P } from "../../theme";
import { useLang } from "../../i18n";
import { TelegramDetail } from "./TelegramDetail";
import { WeChatDetail } from "./WeChatDetail";

type ChannelId = "telegram" | "wechat";

interface Channel {
  id: ChannelId;
  icon: string;
  labelKey: "telegram" | "wechat";
}

const CHANNELS: Channel[] = [
  { id: "telegram", icon: "✈️", labelKey: "telegram" },
  { id: "wechat",   icon: "💬", labelKey: "wechat"   },
];

export function ChannelsPanel() {
  const { t } = useLang();
  const [selected, setSelected] = useState<ChannelId>("telegram");

  const labels: Record<ChannelId, string> = {
    telegram: "Telegram",
    wechat: t.channels.wechat.label,
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(200px, 0.75fr) minmax(0, 1.4fr)",
      gap: 20,
      alignItems: "start",
    }}>
      {/* Sidebar */}
      <div style={{
        border: `1.5px solid ${P.border}`,
        borderRadius: P.radius.lg,
        overflow: "hidden",
        background: P.white,
        boxShadow: P.shadow.card,
      }}>
        {CHANNELS.map((ch, i) => {
          const active = selected === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setSelected(ch.id)}
              style={{
                width: "100%", textAlign: "left",
                background: active ? "#EEF0FF" : P.white,
                border: "none",
                borderBottom: i < CHANNELS.length - 1 ? `1.5px solid ${P.border}` : "none",
                borderLeft: active ? `3px solid ${P.indigo}` : "3px solid transparent",
                padding: "16px 18px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                transition: "background 0.12s",
              }}
            >
              <span style={{ fontSize: 22 }}>{ch.icon}</span>
              <span style={{
                fontWeight: 700, fontSize: 14,
                color: active ? P.indigo : P.ink,
                fontFamily: "Nunito,sans-serif",
              }}>
                {labels[ch.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div>
        {selected === "telegram" && <TelegramDetail />}
        {selected === "wechat"   && <WeChatDetail />}
      </div>
    </div>
  );
}
