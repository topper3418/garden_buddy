import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addTypeToPlant,
  createPlant,
  deletePlant,
  getPlantById,
  listPlants,
  queryPlants,
  removeTypeFromPlant,
  updatePlant,
} from '../plants'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('plants api module', () => {
  it('listPlants calls list endpoint', async () => {
    const fetchMock = mockFetchJson({ items: [], limit: 50, offset: 0 })
    await listPlants(50, 0, false)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/plants?limit=50&offset=0&archived=false')
  })

  it('queryPlants maps filters to querystring', async () => {
    const fetchMock = mockFetchJson([])
    await queryPlants({ nameContains: 'tomato', speciesIds: [1, 3], plantTypeId: 2, archived: true, limit: 25, offset: 4 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/plants/query?name_contains=tomato&species_ids=1&species_ids=3&plant_type_id=2&archived=true&limit=25&offset=4',
    )
  })

  it('get/create/update/delete functions map to expected endpoints', async () => {
    const getMock = mockFetchJson({ id: 1, name: 'Plant', created_at: 'x', plant_type_ids: [], plant_types: [] })
    await getPlantById(1, true)
    expect(getMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants/1?include_deleted=true')

    const createMock = mockFetchJson({ id: 1, name: 'Plant', created_at: 'x', plant_type_ids: [], plant_types: [] })
    await createPlant({ name: 'Plant', plant_type_ids: [] })
    expect(createMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants')

    const updateMock = mockFetchJson({ id: 1, name: 'Plant', created_at: 'x', plant_type_ids: [], plant_types: [] })
    await updatePlant(1, { notes: 'updated' })
    expect(updateMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants/1')

    const deleteMock = mockFetchNoContent()
    await deletePlant(1)
    expect(deleteMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants/1')
  })

  it('addTypeToPlant uses PUT and removeTypeFromPlant uses DELETE then GET', async () => {
    const addMock = mockFetchJson({ id: 1, name: 'Plant', created_at: 'x', plant_type_ids: [2], plant_types: [] })
    await addTypeToPlant(1, 2)
    expect(addMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants/1/types/2')

    const deleteResponse = {
      ok: true,
      status: 204,
      json: vi.fn(),
      text: vi.fn().mockResolvedValue(''),
    }
    const getResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 1, name: 'Plant', created_at: 'x', plant_type_ids: [], plant_types: [] }),
      text: vi.fn().mockResolvedValue(''),
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(deleteResponse).mockResolvedValueOnce(getResponse)
    vi.stubGlobal('fetch', fetchMock)

    await removeTypeFromPlant(1, 2)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/plants/1/types/2')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8000/plants/1?include_deleted=false')
  })
})
