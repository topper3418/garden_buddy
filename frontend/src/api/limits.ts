export const API_QUERY_LIMIT_DEFAULT = 50
export const API_QUERY_LIMIT_MAX = 200

export function clampQueryLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return API_QUERY_LIMIT_DEFAULT
  }

  return Math.min(Math.max(1, limit), API_QUERY_LIMIT_MAX)
}