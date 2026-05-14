import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree, type NodeRendererProps, type TreeApi } from 'react-arborist'

import { createPage, deletePage, patchPageMeta } from '../api'
import { computeMovePatches } from '../lib/applyTreeMove'
import { flatToTree, slugifyPageId } from '../lib/tree'
import type { PageMeta, PageTreeNode } from '../types'

function TreeChevron() {
  return (
    <svg
      className="wit-tree-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M4.5 2.5 L8.5 6 L4.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type RenameFormProps = {
  meta: PageMeta
  onCancel: () => void
  onSave: (patch: { title?: string; new_id?: string }) => Promise<void>
}

function RenamePageForm({ meta, onCancel, onSave }: RenameFormProps) {
  const [title, setTitle] = useState(meta.title)
  const [idRaw, setIdRaw] = useState(meta.id)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(meta.title)
    setIdRaw(meta.id)
    setLocalError(null)
  }, [meta])

  const submit = async () => {
    const t = title.trim()
    if (!t) {
      setLocalError('Title is required.')
      return
    }
    const nextTitle = t
    const slug = slugifyPageId(idRaw)
    const patch: { title?: string; new_id?: string } = {}
    if (nextTitle !== meta.title) {
      patch.title = nextTitle
    }
    if (slug !== meta.id) {
      patch.new_id = idRaw.trim()
    }
    if (patch.title === undefined && patch.new_id === undefined) {
      onCancel()
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onSave(patch)
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="wit-rename-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {localError ? (
        <p className="wit-sidebar-create-error" role="alert">
          {localError}
        </p>
      ) : null}
      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          disabled={busy}
          aria-label="Page title"
        />
      </label>
      <label>
        Page id
        <input
          type="text"
          value={idRaw}
          onChange={(e) => setIdRaw(e.target.value)}
          autoComplete="off"
          disabled={busy}
          aria-label="Page id (filename slug)"
        />
      </label>
      <p className="wit-muted wit-rename-hint">
        The id sets the markdown filename and links from parent pages. It is normalized (lowercase,
        hyphens).
      </p>
      <div className="wit-rename-actions">
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

