import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './contexts/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Scholarships from './pages/Scholarships'
import Matches from './pages/Matches'
import ScholarshipDetail from './pages/ScholarshipDetail'
import Applications from './pages/Applications'
import Vault from './pages/Vault'
import Notifications from './pages/Notifications'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/admin" element={<Admin />} />

      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="scholarships" element={<Scholarships />} />
        <Route path="matches" element={<Matches />} />
        <Route path="matches/:id" element={<ScholarshipDetail />} />
        <Route path="applications" element={<Applications />} />
        <Route path="vault" element={<Vault />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
