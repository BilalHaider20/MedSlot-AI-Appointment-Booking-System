import { api } from './client'
import type { User } from './types'

export interface Credentials {
  email: string
  password: string
}

export interface SignupInput extends Credentials {
  fullName: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

type UserResponse = { user: User }

export const authApi = {
  me: () => api.get<UserResponse>('/auth/me').then((r) => r.user),
  login: (input: Credentials) => api.post<UserResponse>('/auth/login', input).then((r) => r.user),
  signup: (input: SignupInput) => api.post<UserResponse>('/auth/signup', input).then((r) => r.user),
  logout: () => api.post<void>('/auth/logout'),
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/password/forgot', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<void>('/auth/password/reset', { token, password }),
  changePassword: (input: ChangePasswordInput) =>
    api.post<UserResponse>('/auth/password/change', input).then((r) => r.user),
}
