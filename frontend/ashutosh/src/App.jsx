import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import MainLayout from './components/layout/MainLayout'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Dashboard from './pages/dashboard/Dashboard'
import MissionControl from './pages/mission/MissionControl'
import TodaysFocus from './pages/focus/TodaysFocus'
import InboxIntelligence from './pages/inbox/InboxIntelligence'
import MeetingMemory from './pages/meetings/MeetingMemory'
import TaskUniverse from './pages/tasks/TaskUniverse'
import DependencyMap from './pages/dependencies/DependencyMap'
import WeeklyPlan from './pages/weekly/WeeklyPlan'
import AIAssistant from './pages/assistant/AIAssistant'
import Notifications from './pages/notifications/Notifications'
import Analytics from './pages/analytics/Analytics'
import Profile from './pages/profile/Profile'
import Settings from './pages/settings/Settings'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <MainLayout>{children}</MainLayout>
}

function AppRoutes() {
  const { isAuthenticated } = useApp()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/mission" element={<ProtectedRoute><MissionControl /></ProtectedRoute>} />
      <Route path="/focus" element={<ProtectedRoute><TodaysFocus /></ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute><InboxIntelligence /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingMemory /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><TaskUniverse /></ProtectedRoute>} />
      <Route path="/dependencies" element={<ProtectedRoute><DependencyMap /></ProtectedRoute>} />
      <Route path="/weekly" element={<ProtectedRoute><WeeklyPlan /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
