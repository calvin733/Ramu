"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  LoaderCircle,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import type { BusinessMetrics, ChatMessage } from "@/lib/types";
import { buildVerifiedContext } from "@/lib/insights";
import { requestExplanation } from "@/lib/ai/client";
import { RamuMark } from "@/components/layout/app-shell";
import { cn, formatDate } from "@/lib/utils";

const questions = [
  "Bagaimana performa bisnis saya?",
  "Produk apa yang paling laris?",
  "Produk mana yang paling menguntungkan?",
  "Apakah penjualan saya meningkat?",
  "Produk apa yang perlu diperhatikan?",
];
export function ChatPanel({
  metrics,
  name,
}: {
  metrics: BusinessMetrics;
  name: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [question, setQuestion] = useState(""),
    [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement>(null),
    busy = useRef(false),
    mounted = useRef(true),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (messages.length)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);
  async function send(value: string) {
    const text = value.trim();
    if (!text || text.length > 500 || busy.current) return;
    busy.current = true;
    setLoading(true);
    setQuestion("");
    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    try {
      const result = await requestExplanation(
        "chat",
        buildVerifiedContext(metrics, text),
        text,
      );
      if (mounted.current)
        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.text,
            mode: result.mode,
          },
        ]);
    } finally {
      busy.current = false;
      if (mounted.current) {
        setLoading(false);
        input.current?.focus();
      }
    }
  }
  return (
    <div className="chat-layout">
      <section className="panel chat-panel">
        <div className="chat-panel-header">
          <div>
            <RamuMark small />
            <span>
              <strong>RAMU</strong>
              <small>Copilot bisnis Anda</small>
            </span>
          </div>
          <span className="chat-status">
            <span className="status-dot loaded" />
            Siap membantu
          </span>
        </div>
        <div
          className={cn(
            "chat-messages",
            messages.length === 0 && "chat-messages-empty",
          )}
          aria-live="polite"
          aria-relevant="additions text"
        >
          {!messages.length && (
            <div className="chat-welcome">
              <span className="chat-welcome-icon">
                <Sparkles size={31} strokeWidth={1.4} />
              </span>
              <span className="eyebrow">
                MARI MEMBACA CERITA DI BALIK ANGKA
              </span>
              <h2>
                Kenali bisnis Anda
                <br />
                lewat percakapan.
              </h2>
              <p>
                Saya RAMU. Tanyakan tentang penjualan, produk,
                <br className="desktop-break" /> atau peluang dari data bisnis
                Anda.
              </p>
              <div className="question-grid">
                {questions.slice(0, 4).map((q, i) => (
                  <button
                    key={q}
                    disabled={loading}
                    onClick={() => void send(q)}
                  >
                    {i % 2 ? (
                      <MessageCircle size={17} />
                    ) : (
                      <ChartNoAxesCombined size={17} />
                    )}
                    <span>{q}</span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.role}`}>
              {m.role === "assistant" && <RamuMark small />}
              <div className="message-content">
                <span className="message-author">
                  {m.role === "user" ? "Anda" : "RAMU"}
                  {m.mode && (
                    <span className="message-mode">
                      {m.mode === "gemini" ? "Dibantu AI" : "Analisis dasar"}
                    </span>
                  )}
                </span>
                <p>{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <RamuMark small />
              <div className="message-content loading-message">
                <LoaderCircle size={16} className="spin" />
                RAMU sedang menganalisis data...
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        {messages.some((m) => m.mode === "basic") && (
          <div className="chat-fallback-notice">
            RAMU menggunakan analisis dasar karena layanan AI sedang tidak
            tersedia.
          </div>
        )}
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(question);
          }}
        >
          <label htmlFor="question" className="sr-only">
            Pertanyaan untuk RAMU
          </label>
          <textarea
            ref={input}
            id="question"
            placeholder="Apa yang ingin Anda ketahui tentang bisnis Anda?"
            value={question}
            maxLength={500}
            rows={1}
            disabled={loading}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send(question);
              }
            }}
          />
          <button
            type="submit"
            aria-label="Kirim pertanyaan"
            disabled={loading || !question.trim()}
          >
            {loading ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <ArrowUp size={20} />
            )}
          </button>
        </form>
        <div className="chat-disclaimer">
          <span>
            Jawaban berdasarkan data yang tersedia. Periksa kembali sebelum
            mengambil keputusan.
          </span>
          <span>{question.length}/500</span>
        </div>
      </section>
      <aside className="chat-context">
        <section className="panel">
          <span className="eyebrow">KONTEKS PERCAKAPAN</span>
          <h3>
            Bisnis Anda,
            <br />
            lebih dipahami.
          </h3>
          <div className="context-source">
            <span>
              <Check size={14} />
            </span>
            <div>
              <strong>Data bisnis terhubung</strong>
              <small>{name}</small>
            </div>
          </div>
          <div className="context-date">
            <span>Periode analisis</span>
            <strong>
              {formatDate(metrics.period.start)}
              <br />– {formatDate(metrics.period.end)}
            </strong>
          </div>
          <p>
            RAMU membaca ringkasan metrik yang sudah dihitung. File mentah Anda
            tidak dikirim ke AI.
          </p>
        </section>
        <section className="chat-tip">
          <Sparkles size={19} />
          <h4>Mulai dengan rasa ingin tahu.</h4>
          <p>
            Pertanyaan yang spesifik membantu RAMU memberikan jawaban yang lebih
            berguna.
          </p>
          <button disabled={loading} onClick={() => void send(questions[4])}>
            {questions[4]}
            <ArrowUpRight size={15} />
          </button>
        </section>
      </aside>
    </div>
  );
}
