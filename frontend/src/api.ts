import type { PageDetail, PageMeta, PagesPayload } from './types'

async function parseJson<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || r.statusText || String(r.status))
  }
  return r.json() as Promise<T>
}

function normalizePageRow(p: PageMeta): PageMeta {
  const o = (p as { order?: unknown }).order
  const order = typeof o === 'number' && Number.isFinite(o) ? o : 0
  return { ...p, order }
}

export async function fetchPages(): Promise<PagesPayload> {
  const r = await fetch('/pages')
  const raw = await parseJson<PagesPayload>(r)
  return {
    ...raw,
    pages: raw.pages.map(normalizePageRow),
  }
}

export async function fetchPage(id: string): Promise<PageDetail> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}`)
  return parseJson<PageDetail>(r)
}

export async function putPageContent(
  id: string,
  payload: { markdown_body: string; editor_overlay?: string | null },
): Promise<void> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || r.statusText)
  }
}

export async function createPage(body: {
  title: string
  parent?: string
  id?: string
}): Promise<{ id: string }> {
  const r = await fetch('/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: body.title,
      parent: body.parent ?? '',
      ...(body.id !== undefined && body.id !== '' ? { id: body.id } : {}),
    }),
  })
  return parseJson<{ id: string }>(r)
}

export async function patchPageMeta(
  id: string,
  patch: {
    parent?: string
    title?: string
    order?: number
    new_id?: string
  },
): Promise<{ id: string }> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}/meta`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return parseJson<{ id: string }>(r)
}

export async function deletePage(id: string): Promise<void> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) {
    const text = await r.text()
    let message = text || r.statusText || String(r.status)
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (typeof j.detail === 'string') {
        message = j.detail
      }
    } catch {
      /* use raw text */
    }
    throw new Error(message)
  }
}
