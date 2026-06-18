import axios from 'axios'

// Extract a human-readable message from an API/axios error for display in forms.
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: Record<string, string[]> } | undefined
    if (data?.details) {
      const first = Object.values(data.details)[0]
      if (first?.[0]) return first[0]
    }
    if (data?.error) return data.error
    if (err.response?.status === 403) return 'You do not have permission for this action.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
