import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import DashboardLayout from './pages/DashboardLayout'
import { ThemeProvider } from './contexts/ThemeContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { UnreadProvider } from './contexts/UnreadContext'
import { PlanProvider } from './contexts/PlanContext'
import FeedView from './pages/FeedView'
import SourcesView from './pages/SourcesView'
import BookmarksView from './pages/BookmarksView'
import DigestView from './pages/DigestView'
import StatsView from './pages/StatsView'
import SettingsView from './pages/SettingsView'
import SavePage from './pages/SavePage'
import ReadingListView from './pages/ReadingListView'
import OnboardingWizard from './pages/OnboardingWizard'
import SavedView from './pages/SavedView'
import ArticleReader from './pages/ArticleReader'
import SavedArticleReader from './pages/SavedArticleReader'

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
        <ThemeProvider>
        <SettingsProvider>
        <Routes>
          <Route path="/" element={<LandingWithAuth />} />
          <Route path="/save" element={<SavePage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
          {/* Full-page article reader — outside dashboard layout (no sidebar) */}
          <Route path="/read/:articleId" element={<ProtectedRoute><ArticleReader /></ProtectedRoute>} />
          <Route path="/saved/read/:savedId" element={<ProtectedRoute><SavedArticleReader /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<FeedView />} />
            <Route path="digest" element={<DigestView />} />
            <Route path="reading-list" element={<ReadingListView />} />
            <Route path="read-later" element={<Navigate to="/dashboard/reading-list" replace />} />
            <Route path="saved" element={<Navigate to="/dashboard/reading-list" replace />} />
            <Route path="bookmarks" element={<BookmarksView />} />
            <Route path="sources" element={<SourcesView />} />
            <Route path="stats" element={<StatsView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
