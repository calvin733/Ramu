"use client";
import { Sparkles } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { EmptyState } from "@/components/empty-state";
import { ChatPanel } from "@/components/chat/chat-panel";
export default function AskPage() {
  const { data, metrics } = useBusiness();
  return (
    <div className="page ask-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ANGKA PUNYA CERITA</span>
          <h1>
            Tanya RAMU<span className="title-dot">.</span>
          </h1>
          <p>Tanyakan apa pun tentang data bisnis Anda.</p>
        </div>
        <span className="page-label">
          <Sparkles size={16} />
          Jawaban dari data Anda
        </span>
      </div>
      {metrics && data ? (
        <ChatPanel
          metrics={metrics}
          name={data.source.name}
          key={data.source.loadedAt}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
