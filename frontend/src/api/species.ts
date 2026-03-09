import { deleteRequest, getJson, patchJson, postJson } from './http'
import { clampQueryLimit } from './limits'
import type { ListResponse, Species, SpeciesCreate, SpeciesListItem } from '../types/models'

export function listSpecies(limit = 50, offset = 0): Promise<ListResponse<SpeciesListItem>> {
  return getJson<ListResponse<SpeciesListItem>>(`/species?limit=${clampQueryLimit(limit)}&offset=${offset}`)
}

export function querySpecies(params: {
  nameContains?: string
  commonNameContains?: string
  parentSpeciesId?: number
  limit?: number
  offset?: number
}): Promise<Species[]> {
  const query = new URLSearchParams()
  if (params.nameContains) query.set('name_contains', params.nameContains)
  if (params.commonNameContains) query.set('common_name_contains', params.commonNameContains)
  if (params.parentSpeciesId !== undefined) query.set('parent_species_id', String(params.parentSpeciesId))
  query.set('limit', String(clampQueryLimit(params.limit)))
  query.set('offset', String(params.offset ?? 0))

  return getJson<Species[]>(`/species/query?${query.toString()}`)
}

export function getSpeciesById(id: number): Promise<Species> {
  return getJson<Species>(`/species/${id}`)
}

export function createSpecies(payload: SpeciesCreate): Promise<Species> {
  return postJson<Species, SpeciesCreate>('/species', payload)
}

export function updateSpecies(id: number, payload: Partial<SpeciesCreate>): Promise<Species> {
  return patchJson<Species, Partial<SpeciesCreate>>(`/species/${id}`, payload)
}

export function deleteSpecies(id: number): Promise<void> {
  return deleteRequest(`/species/${id}`)
}
