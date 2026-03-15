import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteRequest, getJson, patchJson, postForm, postJson, putJson } from '../http'
import { mockFetchJson, mockFetchNoContent } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('http api helpers', () => {
  it('getJson uses GET and returns parsed json', async () => {
    const fetchMock = mockFetchJson({ hello: 'world' })

    const result = await getJson<{ hello: string }>('/test')

    expect(result.hello).toBe('world')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/test')
  })

  it('postJson sends JSON body', async () => {
    const fetchMock = mockFetchJson({ ok: true })

    await postJson('/species', { name: 'Rose' })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/species', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rose' }),
    })
  })

  it('patchJson sends JSON body', async () => {
    const fetchMock = mockFetchJson({ ok: true })

    await patchJson('/species/1', { common_name: 'Test' })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/species/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ common_name: 'Test' }),
    })
  })

  it('putJson uses PUT', async () => {
    const fetchMock = mockFetchJson({ ok: true })

    await putJson('/plants/1/tags/2')

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/plants/1/tags/2', { method: 'PUT' })
  })

  it('deleteRequest handles 204', async () => {
    const fetchMock = mockFetchNoContent()

    await expect(deleteRequest('/plants/1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/plants/1', { method: 'DELETE' })
  })

  it('postForm sends FormData without content-type override', async () => {
    const fetchMock = mockFetchJson({ id: 1 })
    const form = new FormData()
    form.append('file', new Blob(['abc'], { type: 'text/plain' }), 'a.txt')

    await postForm('/media', form)

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/media', {
      method: 'POST',
      body: form,
    })
  })
})
