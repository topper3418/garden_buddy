import { buildApiUrl, deleteRequest, getJson, patchJson, postForm } from './http'
import { clampQueryLimit } from './limits'
import type { ListResponse, Media, MediaListItem } from '../types/models'

export function listMedia(limit = 50, offset = 0, includeFilePath = true): Promise<ListResponse<MediaListItem>> {
  return getJson<ListResponse<MediaListItem>>(
    `/media?limit=${clampQueryLimit(limit)}&offset=${offset}&include_file_path=${String(includeFilePath)}`,
  )
}

export function queryMedia(params: {
  nameContains?: string
  speciesIds?: number[]
  tagId?: number
  titleContains?: string
  mimeType?: string
  plantId?: number
  minSize?: number
  maxSize?: number
  limit?: number
  offset?: number
  includeFilePath?: boolean
}): Promise<Media[]> {
  const query = new URLSearchParams()
  if (params.nameContains) query.set('name_contains', params.nameContains)
  if (params.speciesIds && params.speciesIds.length > 0) {
    for (const speciesId of params.speciesIds) {
      query.append('species_ids', String(speciesId))
    }
  }
  if (params.tagId !== undefined) query.set('tag_id', String(params.tagId))
  if (params.titleContains) query.set('title_contains', params.titleContains)
  if (params.mimeType) query.set('mime_type', params.mimeType)
  if (params.plantId !== undefined) query.set('plant_id', String(params.plantId))
  if (params.minSize !== undefined) query.set('min_size', String(params.minSize))
  if (params.maxSize !== undefined) query.set('max_size', String(params.maxSize))
  query.set('limit', String(clampQueryLimit(params.limit)))
  query.set('offset', String(params.offset ?? 0))
  query.set('include_file_path', String(params.includeFilePath ?? true))

  return getJson<Media[]>(`/media/query?${query.toString()}`)
}

export function getMediaById(id: number, includeFilePath = true): Promise<Media> {
  return getJson<Media>(`/media/${id}?include_file_path=${String(includeFilePath)}`)
}

export function uploadMedia(file: File, title?: string, plantId?: number, tagId?: number): Promise<Media> {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  if (plantId !== undefined) form.append('plant_id', String(plantId))
  if (tagId !== undefined) form.append('tag_id', String(tagId))
  return postForm<Media>('/media', form)
}

export function updateMedia(id: number, payload: { title?: string | null; mime_type?: string | null; size?: number | null; plant_id?: number | null; tag_id?: number | null }): Promise<Media> {
  return patchJson<Media, { title?: string | null; mime_type?: string | null; size?: number | null; plant_id?: number | null; tag_id?: number | null }>(`/media/${id}`, payload)
}

export function deleteMedia(id: number): Promise<void> {
  return deleteRequest(`/media/${id}`)
}

export function mediaFileUrl(id: number): string {
  return buildApiUrl(`/media/${id}/file`)
}
