import { PageSearch } from "./PageSearch";
import { SidebarTree } from "./SidebarTree";
import type { PageMeta } from "../types";

type Props = {
  pages: PageMeta[];
  selectedId: string | null;
  hideUi: boolean;
  unsavedPageId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onStructureChange: () => void | Promise<void>;
  onPageCreated: (id: string) => void;
  onPageRenamed: (previousId: string, nextId: string) => void;
  onPageDeleted: (deletedId: string) => void;
};

export function ColumnTree({
  pages,
  selectedId,
  hideUi,
  unsavedPageId,
  onSelect,
  onOpen,
  onStructureChange,
  onPageCreated,
  onPageRenamed,
  onPageDeleted,
}: Props) {
  return (
    <div className="wit-column-tree">
      <PageSearch pages={pages} onSelect={onSelect} hideUi={hideUi} />
      <SidebarTree
        pages={pages}
        selectedId={selectedId}
        interaction="manage"
        onSelect={onSelect}
        onOpen={onOpen}
        onStructureChange={onStructureChange}
        onPageCreated={onPageCreated}
        onPageRenamed={onPageRenamed}
        onPageDeleted={onPageDeleted}
        unsavedPageId={unsavedPageId}
      />
    </div>
  );
}
