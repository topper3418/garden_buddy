import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createPlantType,
  deletePlantType,
  getPlantTypeById,
  listPlantTypes,
  queryPlantTypes,
  updatePlantType,
} from '../plantTypes'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('plantTypes api module', () => {
  it('listPlantTypes calls list endpoint', async () => {
    const fetchMock = mockFetchJson({ items: [], limit: 50, offset: 0 })
    await listPlantTypes(50, 0)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/plant-types?limit=50&offset=0')
  })

  it('queryPlantTypes maps filters to querystring', async () => {
    const fetchMock = mockFetchJson([])
    await queryPlantTypes({ nameContains: 'peren', notesContains: 'year', limit: 20, offset: 3 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/plant-types/query?name_contains=peren&notes_contains=year&limit=20&offset=3',
    )
  })

  it('get/create/update/delete functions map to expected endpoints', async () => {
    const getMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await getPlantTypeById(1)
    expect(getMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plant-types/1')

    const createMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await createPlantType({ name: 'Perennial' })
    expect(createMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plant-types')

    const updateMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await updatePlantType(1, { notes: 'updated' })
    expect(updateMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plant-types/1')

    const deleteMock = mockFetchNoContent()
    await deletePlantType(1)
    expect(deleteMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plant-types/1')
  })
})
