import { postJson } from './http'

export type SpeciesDraftResponse = {
  name: string
  common_name?: string | null
  notes: string
}

export type AIQuestionResponse = {
  answer_markdown: string
  suggested_note_update_markdown?: string | null
}

export function generateSpeciesDraft(officialName: string): Promise<SpeciesDraftResponse> {
  return postJson<SpeciesDraftResponse, { official_name: string }>('/ai/species/draft', {
    official_name: officialName,
  })
}

export function askPlantQuestion(plantId: number, question: string): Promise<AIQuestionResponse> {
  return postJson<AIQuestionResponse, { question: string }>(`/ai/plants/${plantId}/ask`, { question })
}

export function askSpeciesQuestion(speciesId: number, question: string): Promise<AIQuestionResponse> {
  return postJson<AIQuestionResponse, { question: string }>(`/ai/species/${speciesId}/ask`, { question })
}
