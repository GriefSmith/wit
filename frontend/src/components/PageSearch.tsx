import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { createPagesFuse } from "../lib/search";
import type { PageMeta } from "../types";

type Props = {
  pages: PageMeta[];
  onSelect: (pageId: string) => void;
};

function isAppleModKey(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function PageSearch({ pages, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => createPagesFuse(pages), [pages]);

  const hits = useMemo(() => {
    const q = deferredQuery.trim();
    if (!q) {
      return null;
    }
    return fuse.search(q).map((r) => r.item as PageMeta);
  }, [deferredQuery, fuse]);

  const showResults = open && hits !== null;

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);

  const choose = (id: string) => {
    onSelect(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
      e.preventDefault();
      return;
    }
    if (!hits || hits.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % hits.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
      return;
    }
    if (e.key === "Enter") {
      const hit = hits[activeIndex] ?? hits[0];
      if (hit) {
        e.preventDefault();
        choose(hit.id);
      }
    }
  };

  const shortcut = isAppleModKey() ? "⌘K" : "Ctrl+K";

  return (
    <div className="wit-page-search" ref={wrapRef}>
      <label className="wit-page-search-label">
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search pages"
          aria-label="Search pages"
          aria-expanded={showResults}
          aria-controls="wit-page-search-results"
          aria-autocomplete="list"
          autoComplete="off"
          className="wit-page-search-input"
        />
        {query ? null : (
          <kbd className="wit-page-search-kbd">{shortcut}</kbd>
        )}
      </label>
      {showResults ? (
        <ul
          id="wit-page-search-results"
          className="wit-page-search-results"
          role="listbox"
          aria-label="Search results"
        >
          {hits.length === 0 ? (
            <li className="wit-page-search-empty" role="presentation">
              No matches
            </li>
          ) : (
            hits.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={
                    i === activeIndex
                      ? "wit-page-search-hit wit-page-search-hit--active"
                      : "wit-page-search-hit"
                  }
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(p.id)}
                >
                  <span className="wit-page-search-hit-title">{p.title}</span>
                  {p.tags.length > 0 ? (
                    <span className="wit-page-search-hit-meta">
                      {p.tags.join(", ")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
