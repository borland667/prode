import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { get } from '../utils/api';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [leaderboardLink, setLeaderboardLink] = useState('/');
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTournamentLinks = async () => {
      try {
        const tournaments = await get('/tournaments?status=active,upcoming');
        if (tournaments?.length) {
          setLeaderboardLink(`/leaderboard/${tournaments[0].id}`);
        }
      } catch (err) {
        console.error('Failed to load navigation tournaments:', err);
      }
    };

    loadTournamentLinks();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsOpen(false);
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center space-x-2 font-bold text-2xl text-white hover:text-emerald-400 transition"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900 font-bold">
              P
            </div>
            <span>PRODE</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-300 hover:text-white transition"
            >
              {t('nav.tournaments')}
            </Link>
            <Link
              to={leaderboardLink}
              className="text-gray-300 hover:text-white transition"
            >
              {t('nav.leaderboard')}
            </Link>
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="text-gray-300 hover:text-white transition"
              >
                {t('nav.admin')}
              </Link>
            )}

            {/* Language Toggle */}
            <div className="flex items-center border-l border-slate-700 pl-8 space-x-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded text-sm transition ${
                  language === 'en'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded text-sm transition ${
                  language === 'es'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ES
              </button>
            </div>

            {/* Auth Section */}
            {user ? (
              <div className="flex items-center space-x-4 border-l border-slate-700 pl-8">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 text-gray-300 hover:text-white transition"
                >
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 text-sm font-bold">
                    {user.name?.[0] || 'U'}
                  </div>
                  <span className="hidden sm:inline">{user.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-300 hover:text-white transition"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4 border-l border-slate-700 pl-8">
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-white transition"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            {/* Language Toggle Mobile */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded text-xs transition ${
                  language === 'en'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-2 py-1 rounded text-xs transition ${
                  language === 'es'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400'
                }`}
              >
                ES
              </button>
            </div>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
            >
              {t('nav.tournaments')}
            </Link>
            <Link
              to={leaderboardLink}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
            >
              {t('nav.leaderboard')}
            </Link>
            {user?.isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
              >
                {t('nav.admin')}
              </Link>
            )}

            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
                >
                  {t('nav.profile')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded transition"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
