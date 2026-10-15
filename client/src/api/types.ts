export type Role = 'customer' | 'staff' | 'admin'

export interface Business {
  id: string
  name: string
  timezone: string
}

export interface User {
  id: string
  fullName: string
  email: string
  role: Role
  business: Business
}

export interface Service {
  id: string
  name: string
  durationMinutes: number
  priceCents: number
}

export interface Availability {
  date: string
  timezone: string
  slots: string[]
}

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed'
export type AppointmentScope = 'upcoming' | 'past'

export interface Appointment {
  id: string
  service: { id: string; name: string; durationMinutes: number }
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  notes: string | null
  source: 'chat' | 'form'
  createdAt: string
}

export interface NewAppointment {
  serviceId: string
  date: string
  time: string
  notes?: string
}

export interface Draft {
  serviceId: string
  serviceName: string
  date: string
  time: string
  notes?: string
}

export type Ui =
  | { type: 'slots'; date: string; serviceId: string; slots: string[] }
  | { type: 'services'; services: { id: string; name: string }[] }
  | { type: 'confirm'; draft: Draft }
  | { type: 'form'; draft: Partial<Draft>; reason: string }
  | { type: 'booked'; appointmentId: string }

export interface MessageMeta {
  ui?: Ui
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  meta: MessageMeta | null
  createdAt: string
}

export interface SessionSummary {
  id: string
  title: string | null
  status: 'open' | 'closed'
  lastMessageAt: string | null
}

export interface Session {
  id: string
  title: string | null
  status: 'open' | 'closed'
  state: unknown
}

export interface ErrorDetail {
  path?: string | (string | number)[]
  field?: string
  message: string
}
