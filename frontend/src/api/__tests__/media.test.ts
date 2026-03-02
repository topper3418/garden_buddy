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
    await queryMedia({ titleContains: 'leaf', mimeType: 'image/jpeg', minSize: 10, maxSize: 1000, limit: 5, offset: 2, includeFilePath: false })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/media/query?title_contains=leaf&mime_type=image%2Fjpeg&min_size=10&max_size=1000&limit=5&offset=2&include_file_path=false',
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

    await uploadMedia(file, 'Title')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/media')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('mediaFileUrl returns file endpoint url', () => {
    expect(mediaFileUrl(12)).toBe('http://localhost:8000/media/12/file')
  })
})
