import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import DashboardLayout from './pages/DashboardLayout'
import FeedView from './pages/FeedView'
import SourcesView from './pages/SourcesView'
import BookmarksView from './pages/BookmarksView'
import DigestView from './pages/DigestView'
import ReadLaterView from './pages/ReadLaterView'
import StatsView from './pages/StatsView'

function LandingWithAuth() {
  const { user } = useAuth()
  const [authModal, setAuthModal] = useState(null)
  if (user) return <Navigate to="/dashboard" replace />
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <Navbar onOpenAuth={setAuthModal} />
      <LandingPage onOpenAuth={setAuthModal} />
      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onSwitchMode={setAuthModal} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingWithAuth />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<FeedView />} />
            <Route path="digest" element={<DigestView />} />
            <Route path="read-later" element={<ReadLaterView />} />
            <Route path="bookmarks" element={<BookmarksView />} />
            <Route path="sources" element={<SourcesView />} />
            <Route path="stats" element={<StatsView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
