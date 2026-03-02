import { vi } from 'vitest'

export function mockFetchJson(data: unknown, ok = true, status = 200) {
  const response = {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
  }

  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function mockFetchNoContent(ok = true, status = 204) {
  const response = {
    ok,
    status,
    json: vi.fn(),
    text: vi.fn().mockResolvedValue(''),
  }

  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