type Props = {
  pages: PageMeta[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStructureChange: () => void | Promise<void>
  onPageCreated?: (id: string) => void
  /** Called when a page id changes (slug rename); previous selection should update. */
  onPageRenamed?: (previousId: string, nextId: string) => void
  /** Called after a page file was removed from disk. */
  onPageDeleted?: (deletedId: string) => void
}

export function SidebarTree({
  pages,
  selectedId,
  onSelect,
  onStructureChange,
  onPageCreated,
  onPageRenamed,
  onPageDeleted,
}: Props) {
  const data = useMemo(() => flatToTree(pages), [pages])
  const treeViewportRef = useRef<HTMLDivElement>(null)
  const [treeViewportH, setTreeViewportH] = useState(320)
  const [createError, setCreateError] = useState<string | null>(null)
  const [renameForId, setRenameForId] = useState<string | null>(null)
  const [deleteForId, setDeleteForId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const renameMeta = renameForId
    ? pages.find((p) => p.id === renameForId)
    : undefined

  const deleteMeta = deleteForId
    ? pages.find((p) => p.id === deleteForId)
    : undefined

  useEffect(() => {
    if (renameForId && !pages.some((p) => p.id === renameForId)) {
      setRenameForId(null)
    }
  }, [renameForId, pages])

  useEffect(() => {
    if (deleteForId && !pages.some((p) => p.id === deleteForId)) {
      setDeleteForId(null)
    }
  }, [deleteForId, pages])

  useEffect(() => {
    const el = treeViewportRef.current
    if (!el) {
      return
    }
    const apply = (h: number) => {
      if (h >= 1) {
        setTreeViewportH(Math.max(160, Math.floor(h)))
      }
    }
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.height ?? 0)
    })
    ro.observe(el)
    requestAnimationFrame(() => apply(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [])

  const handleCreate = useCallback(
    async (
      parent: string,
      opts?: { tree?: TreeApi<PageTreeNode>; expandParentId?: string },
    ) => {
      setCreateError(null)
      try {
        const { id } = await createPage({ title: 'Untitled', parent })
        await Promise.resolve(onStructureChange())
        onPageCreated?.(id)
        if (opts?.tree && opts.expandParentId) {
          opts.tree.open(opts.expandParentId)
        }
      } catch (e: unknown) {
        setCreateError(e instanceof Error ? e.message : 'Could not create page')
      }
    },
    [onPageCreated, onStructureChange],
  )

  const saveRename = useCallback(
    async (pageId: string, patch: { title?: string; new_id?: string }) => {
      const { id: nextId } = await patchPageMeta(pageId, patch)
      await Promise.resolve(onStructureChange())
      if (nextId !== pageId) {
        onPageRenamed?.(pageId, nextId)
      }
      setRenameForId(null)
    },
    [onStructureChange, onPageRenamed],
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteMeta) {
      return
    }
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await deletePage(deleteMeta.id)
      await Promise.resolve(onStructureChange())
      onPageDeleted?.(deleteMeta.id)
      setDeleteForId(null)
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete page')
    } finally {
      setDeleteBusy(false)
    }
  }, [deleteMeta, onPageDeleted, onStructureChange])

  const Row = useCallback(
    function Row(props: NodeRendererProps<PageTreeNode>) {
      const { node, style, dragHandle, tree } = props
      const label = node.data.name
      const hasChildren =
        Array.isArray(node.children) && node.children.length > 0

      return (
        <div
          style={style}
          ref={dragHandle}
          className="wit-tree-row"
          data-selected={node.isSelected ? 'true' : 'false'}
        >
          {hasChildren ? (
            <button
              type="button"
              className="wit-tree-toggle"
              data-open={node.isOpen ? 'true' : 'false'}
              onClick={() => node.toggle()}
              aria-expanded={node.isOpen}
              aria-label={
                node.isOpen ? `Collapse “${label}”` : `Expand “${label}”`
              }
            >
              <TreeChevron />
            </button>
          ) : (
            <span className="wit-tree-toggle-spacer" aria-hidden />
          )}
          <span
            className="wit-tree-row-label"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setRenameForId(node.id)
            }}
          >
            {label}
          </span>
          <button
            type="button"
            className="wit-tree-rename"
            title={`Rename “${label}”`}
            aria-label={`Rename “${label}”`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setRenameForId(node.id)
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className="wit-tree-add-child"
            title={`New page under “${label}”`}
            aria-label={`New page under “${label}”`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              void handleCreate(node.id, { tree, expandParentId: node.id })
            }}
          >
            +
          </button>
          <button
            type="button"
            className="wit-tree-delete"
            title={`Delete “${label}”`}
            aria-label={`Delete “${label}”`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setDeleteError(null)
              setDeleteForId(node.id)
            }}
          >
            ⌫
          </button>
        </div>
      )
    },
    [handleCreate],
  )

  return (
    <div className="wit-tree-wrap">
      <dialog
        className="wit-rename-dialog"
        open={Boolean(renameMeta)}
        onCancel={(e) => {
          e.preventDefault()
          setRenameForId(null)
        }}
      >
        {renameMeta ? (
          <>
            <header>
              <strong>Rename page</strong>
            </header>
            <RenamePageForm
              meta={renameMeta}
              onCancel={() => setRenameForId(null)}
              onSave={(patch) => saveRename(renameMeta.id, patch)}
            />
          </>
        ) : null}
      </dialog>

      <dialog
        className="wit-rename-dialog wit-delete-dialog"
        open={Boolean(deleteMeta)}
        aria-labelledby="wit-delete-title"
        aria-describedby="wit-delete-desc"
        onCancel={(e) => {
          e.preventDefault()
          if (!deleteBusy) {
            setDeleteForId(null)
            setDeleteError(null)
          }
        }}
      >
        {deleteMeta ? (
          <>
            <header className="wit-delete-header">
              <span className="wit-delete-header-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4 20 19H4L12 4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 10v5M12 17h.01"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <strong id="wit-delete-title">Delete this page</strong>
            </header>
            <div id="wit-delete-desc" className="wit-delete-stack">
              <div className="wit-delete-summary">
                <p className="wit-delete-lead">
                  You're about to delete <strong>{deleteMeta.title}</strong> and erase its markdown
                  file from disk.
                </p>
                <div className="wit-delete-file-card">
                  <span className="wit-delete-file-label">Markdown file</span>
                  <code className="wit-delete-id">{deleteMeta.id}.md</code>
                </div>
              </div>
              <div className="wit-delete-consequences">
                <span className="wit-delete-consequences-label">Before you continue</span>
                <ul>
                  <li>You can't undo this.</li>
                  <li>If this page has subpages, delete or move them first.</li>
                </ul>
              </div>
              {deleteError ? (
                <p className="wit-delete-error" role="alert">
                  {deleteError}
                </p>
              ) : null}
            </div>
            <div className="wit-rename-actions wit-delete-actions">
              <button
                type="button"
                className="secondary wit-delete-cancel"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteForId(null)
                  setDeleteError(null)
                }}
              >
                Keep page
              </button>
              <button
                type="button"
                className="wit-delete-confirm"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </>
        ) : null}
      </dialog>

      <div className="wit-sidebar-tree-actions">
        <button type="button" onClick={() => void handleCreate('')}>
          New page
        </button>
      </div>
      {createError ? (
        <p className="wit-sidebar-create-error" role="alert">
          {createError}
        </p>
      ) : null}
      <div className="wit-tree-viewport" ref={treeViewportRef}>
        <Tree<PageTreeNode>
          data={data}
          width="100%"
          height={treeViewportH}
          selection={selectedId ?? undefined}
          openByDefault
          onSelect={(nodes) => {
            const id = nodes[0]?.id
            if (id) {
              onSelect(id)
            }
          }}
          onMove={async ({ dragIds, parentId, index }) => {
            const patches = computeMovePatches(pages, dragIds, parentId, index)
            if (patches === null) {
              throw new Error('Cannot move a page under its own descendant.')
            }
            for (const { id, parent, order } of patches) {
              await patchPageMeta(id, { parent, order })
            }
            onStructureChange()
          }}
        >
          {Row}
        </Tree>
      </div>
    </div>
  )
}
