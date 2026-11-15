import { useEffect, useRef, type RefObject } from "react";

import { SidebarTree } from "./SidebarTree";
import type { PageMeta } from "../types";

type Props = {
  pages: PageMeta[];
  selectedId: string | null;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onOpen: (id: string) => boolean | void;
  onClose: () => void;
};

export function CrumbJumpMenu({
  pages,
  selectedId,
  anchorRef,
  onOpen,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [anchorRef, onClose]);

  return (
    <div className="wit-crumb-menu" ref={menuRef} role="menu" aria-label="Pages">
      <SidebarTree
        pages={pages}
        selectedId={selectedId}
        interaction="jump"
        onSelect={(id) => onOpen(id)}
        onStructureChange={() => {}}
      />
    </div>
  );
}
