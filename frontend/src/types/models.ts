export type ListResponse<T> = {
  items: T[]
  limit: number
  offset: number
}

export type Species = {
  id: number
  name: string
  common_name?: string | null
  notes?: string | null
  parent_species_id?: number | null
  created_at: string
}

export type SpeciesCreate = {
  name: string
  common_name?: string | null
  notes?: string | null
  parent_species_id?: number | null
}

export type SpeciesListItem = {
  id: number
  name: string
  common_name?: string | null
}

export type PlantType = {
  id: number
  name: string
  notes?: string | null
  created_at: string
}

export type PlantTypeCreate = {
  name: string
  notes?: string | null
}

export type PlantTypeListItem = {
  id: number
  name: string
}

export type Plant = {
  id: number
  name: string
  notes?: string | null
  species_id?: number | null
  plant_type_ids: number[]
  species?: Species | null
  plant_types: PlantType[]
  created_at: string
}

export type PlantCreate = {
  name: string
  notes?: string | null
  species_id?: number | null
  plant_type_ids: number[]
}

export type PlantListItem = {
  id: number
  name: string
  species_id?: number | null
}

export type Media = {
  id: number
  filename: string
  mime_type: string
  size: number
  title?: string | null
  uploaded_at: string
  file_path?: string | null
}

export type MediaCreate = {
  filename: string
  mime_type: string
  size: number
  title?: string | null
}

export type MediaListItem = {
  id: number
  filename: string
  mime_type: string
  title?: string | null
  file_path?: string | null
}
