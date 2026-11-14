import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";

import {
  OPENER_PALETTE_LABELS,
  OPENER_PALETTES,
  isOpenerPalette,
} from "../lib/openerSidecar";
import type {
  OpenerDocument,
  OpenerHidden,
  OpenerPalette,
} from "../lib/openerSidecar";

function SlidersIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M21 5h-7M10 5H3M21 12h-9M8 12H3M21 19h-5M12 19H3" />
      <path d="M14 3v4M8 10v4M16 17v4" />
    </svg>
  );
}

type Props = {
  ref?: Ref<HTMLElement>;
  title: string;
  version: string;
  authors: string[];
  doc: OpenerDocument;
  onCommitHidden: (hidden: OpenerHidden) => Promise<void>;
  onCommitBackground: (palette: OpenerPalette | null) => Promise<void>;
};

export function TitleOpener({
  ref,
  title,
  version,
  authors,
  doc,
  onCommitHidden,
  onCommitBackground,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) {
      return;
    }
    const onDocumentClick = (e: MouseEvent) => {
      const t = e.target;
      if (el.open && t instanceof Node && !el.contains(t)) {
        el.open = false;
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  async function commit(write: () => Promise<void>, failure: string) {
    setPending(true);
    setError(null);
    try {
      await write();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : failure);
    } finally {
      setPending(false);
    }
  }

  function setHidden(line: keyof OpenerHidden, hidden: boolean) {
    void commit(
      () => onCommitHidden({ ...doc.hidden, [line]: hidden }),
      "Could not save visibility",
    );
  }

  function setBackground(value: string) {
    void commit(
      () => onCommitBackground(isOpenerPalette(value) ? value : null),
      "Could not save background",
    );
  }

  const showVersion = version !== "" && !doc.hidden.version;
  const showAuthors = authors.length > 0 && !doc.hidden.authors;

  return (
    <header
      ref={ref}
      className="wit-chapter-opener wit-chapter-opener--title"
      data-opener-palette={doc.background?.name}
    >
      <div className="wit-opener-menu">
        <details ref={detailsRef} className="wit-app-settings">
          <summary
            className="wit-app-settings-summary"
            aria-label="Heading options"
          >
            <SlidersIcon />
          </summary>
          <div className="wit-app-settings-panel">
            <div className="wit-settings-rows">
              <label className="wit-settings-row">
                <span className="wit-settings-row-label">Background</span>
                <select
                  value={doc.background?.name ?? "none"}
                  disabled={pending}
                  onChange={(e) => setBackground(e.target.value)}
                  aria-label="Heading background"
                >
                  <option value="none">None</option>
                  {OPENER_PALETTES.map((name) => (
                    <option key={name} value={name}>
                      {OPENER_PALETTE_LABELS[name]}
                    </option>
                  ))}
                </select>
              </label>
              {version !== "" ? (
                <label className="wit-settings-row">
                  <span className="wit-settings-row-label">Version</span>
                  <select
                    value={doc.hidden.version ? "hidden" : "visible"}
                    disabled={pending}
                    onChange={(e) =>
                      setHidden("version", e.target.value === "hidden")
                    }
                    aria-label="Version line"
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              ) : null}
              {authors.length > 0 ? (
                <label className="wit-settings-row">
                  <span className="wit-settings-row-label">Authors</span>
                  <select
                    value={doc.hidden.authors ? "hidden" : "visible"}
                    disabled={pending}
                    onChange={(e) =>
                      setHidden("authors", e.target.value === "hidden")
                    }
                    aria-label="Authors line"
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              ) : null}
              {error ? (
                <p className="wit-opener-menu-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </details>
      </div>
      {title !== "" ? (
        <span className="wit-chapter-opener-title">{title}</span>
      ) : null}
      {showVersion ? (
        <span className="wit-chapter-opener-meta">{version}</span>
      ) : null}
      {showAuthors ? (
        <span className="wit-chapter-opener-meta">{authors.join(", ")}</span>
      ) : null}
    </header>
  );
}
