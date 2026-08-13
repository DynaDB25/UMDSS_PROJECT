import { client, postStream } from './client'
import type { Scholarship, Application, VaultDocument, AppNotification, MatchResult } from '../data/types'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** `interview` swaps the assistant into a strict one-question-at-a-time panel. */
export type AssistantOpts = { mode?: 'chat' | 'interview'; scholarship?: string }

/** One place the crawler thinks a scholarship's application might live. */
export type FormCandidate = {
  url: string
  host: string
  /** 0-100 confidence. Anything at or above 70 is auto-selected server-side. */
  score: number
  reason: string
  kind: 'form' | 'portal' | 'document' | 'page'
  embeddable: boolean
}

export const api = {
  auth: {
    login: (credentials: any) => client.post('/auth/login/', credentials),
    register: (data: any) => client.post('/auth/register/', data),
    me: () => client.get('/auth/me/'),
    updateMe: (data: any) => client.put('/auth/me/', data),
    changePassword: (data: { current_password: string; new_password: string }) =>
      client.post('/auth/password/', data),
    // Text (or email, as fallback) a one-time code to the student's phone.
    requestPhoneOtp: (phone?: string) =>
      client.post('/auth/phone/otp/', phone ? { phone } : {}) as Promise<{
        channel: 'SMS' | 'Email'
        phone: string
        expiresIn: number
        resendIn: number
      }>,
    verifyPhoneOtp: (code: string) =>
      client.post('/auth/phone/verify/', { code }) as Promise<{ verified: boolean; phone: string }>,
  },
  scholarships: {
    list: () => client.get('/scholarships/') as Promise<Scholarship[]>,
    get: (id: string) => client.get(`/scholarships/${id}/`) as Promise<Scholarship>,
    // A student reports where the application actually lives. Two independent
    // reports of the same link promote it for everyone.
    suggestForm: (id: string, url: string) =>
      client.post(`/scholarships/${id}/suggest-form/`, { url }) as Promise<{
        accepted: boolean
        votes: number
        needed: number
        promoted: boolean
        applicationUrl: string
      }>,
    // Ask the server to go and find this scholarship's real application form.
    // `candidates` is the ranked shortlist, returned even when nothing scored
    // high enough to auto-select, so the UI can offer real choices.
    findForm: (id: string) =>
      client.post(`/scholarships/${id}/find-form/`, {}) as Promise<{
        applicationUrl: string
        applicationEmail: string
        applicationMode: string
        candidates: FormCandidate[]
        searched: boolean
      }>,
  },
  matches: {
    list: () => client.get('/matches/') as Promise<MatchResult[]>,
  },
  applications: {
    list: () => client.get('/applications/') as Promise<Application[]>,
    create: (scholarshipId: string) => client.post('/applications/', { scholarship_id: scholarshipId }) as Promise<Application>,
    // The student confirms they actually sent it to the provider.
    markSubmitted: (id: string) => client.post(`/applications/${id}/mark-submitted/`, {}) as Promise<Application>,
    // Every required document for this application, decrypted, in one archive.
    downloadDocuments: async (id: string, filename: string) => {
      const blob = (await client.get(`/applications/${id}/documents-zip/`)) as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
  },
  reference: () => client.get('/reference/') as Promise<{
    documentTypes: { key: string; label: string; category: string; keywords: string[] }[]
    regions: string[]
    programmes: string[]
  }>,
  documents: {
    list: () => client.get('/documents/') as Promise<VaultDocument[]>,
    upload: (data: FormData) => client.post('/documents/', data) as Promise<VaultDocument>,
    remove: (id: string) => client.delete(`/documents/${id}/`) as Promise<null>,
    download: async (id: string, filename: string) => {
      const blob = await client.get(`/documents/${id}/download/`) as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  },
  notifications: {
    list: () => client.get('/notifications/') as Promise<AppNotification[]>,
    markAllRead: () => client.post('/notifications/mark-all-read/', {}),
  },
  assistant: {
    chat: (messages: ChatTurn[], opts?: AssistantOpts) =>
      client.post('/assistant/chat/', { messages, ...opts }) as Promise<{ reply: string }>,
    /** Same reply, delivered token by token. `onDelta` fires as text arrives. */
    stream: (
      messages: ChatTurn[],
      onDelta: (text: string) => void,
      opts?: AssistantOpts & { signal?: AbortSignal },
    ) => {
      const { signal, ...rest } = opts || {}
      return postStream('/assistant/stream/', { messages, ...rest }, onDelta, signal)
    },
  },
  admin: {
    stats: () => client.get('/admin/stats/'),
    applications: () => client.get('/admin/applications/'),
    createScholarship: (data: any) => client.post('/admin/scholarships/', data),
  },
}
