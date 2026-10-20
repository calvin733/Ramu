"use client";
import { useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { MappingReview } from "@/components/mapping-review";
import { useContentNavigation } from "@/components/hooks/use-content-navigation";
import type { ImportDocument } from "@/lib/mapping";
import type { ImportAssessment, ImportIssue } from "@/lib/mapping/automatic";

export function ImportClarification({
  document,
  assessment,
  busy,
  headingRef,
  onAnswer,
  onChange,
  onConfirm,
  onCancel,
}: {
  document: ImportDocument;
  assessment: Exclude<ImportAssessment, { kind: "ready" }> | null;
  busy: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onAnswer: (issue: ImportIssue, value: string) => void;
  onChange: (document: ImportDocument) => void;
  onConfirm: (complete: boolean) => void;
  onCancel: () => void;
}) {
  const manualHeading = useRef<HTMLDivElement>(null);
  const navigateTo = useContentNavigation();
  return (
    <section
      className="panel import-clarification"
      aria-labelledby="import-clarification-title"
      aria-busy={busy}
    >
      <h2
        id="import-clarification-title"
        ref={headingRef}
        tabIndex={-1}
        className="content-navigation-target"
      >
        {!assessment
          ? "Periksa pilihan kolom Anda."
          : assessment.kind === "clarify"
            ? "Kami perlu memastikan satu hal tentang file Anda."
            : "Ada bagian file yang perlu diperbaiki."}
      </h2>
      <p className="supporting">
        {document.name} · File tetap tersedia di perangkat Anda.
      </p>
      {assessment?.kind === "clarify" ? (
        <Question
          key={assessment.issue.id}
          issue={assessment.issue}
          busy={busy}
          onAnswer={onAnswer}
        />
      ) : assessment?.kind === "invalid" ? (
        <p role="alert">{assessment.message}</p>
      ) : null}
      <details
        className="manual-import-disclosure"
        open={assessment === null ? true : undefined}
        onToggle={(e) => {
          if (e.currentTarget.open) navigateTo(manualHeading);
        }}
      >
        <summary>Atur kolom secara manual</summary>
        <div
          ref={manualHeading}
          role="region"
          aria-label="Pilihan kolom manual"
          tabIndex={-1}
          className="content-navigation-target"
        >
          <MappingReview
            document={document}
            onChange={onChange}
            onConfirm={onConfirm}
            onCancel={onCancel}
            disabled={busy}
          />
        </div>
      </details>
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Batal memproses file
      </Button>
    </section>
  );
}
function Question({
  issue,
  busy,
  onAnswer,
}: {
  issue: ImportIssue;
  busy: boolean;
  onAnswer: (issue: ImportIssue, value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="import-question"
      onSubmit={(e) => {
        e.preventDefault();
        if (value && !busy) onAnswer(issue, value);
      }}
    >
      <label htmlFor="import-answer">{issue.question}</label>
      {issue.detail && (
        <p id="import-question-detail" className="supporting">
          {issue.detail}
        </p>
      )}
      <select
        id="import-answer"
        value={value}
        required
        disabled={busy}
        aria-describedby={issue.detail ? "import-question-detail" : undefined}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">Pilih yang sesuai</option>
        {issue.options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={!value || busy}>
        Lanjutkan
      </Button>
    </form>
  );
}
