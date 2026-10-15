import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appointmentsApi } from '../../api/appointments'
import { errorMessage } from '../../api/client'
import { servicesApi } from '../../api/services'
import type { AppointmentScope } from '../../api/types'
import { useToast } from '../../components/Toast'

export const appointmentKeys = {
  all: ['appointments'] as const,
  list: (scope: AppointmentScope) => ['appointments', scope] as const,
}

export function useAppointments(scope: AppointmentScope) {
  return useQuery({
    queryKey: appointmentKeys.list(scope),
    queryFn: () => appointmentsApi.list(scope),
  })
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
    staleTime: 10 * 60_000,
  })
}

export function useAvailability(serviceId: string, date: string) {
  return useQuery({
    queryKey: ['availability', serviceId, date],
    queryFn: () => servicesApi.availability(serviceId, date),
    enabled: Boolean(serviceId && date),
    staleTime: 15_000,
  })
}

/** Everything that should happen after any booking, whether it came from chat or the form. */
export function useAfterBooking() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['availability'] })
    toast('Appointment booked')
  }, [queryClient, toast])
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: appointmentsApi.cancel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast('Appointment cancelled')
    },
    onError: (error) => toast(errorMessage(error), 'danger'),
  })
}
