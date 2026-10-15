import { api } from './client'
import type { Availability, Service } from './types'

export const servicesApi = {
  list: () => api.get<{ services: Service[] }>('/services').then((r) => r.services),
  availability: (serviceId: string, date: string) => {
    const params = new URLSearchParams({ serviceId, date })
    return api.get<Availability>(`/availability?${params}`)
  },
}
