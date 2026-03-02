import { deleteRequest, getJson, patchJson, postJson } from './http'
import type { ListResponse, PlantType, PlantTypeCreate, PlantTypeListItem } from '../types/models'

export function listPlantTypes(limit = 50, offset = 0): Promise<ListResponse<PlantTypeListItem>> {
  return getJson<ListResponse<PlantTypeListItem>>(`/plant-types?limit=${limit}&offset=${offset}`)
}

export function queryPlantTypes(params: {
  nameContains?: string
  notesContains?: string
  limit?: number
  offset?: number
}): Promise<PlantType[]> {
  const query = new URLSearchParams()
  if (params.nameContains) query.set('name_contains', params.nameContains)
  if (params.notesContains) query.set('notes_contains', params.notesContains)
  query.set('limit', String(params.limit ?? 50))
  query.set('offset', String(params.offset ?? 0))

  return getJson<PlantType[]>(`/plant-types/query?${query.toString()}`)
}

export function getPlantTypeById(id: number): Promise<PlantType> {
  return getJson<PlantType>(`/plant-types/${id}`)
}

export function createPlantType(payload: PlantTypeCreate): Promise<PlantType> {
  return postJson<PlantType, PlantTypeCreate>('/plant-types', payload)
}

export function updatePlantType(id: number, payload: Partial<PlantTypeCreate>): Promise<PlantType> {
  return patchJson<PlantType, Partial<PlantTypeCreate>>(`/plant-types/${id}`, payload)
}

export function deletePlantType(id: number): Promise<void> {
  return deleteRequest(`/plant-types/${id}`)
}
