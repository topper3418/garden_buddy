import { deleteRequest, getJson, patchJson, postForm } from './http'
import type { ListResponse, Media, MediaListItem } from '../types/models'

export function listMedia(limit = 50, offset = 0, includeFilePath = true): Promise<ListResponse<MediaListItem>> {
  return getJson<ListResponse<MediaListItem>>(
    `/media?limit=${limit}&offset=${offset}&include_file_path=${String(includeFilePath)}`,
  )
}

export function queryMedia(params: {
  titleContains?: string
  mimeType?: string
  minSize?: number
  maxSize?: number
  limit?: number
  offset?: number
  includeFilePath?: boolean
}): Promise<Media[]> {
  const query = new URLSearchParams()
  if (params.titleContains) query.set('title_contains', params.titleContains)
  if (params.mimeType) query.set('mime_type', params.mimeType)
  if (params.minSize !== undefined) query.set('min_size', String(params.minSize))
  if (params.maxSize !== undefined) query.set('max_size', String(params.maxSize))
  query.set('limit', String(params.limit ?? 50))
  query.set('offset', String(params.offset ?? 0))
  query.set('include_file_path', String(params.includeFilePath ?? true))

  return getJson<Media[]>(`/media/query?${query.toString()}`)
}

export function getMediaById(id: number, includeFilePath = true): Promise<Media> {
  return getJson<Media>(`/media/${id}?include_file_path=${String(includeFilePath)}`)
}

export function uploadMedia(file: File, title?: string): Promise<Media> {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  return postForm<Media>('/media', form)
}

export function updateMedia(id: number, payload: { title?: string | null; mime_type?: string | null; size?: number | null }): Promise<Media> {
  return patchJson<Media, { title?: string | null; mime_type?: string | null; size?: number | null }>(`/media/${id}`, payload)
}

export function deleteMedia(id: number): Promise<void> {
  return deleteRequest(`/media/${id}`)
}

export function mediaFileUrl(id: number): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  return `${base}/media/${id}/file`
}
