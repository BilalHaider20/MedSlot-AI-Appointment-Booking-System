import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { isApiError } from './api/client'
import { AuthProvider } from './auth/AuthProvider'
import { GuestOnly, RequireAuth } from './auth/RouteGuards'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { ThemeProvider } from './theme/ThemeProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const isClientError = isApiError(error) && error.status >= 400 && error.status < 500
        return !isClientError && failureCount < 2
      },
    },
  },
})

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <GuestOnly>
                        <LoginPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <GuestOnly>
                        <SignupPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <GuestOnly>
                        <ForgotPasswordPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <GuestOnly>
                        <ResetPasswordPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/"
                    element={
                      <RequireAuth>
                        <WorkspacePage />
                      </RequireAuth>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
