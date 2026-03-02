import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSpecies, deleteSpecies, getSpeciesById, listSpecies, querySpecies, updateSpecies } from '../species'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('species api module', () => {
  it('listSpecies calls list endpoint', async () => {
    const fetchMock = mockFetchJson({ items: [], limit: 50, offset: 0 })
    await listSpecies(50, 0)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/species?limit=50&offset=0')
  })

  it('querySpecies maps filters to querystring', async () => {
    const fetchMock = mockFetchJson([])
    await querySpecies({ nameContains: 'rose', commonNameContains: 'briar', parentSpeciesId: 2, limit: 10, offset: 5 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/species/query?name_contains=rose&common_name_contains=briar&parent_species_id=2&limit=10&offset=5',
    )
  })

  it('get/create/update/delete functions map to expected endpoints', async () => {
    const getMock = mockFetchJson({ id: 1, name: 'Rose', created_at: 'x' })
    await getSpeciesById(1)
    expect(getMock).toHaveBeenCalledWith('http://localhost:8000/species/1')

    const createMock = mockFetchJson({ id: 1, name: 'Rose', created_at: 'x' })
    await createSpecies({ name: 'Rose' })
    expect(createMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/species')

    const updateMock = mockFetchJson({ id: 1, name: 'Rose', created_at: 'x' })
    await updateSpecies(1, { notes: 'updated' })
    expect(updateMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/species/1')

    const deleteMock = mockFetchNoContent()
    await deleteSpecies(1)
    expect(deleteMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/species/1')
  })
})
