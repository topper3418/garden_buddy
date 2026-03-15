import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createTag,
  deleteTag,
  getTagById,
  listTags,
  queryTags,
  updateTag,
} from '../tags'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tags api module', () => {
  it('listTags calls list endpoint', async () => {
    const fetchMock = mockFetchJson({ items: [], limit: 50, offset: 0 })
    await listTags(50, 0)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/tags?limit=50&offset=0')
  })

  it('queryTags maps filters to querystring', async () => {
    const fetchMock = mockFetchJson([])
    await queryTags({ nameContains: 'peren', notesContains: 'year', limit: 20, offset: 3 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/tags/query?name_contains=peren&notes_contains=year&limit=20&offset=3',
    )
  })

  it('get/create/update/delete functions map to expected endpoints', async () => {
    const getMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await getTagById(1)
    expect(getMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/tags/1')

    const createMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await createTag({ name: 'Perennial', main_media_id: 3 })
    expect(createMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/tags')

    const updateMock = mockFetchJson({ id: 1, name: 'Perennial', created_at: 'x' })
    await updateTag(1, { notes: 'updated' })
    expect(updateMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/tags/1')

    const deleteMock = mockFetchNoContent()
    await deleteTag(1)
    expect(deleteMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/tags/1')
  })
})
