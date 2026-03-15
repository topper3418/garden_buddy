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
  plant_count: number
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
  plant_count: number
}

export type Tag = {
  id: number
  name: string
  notes?: string | null
  main_media_id?: number | null
  created_at: string
}

export type TagCreate = {
  name: string
  notes?: string | null
  main_media_id?: number | null
}

export type TagListItem = {
  id: number
  name: string
  main_media_id?: number | null
}

export type Plant = {
  id: number
  name: string
  notes?: string | null
  species_id?: number | null
  tag_ids: number[]
  main_media_id?: number | null
  species?: Species | null
  tags: Tag[]
  created_at: string
}

export type PlantCreate = {
  name: string
  notes?: string | null
  species_id?: number | null
  tag_ids: number[]
  main_media_id?: number | null
}

export type PlantListItem = {
  id: number
  name: string
  species_id?: number | null
  main_media_id?: number | null
}

export type Media = {
  id: number
  filename: string
  mime_type: string
  size: number
  title?: string | null
  plant_id?: number | null
  tag_id?: number | null
  uploaded_at: string
  file_path?: string | null
}

export type MediaCreate = {
  filename: string
  mime_type: string
  size: number
  title?: string | null
  plant_id?: number | null
  tag_id?: number | null
}

export type MediaListItem = {
  id: number
  filename: string
  mime_type: string
  title?: string | null
  plant_id?: number | null
  tag_id?: number | null
  file_path?: string | null
}
