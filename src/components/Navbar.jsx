import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Menu, Moon, Shield, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { get } from '../utils/api';
import { getModeLabel } from '../utils/tournament';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [leaderboardLink, setLeaderboardLink] = useState('/');
  const [featuredTournament, setFeaturedTournament] = useState(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTournamentLinks = async () => {
      try {
        const tournaments = await get('/tournaments?status=active,upcoming');
        setFeaturedTournament(tournaments?.[0] || null);
        if (tournaments?.length) {
          setLeaderboardLink(`/leaderboard/${tournaments[0].id}`);
        }
      } catch (err) {
        console.error('Failed to load navigation tournaments:', err);
      }
    };

    loadTournamentLinks();
  }, []);

  const featuredClosingDate = featuredTournament?.closingDate
    ? new Date(featuredTournament.closingDate).toLocaleDateString(
        language === 'es' ? 'es-AR' : 'en-US',
        { month: 'short', day: 'numeric' }
      )
    : 'TBD';
  const featuredModeLabel = featuredTournament?.mode
    ? getModeLabel(featuredTournament.mode, language)
    : '--';
  const topBarItems = user && featuredTournament
    ? [
        { label: featuredTournament.name, value: null, accent: true },
        { label: t('home.currentMode'), value: featuredModeLabel },
        { label: t('tournament.closingDate'), value: featuredClosingDate },
        {
          label: t('tournament.participants'),
          value: String(featuredTournament.participantCount || 0),
        },
      ]
    : [];

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsOpen(false);
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      return false;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  };

  const handleTournamentsClick = (event) => {
    setIsOpen(false);

    if (location.pathname === '/' && scrollToSection('active-tournaments')) {
      event.preventDefault();
    }
  };

  const handleLeaderboardClick = (event) => {
    setIsOpen(false);

    if (leaderboardLink !== '/') {
      return;
    }

    if (location.pathname === '/' && scrollToSection('active-tournaments')) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50">
      <div className="border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-emerald-400" />
              <span className="sport-display">Matchday Live</span>
            </div>
            {topBarItems.length > 0 ? (
              <div className="hidden md:flex items-center gap-5">
                {topBarItems.map((item) => (
                  <div key={`${item.label}-${item.value || 'label'}`} className="flex items-center gap-2 min-w-0">
                    <span className={`truncate ${item.accent ? 'text-emerald-300' : 'text-slate-500'}`}>
                      {item.label}
                    </span>
                    {item.value ? (
                      <span className="truncate normal-case tracking-normal text-slate-200 font-semibold">
                        {item.value}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-6">
                <span>{t('nav.tournaments')}</span>
                <span>{t('nav.leaderboard')}</span>
                <span>World Cup 2026</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-white/5 bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-20 gap-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 text-white transition hover:text-emerald-300"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.28)]">
              <Shield size={22} />
            </div>
            <div className="leading-none">
              <div className="sport-display text-2xl">PRODE</div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-400">
                Prediction Club
              </div>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/#active-tournaments"
              onClick={handleTournamentsClick}
              className="score-pill text-slate-200 hover:border-emerald-400/60 hover:text-white transition"
            >
              {t('nav.tournaments')}
            </Link>
            <Link
              to={leaderboardLink}
              onClick={handleLeaderboardClick}
              className="score-pill text-slate-200 hover:border-emerald-400/60 hover:text-white transition"
            >
              {t('nav.leaderboard')}
            </Link>
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="score-pill text-slate-200 hover:border-emerald-400/60 hover:text-white transition"
              >
                {t('nav.admin')}
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="score-pill text-slate-200 hover:border-emerald-400/60 hover:text-white transition"
              aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
            </button>

            {/* Language Toggle */}
            <div className="flex items-center border-l border-white/10 pl-6 space-x-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  language === 'en'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  language === 'es'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                ES
              </button>
            </div>

            {/* Auth Section */}
            {user ? (
              <div className="flex items-center space-x-4 border-l border-white/10 pl-6">
                <Link
                  to="/profile"
                  className="flex items-center space-x-3 text-gray-300 hover:text-white transition"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-amber-300 to-emerald-500 rounded-full flex items-center justify-center text-slate-950 text-sm font-bold">
                    {user.name?.[0] || 'U'}
                  </div>
                  <span className="hidden sm:inline font-semibold">{user.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 border-l border-white/10 pl-6">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="sport-button px-5 py-2.5 rounded-full text-slate-950 font-bold transition hover:scale-[1.02]"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 text-gray-300"
              aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Language Toggle Mobile */}
            <div className="flex items-center space-x-1 rounded-full border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-full text-xs font-semibold transition ${
                  language === 'en'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-gray-400'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-2 py-1 rounded-full text-xs font-semibold transition ${
                  language === 'es'
                    ? 'bg-emerald-500 text-slate-950'
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
          <div className="md:hidden pb-5 space-y-2">
            <Link
              to="/#active-tournaments"
              onClick={handleTournamentsClick}
              className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
            >
              {t('nav.tournaments')}
            </Link>
            <Link
              to={leaderboardLink}
              onClick={handleLeaderboardClick}
              className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
            >
              {t('nav.leaderboard')}
            </Link>
            {user?.isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
              >
                {t('nav.admin')}
              </Link>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
            >
              {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            </button>

            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {t('nav.profile')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
      </div>
    </nav>
  );
}
