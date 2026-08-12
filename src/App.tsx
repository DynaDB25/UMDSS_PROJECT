import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AppLayout } from './components/AppLayout'
import { RouteFallback } from './components/skeletons'
import { useAuth } from './contexts/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Scholarships from './pages/Scholarships'
import ScholarshipDetail from './pages/ScholarshipDetail'
import Applications from './pages/Applications'
import Vault from './pages/Vault'
import Notifications from './pages/Notifications'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteFallback />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteFallback />
  if (!user) return <Navigate to="/login" replace />
  // Non-staff users have no business on the admin console, send them home.
  if (!user.is_staff) return <Navigate to="/app" replace />
  return <>{children}</>
}

/**
 * Scholarship browsing and matching used to be two screens; detail lived under
 * /app/matches/:id. Both were merged into /app/scholarships, so old links
 * (and any bookmarks) forward instead of 404ing.
 */
function LegacyMatchRedirect() {
  const { id } = useParams()
  return <Navigate to={`/app/scholarships/${id}`} replace />
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/admin" element={<Navigate to="/app/admin" replace />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="scholarships" element={<Scholarships />} />
        <Route path="scholarships/:id" element={<ScholarshipDetail />} />
        <Route path="matches" element={<Navigate to="/app/scholarships" replace />} />
        <Route path="matches/:id" element={<LegacyMatchRedirect />} />
        <Route path="applications" element={<Applications />} />
        <Route path="vault" element={<Vault />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </MotionConfig>
  )
}
