import { client } from './client'
import type { Scholarship, Application, VaultDocument, AppNotification, MatchResult } from '../data/types'

export const api = {
  auth: {
    login: (credentials: any) => client.post('/auth/login/', credentials),
    register: (data: any) => client.post('/auth/register/', data),
    me: () => client.get('/auth/me/'),
    updateMe: (data: any) => client.put('/auth/me/', data),
  },
  scholarships: {
    list: () => client.get('/scholarships/') as Promise<Scholarship[]>,
    get: (id: string) => client.get(`/scholarships/${id}/`) as Promise<Scholarship>,
  },
  matches: {
    list: () => client.get('/matches/') as Promise<MatchResult[]>,
  },
  applications: {
    list: () => client.get('/applications/') as Promise<Application[]>,
    create: (scholarshipId: string) => client.post('/applications/', { scholarship_id: scholarshipId }) as Promise<Application>,
  },
  documents: {
    list: () => client.get('/documents/') as Promise<VaultDocument[]>,
    upload: (data: FormData) => client.post('/documents/', data) as Promise<VaultDocument>,
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
  admin: {
    stats: () => client.get('/admin/stats/'),
    applications: () => client.get('/admin/applications/'),
  },
}
