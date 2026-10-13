"use client";
import { Sparkles } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { EmptyState } from "@/components/empty-state";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatContext } from "@/components/chat/chat-context";
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
          <p>Tanyakan sesuatu tentang bisnis Anda.</p>
        </div>
        <span className="page-label">
          <Sparkles size={16} />
          Jawaban dari data Anda
        </span>
      </div>
      {metrics && data ? (
        <>
          <ChatContext data={data} metrics={metrics} />
          <ChatPanel metrics={metrics} key={data.source.loadedAt} />
          <p className="supporting chat-data-assurance">
            RAMU membaca ringkasan angka bisnis Anda. File mentah tidak dikirim
            ke AI.
          </p>
        </>
      ) : (
        <EmptyState purpose="ask" />
      )}
    </div>
  );
}
