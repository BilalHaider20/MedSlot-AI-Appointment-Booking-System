import { api } from './client'
import type { Appointment, AppointmentScope, NewAppointment } from './types'

type AppointmentResponse = { appointment: Appointment }

export const appointmentsApi = {
  list: (scope: AppointmentScope) =>
    api.get<{ appointments: Appointment[] }>(`/appointments?scope=${scope}`).then((r) => r.appointments),
  create: (input: NewAppointment) =>
    api.post<AppointmentResponse>('/appointments', input).then((r) => r.appointment),
  cancel: (id: string) =>
    api.post<AppointmentResponse>(`/appointments/${id}/cancel`).then((r) => r.appointment),
}
