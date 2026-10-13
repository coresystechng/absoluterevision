import { getNeonAuthClient } from "@/lib/auth"
import type { ClientSubmissionsPage, SubmissionAssignmentInput } from "../../shared/client-submissions"

export class ClientSubmissionsError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = await getNeonAuthClient().getSession()
  const token = session.data?.session?.token
  if (!token) throw new ClientSubmissionsError("Sign in to access client submissions.", 401)
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ClientSubmissionsError(data?.error ?? "Client submissions are temporarily unavailable.", response.status)
  if (!data) throw new ClientSubmissionsError("The server returned an invalid response.", 502)
  return data as T
}

export function getClientSubmissions(input: { search: string; status: string; cursor?: string | null }) {
  const params = new URLSearchParams({ search: input.search, status: input.status })
  if (input.cursor) params.set("cursor", input.cursor)
  return request<ClientSubmissionsPage>(`/api/client-submissions?${params}`)
}

export function getClientSubmissionDownloadUrl(submissionId: string, fileIndex: number) {
  const params = new URLSearchParams({ action: "download", submissionId, fileIndex: String(fileIndex) })
  return request<{ url: string }>(`/api/client-submissions?${params}`)
}

export function convertClientSubmission(input: SubmissionAssignmentInput) {
  return request<{ assignmentId: number }>("/api/client-submissions", { method: "POST", body: JSON.stringify(input) })
}


export function getNewClientSubmissionsCount(signal?: AbortSignal) {
  return request<{ count: number }>("/api/client-submissions?action=count", { signal })
}
