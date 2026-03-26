import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import LearningPage from './pages/LearningPage';
import DidYouKnowPage from './pages/DidYouKnowPage';
import JoinGamePage from './pages/JoinGamePage';
import GamePage from './pages/GamePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Student Routes ── */}
          <Route path="/" element={<HomePage />} />
          <Route path="/learning" element={<LearningPage />} />
          <Route path="/did-you-know" element={<DidYouKnowPage />} />
          <Route path="/join" element={<JoinGamePage />} />
          <Route path="/join/:code" element={<JoinGamePage />} />
          <Route path="/game/:token" element={<GamePage />} />

          {/* ── Admin Routes — hidden from students ── */}
          {/* Access via: /admin/login (not linked anywhere on student pages) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/register" element={<AdminRegisterPage />} />

          {/* ── Catch-all 404 ── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
