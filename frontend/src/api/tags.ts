import { deleteRequest, getJson, patchJson, postJson } from './http'
import { clampQueryLimit } from './limits'
import type { ListResponse, Tag, TagCreate, TagListItem } from '../types/models'

export function listTags(limit = 50, offset = 0): Promise<ListResponse<TagListItem>> {
  return getJson<ListResponse<TagListItem>>(`/tags?limit=${clampQueryLimit(limit)}&offset=${offset}`)
}

export function queryTags(params: {
  nameContains?: string
  notesContains?: string
  limit?: number
  offset?: number
}): Promise<Tag[]> {
  const query = new URLSearchParams()
  if (params.nameContains) query.set('name_contains', params.nameContains)
  if (params.notesContains) query.set('notes_contains', params.notesContains)
  query.set('limit', String(clampQueryLimit(params.limit)))
  query.set('offset', String(params.offset ?? 0))

  return getJson<Tag[]>(`/tags/query?${query.toString()}`)
}

export function getTagById(id: number): Promise<Tag> {
  return getJson<Tag>(`/tags/${id}`)
}

export function createTag(payload: TagCreate): Promise<Tag> {
  return postJson<Tag, TagCreate>('/tags', payload)
}

export function updateTag(id: number, payload: Partial<TagCreate>): Promise<Tag> {
  return patchJson<Tag, Partial<TagCreate>>(`/tags/${id}`, payload)
}

export function deleteTag(id: number): Promise<void> {
  return deleteRequest(`/tags/${id}`)
}
