import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteMedia, getMediaById, listMedia, mediaFileUrl, queryMedia, updateMedia, uploadMedia } from '../media'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('media api module', () => {
  it('listMedia calls list endpoint with include_file_path', async () => {
    const fetchMock = mockFetchJson({ items: [], limit: 50, offset: 0 })
    await listMedia(50, 0, true)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/media?limit=50&offset=0&include_file_path=true')
  })

  it('queryMedia maps filters to querystring', async () => {
    const fetchMock = mockFetchJson([])
    await queryMedia({
      nameContains: 'cherry',
      speciesIds: [2, 4],
      plantTypeId: 8,
      titleContains: 'leaf',
      mimeType: 'image/jpeg',
      plantId: 3,
      minSize: 10,
      maxSize: 1000,
      limit: 5,
      offset: 2,
      includeFilePath: false,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/media/query?name_contains=cherry&species_ids=2&species_ids=4&plant_type_id=8&title_contains=leaf&mime_type=image%2Fjpeg&plant_id=3&min_size=10&max_size=1000&limit=5&offset=2&include_file_path=false',
    )
  })

  it('get/update/delete map to expected endpoints', async () => {
    const getMock = mockFetchJson({ id: 1, filename: 'a.jpg', mime_type: 'image/jpeg', size: 1, uploaded_at: 'x' })
    await getMediaById(1, true)
    expect(getMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/media/1?include_file_path=true')

    const patchMock = mockFetchJson({ id: 1, filename: 'a.jpg', mime_type: 'image/jpeg', size: 1, uploaded_at: 'x' })
    await updateMedia(1, { title: 'updated' })
    expect(patchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/media/1')

    const deleteMock = mockFetchNoContent()
    await deleteMedia(1)
    expect(deleteMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/media/1')
  })

  it('uploadMedia posts multipart form data', async () => {
    const fetchMock = mockFetchJson({ id: 1, filename: 'a.jpg', mime_type: 'image/jpeg', size: 1, uploaded_at: 'x' })
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' })

    await uploadMedia(file, 'Title', 12)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/media')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(form.get('title')).toBe('Title')
    expect(form.get('plant_id')).toBe('12')
  })

  it('mediaFileUrl returns file endpoint url', () => {
    expect(mediaFileUrl(12)).toBe('http://localhost:8000/media/12/file')
  })
})
