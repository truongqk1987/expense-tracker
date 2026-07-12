import { QueryProvider } from './providers/QueryProvider'
import { AuthProvider } from './providers/AuthProvider'
import { AppRoutes } from './routes/AppRoutes'
import { Toaster } from './components/Toaster'

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  )
}
