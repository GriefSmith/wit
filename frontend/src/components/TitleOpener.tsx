import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, Ref } from "react";

import {
  OPENER_PALETTE_LABELS,
  OPENER_PALETTES,
  emptyAffix,
  formatAffixed,
  labelsToStored,
  withAuthorAffix,
  withVersionAffix,
} from "../lib/openerSidecar";
import type {
  OpenerDocument,
  OpenerPalette,
  StoredLabels,
} from "../lib/openerSidecar";

type Popover = { kind: "version" } | { kind: "author"; name: string };

type Props = {
  ref?: Ref<HTMLElement>;
  title: string;
  version: string;
  authors: string[];
  doc: OpenerDocument;
  onCommitLabels: (labels: StoredLabels) => Promise<void>;
  onCommitBackground: (palette: OpenerPalette | null) => Promise<void>;
};

export function TitleOpener({
  ref,
  title,
  version,
  authors,
  doc,
  onCommitLabels,
  onCommitBackground,
}: Props) {
  const [popover, setPopover] = useState<Popover | null>(null);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLFormElement | null>(null);
  const beforeId = useId();
  const afterId = useId();
  const valueText = popover?.kind === "author" ? popover.name : version;

  function openPopover(next: Popover, affixBefore: string, affixAfter: string) {
    if (pending) {
      return;
    }
    setBefore(affixBefore);
    setAfter(affixAfter);
    setError(null);
    setPopover(next);
  }

  async function commitLabels() {
    if (!popover || pending) {
      return;
    }
    const next = { before, after };
    const labels =
      popover.kind === "version"
        ? withVersionAffix(doc, authors, next)
        : withAuthorAffix(doc, authors, popover.name, next);
    const stored = labelsToStored(labels);
    const current = labelsToStored(
      popover.kind === "version"
        ? withVersionAffix(
            doc,
            authors,
            doc.labels.version ?? emptyAffix(),
          )
        : withAuthorAffix(
            doc,
            authors,
            popover.name,
            doc.labels.authors[popover.name] ?? emptyAffix(),
          ),
    );
    if (JSON.stringify(stored) === JSON.stringify(current)) {
      setPopover(null);
      setError(null);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCommitLabels(stored);
      setPopover(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not save label");
    } finally {
      setPending(false);
    }
  }

  const commitOnOutsidePointer = useEffectEvent(() => {
    void commitLabels();
  });

  useEffect(() => {
    if (!popover) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || popoverRef.current?.contains(target)) {
        return;
      }
      commitOnOutsidePointer();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [popover]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void commitLabels();
  }

  function onKeyDown(event: KeyboardEvent) {
    // Two text fields and no submit button: the browser does not submit on Enter.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void commitLabels();
      return;
    }
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      event.stopPropagation();
      setPopover(null);
      setError(null);
    }
  }

  async function choosePalette(palette: OpenerPalette | null) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCommitBackground(palette);
      setMenuOpen(false);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Could not save background",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <header
      ref={ref}
      className="wit-chapter-opener wit-chapter-opener--title"
      data-opener-palette={doc.background?.name}
    >
      <div
        className="wit-opener-background"
        data-open={menuOpen ? "true" : undefined}
      >
        <button
          type="button"
          className="wit-opener-background-button"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Background
        </button>
        {menuOpen ? (
          <ul className="wit-opener-background-menu" role="listbox" aria-label="Heading background">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={doc.background === null}
                onClick={() => void choosePalette(null)}
              >
                None
              </button>
            </li>
            {OPENER_PALETTES.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={doc.background?.name === name}
                  onClick={() => void choosePalette(name)}
                >
                  {OPENER_PALETTE_LABELS[name]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {title !== "" ? (
        <span className="wit-chapter-opener-title">{title}</span>
      ) : null}
      {version !== "" ? (
        <span className="wit-chapter-opener-meta">
          <span
            className="wit-opener-value"
            onDoubleClick={() =>
              openPopover(
                { kind: "version" },
                doc.labels.version?.before ?? "",
                doc.labels.version?.after ?? "",
              )
            }
          >
            {formatAffixed(version, doc.labels.version)}
          </span>
        </span>
      ) : null}
      {authors.length > 0 ? (
        <span className="wit-chapter-opener-meta">
          {authors.map((name, index) => (
            <span key={`${name}-${index}`}>
              {index > 0 ? ", " : null}
              <span
                className="wit-opener-value"
                onDoubleClick={() =>
                  openPopover(
                    { kind: "author", name },
                    doc.labels.authors[name]?.before ?? "",
                    doc.labels.authors[name]?.after ?? "",
                  )
                }
              >
                {formatAffixed(name, doc.labels.authors[name] ?? null)}
              </span>
            </span>
          ))}
        </span>
      ) : null}
      {popover ? (
        <form
          ref={popoverRef}
          className="wit-opener-affix"
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
        >
          <label htmlFor={beforeId}>Before</label>
          <input
            id={beforeId}
            autoFocus
            maxLength={120}
            value={before}
            disabled={pending}
            onChange={(event) => setBefore(event.target.value)}
          />
          <span className="wit-opener-affix-value">{valueText}</span>
          <label htmlFor={afterId}>After</label>
          <input
            id={afterId}
            maxLength={120}
            value={after}
            disabled={pending}
            onChange={(event) => setAfter(event.target.value)}
          />
          {error ? (
            <p className="wit-opener-affix-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      {!popover && error ? (
        <p className="wit-opener-affix-error" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  );
}
