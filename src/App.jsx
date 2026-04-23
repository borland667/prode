import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Tournament from './pages/Tournament';
import Predict from './pages/Predict';
import Leaderboard from './pages/Leaderboard';
import GlobalLeaderboard from './pages/GlobalLeaderboard';
import League from './pages/League';
import LeagueInvite from './pages/LeagueInvite';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen">
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/tournament/:id" element={<Tournament />} />
                <Route path="/tournament/:id/predict" element={<Predict />} />
                <Route path="/league/:id/predict" element={<Predict />} />
                <Route path="/leaderboard/global" element={<GlobalLeaderboard />} />
                <Route path="/leaderboard/:id" element={<Leaderboard />} />
                <Route path="/league/:id" element={<League />} />
                <Route path="/league/invite/:joinCode" element={<LeagueInvite />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
