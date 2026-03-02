import { deleteRequest, getJson, patchJson, postJson, putJson } from './http'
import type { ListResponse, Plant, PlantCreate, PlantListItem } from '../types/models'

export function listPlants(limit = 50, offset = 0): Promise<ListResponse<PlantListItem>> {
  return getJson<ListResponse<PlantListItem>>(`/plants?limit=${limit}&offset=${offset}`)
}

export function queryPlants(params: {
  nameContains?: string
  speciesId?: number
  plantTypeId?: number
  limit?: number
  offset?: number
}): Promise<Plant[]> {
  const query = new URLSearchParams()
  if (params.nameContains) query.set('name_contains', params.nameContains)
  if (params.speciesId !== undefined) query.set('species_id', String(params.speciesId))
  if (params.plantTypeId !== undefined) query.set('plant_type_id', String(params.plantTypeId))
  query.set('limit', String(params.limit ?? 50))
  query.set('offset', String(params.offset ?? 0))

  return getJson<Plant[]>(`/plants/query?${query.toString()}`)
}

export function getPlantById(id: number): Promise<Plant> {
  return getJson<Plant>(`/plants/${id}`)
}

export function createPlant(payload: PlantCreate): Promise<Plant> {
  return postJson<Plant, PlantCreate>('/plants', payload)
}

export function updatePlant(id: number, payload: Partial<PlantCreate>): Promise<Plant> {
  return patchJson<Plant, Partial<PlantCreate>>(`/plants/${id}`, payload)
}

export function addTypeToPlant(plantId: number, typeId: number): Promise<Plant> {
  return putJson<Plant>(`/plants/${plantId}/types/${typeId}`)
}

export function removeTypeFromPlant(plantId: number, typeId: number): Promise<Plant> {
  return deleteRequest(`/plants/${plantId}/types/${typeId}`).then(() => getPlantById(plantId))
}

export function deletePlant(id: number): Promise<void> {
  return deleteRequest(`/plants/${id}`)
}
