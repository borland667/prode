import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  LayoutGrid,
  Menu,
  Moon,
  Shield,
  Sun,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { get } from '../utils/api';
import { getLocalizedName, getModeLabel } from '../utils/tournament';

function formatClosingDate(dateValue, formatDate) {
  if (!dateValue) {
    return 'TBD';
  }

  return formatDate(dateValue, {
    month: 'short',
    day: 'numeric',
  });
}

function NavDropdown({
  icon,
  label,
  title,
  items,
  emptyLabel,
  footerLabel,
  footerTo,
  onNavigate,
  renderMeta,
}) {
  const Icon = icon;
  const handleNavigate = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onNavigate?.();
  };

  return (
    <div className="relative group after:absolute after:left-0 after:right-0 after:top-full after:h-4 after:content-['']">
      <button
        type="button"
        className="nav-pill-button"
      >
        <Icon size={14} />
        <span>{label}</span>
      </button>

      <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-96 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
        <div className="sport-panel-strong rounded-panel-md p-4 shadow-ds-popover">
          <div className="flex items-center justify-between mb-3">
            <p className="sport-display text-lg text-white">{title}</p>
            {footerTo ? (
              <Link
                to={footerTo}
                onClick={handleNavigate}
                className="text-sm font-semibold text-emerald-300 hover:text-white transition"
              >
                {footerLabel}
              </Link>
            ) : null}
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                {emptyLabel}
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={handleNavigate}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition hover:border-emerald-400/40 hover:bg-white/8"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{item.title}</p>
                    <p className="text-sm text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {renderMeta ? renderMeta(item) : null}
                    <ChevronRight size={16} className="text-slate-500" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [leaderboardLink, setLeaderboardLink] = useState('/');
  const [featuredTournament, setFeaturedTournament] = useState(null);
  const [navCollections, setNavCollections] = useState({ tournaments: [], leagues: [] });
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t, formatDate, formatNumber } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTournamentLinks = async () => {
      try {
        const tournaments = await get('/tournaments?status=active,upcoming');
        setFeaturedTournament(tournaments?.[0] || null);
        if (tournaments?.length) {
          setLeaderboardLink(`/leaderboard/${tournaments[0].id}`);
        } else {
          setLeaderboardLink('/');
        }
      } catch (err) {
        console.error('Failed to load navigation tournaments:', err);
      }
    };

    loadTournamentLinks();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadAccountNavigation = async () => {
      try {
        const data = await get('/account/navigation');
        setNavCollections({
          tournaments: data?.tournaments || [],
          leagues: data?.leagues || [],
        });
      } catch (err) {
        console.error('Failed to load account navigation:', err);
        setNavCollections({ tournaments: [], leagues: [] });
      }
    };

    loadAccountNavigation();
  }, [user]);

  const featuredClosingDate = formatClosingDate(featuredTournament?.closingDate, formatDate);
  const featuredModeLabel = featuredTournament?.mode
    ? getModeLabel(featuredTournament.mode, language)
    : '--';

  const topBarItems = user && featuredTournament
    ? [
        {
          label: getLocalizedName(featuredTournament, language, featuredTournament.name),
          value: null,
          accent: true,
        },
        { label: t('home.currentMode'), value: featuredModeLabel },
        { label: t('tournament.closingDate'), value: featuredClosingDate },
        {
          label: t('tournament.participants'),
          value: formatNumber(featuredTournament.participantCount || 0),
        },
      ]
    : [];

  const userNavCollections = user ? navCollections : { tournaments: [], leagues: [] };

  const tournamentQuickLinks = useMemo(() => {
    const featured = featuredTournament
      ? [
          {
            id: `featured-${featuredTournament.id}`,
            to: `/tournament/${featuredTournament.id}`,
            title: getLocalizedName(featuredTournament, language, featuredTournament.name),
            subtitle: `${t('nav.featured')} • ${featuredModeLabel}`,
            status: featuredTournament.status,
            accessType: featuredTournament.accessType,
          },
        ]
      : [];

    const joined = (userNavCollections.tournaments || [])
      .filter((entry) => entry.id !== featuredTournament?.id)
      .map((entry) => ({
        id: entry.id,
        to: `/tournament/${entry.id}`,
        title: getLocalizedName(entry, language, entry.name),
        subtitle: `${entry.accessType === 'private' ? t('tournament.privateAccess') : t('tournament.publicAccess')} • ${formatClosingDate(entry.closingDate, formatDate)}`,
        status: entry.status,
        accessType: entry.accessType,
      }));

    return [...featured, ...joined].slice(0, 6);
  }, [featuredTournament, userNavCollections.tournaments, featuredModeLabel, formatDate, language, t]);

  const leagueQuickLinks = useMemo(
    () =>
      (userNavCollections.leagues || []).map((league) => ({
        id: league.id,
        to: `/league/${league.id}`,
        title: league.name,
        subtitle: `${getLocalizedName(
          {
            name: league.tournamentName,
            nameEs: league.tournamentNameEs,
          },
          language,
          league.tournamentName
        )} • ${formatNumber(league.memberCount || 0)} ${t('tournament.leagueMembers').toLowerCase()}`,
        isOwner: league.isOwner,
      })),
    [formatNumber, language, userNavCollections.leagues, t]
  );

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
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-h-9 items-center justify-between text-xs uppercase tracking-marquee text-slate-400 md:text-sm">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-emerald-400" />
              <span className="sport-display">Matchday Live</span>
            </div>
            {topBarItems.length > 0 ? (
              <div className="hidden lg:flex items-center gap-5">
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
              <div className="hidden lg:flex items-center gap-6">
                <span>{t('nav.quickAccess')}</span>
                <span>{t('nav.tournaments')}</span>
                <span>{t('nav.leaderboard')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-white/5 bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-20 gap-6">
            <Link
              to="/"
              className="flex items-center gap-3 text-white transition hover:text-emerald-300"
            >
              <div className="surface-accent-gradient flex h-11 w-11 items-center justify-center rounded-2xl shadow-ds-brand-mark">
                <Shield size={22} />
              </div>
              <div className="leading-none">
                <div className="sport-display text-2xl">PRODE</div>
                <div className="text-kicker-tight uppercase tracking-marquee-tight text-slate-400">
                  Prediction Club
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-3">
              <NavDropdown
                icon={LayoutGrid}
                label={t('nav.tournaments')}
                title={t('nav.tournaments')}
                items={tournamentQuickLinks}
                emptyLabel={t('nav.noJoinedTournaments')}
                footerLabel={t('nav.viewAll')}
                footerTo="/#active-tournaments"
                onNavigate={() => setIsOpen(false)}
                renderMeta={(item) => (
                  <span className={`score-pill ${item.accessType === 'private' ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {item.accessType === 'private' ? t('tournament.privateAccess') : t('tournament.publicAccess')}
                  </span>
                )}
              />

              {user ? (
                <NavDropdown
                  icon={Users}
                  label={t('nav.myLeagues')}
                  title={t('nav.myLeagues')}
                  items={leagueQuickLinks}
                  emptyLabel={t('nav.noLeaguesYet')}
                  renderMeta={(item) =>
                    item.isOwner ? (
                      <span className="score-pill text-cyan-300">{t('tournament.leagueSettings')}</span>
                    ) : null
                  }
                />
              ) : null}

              <Link
                to={leaderboardLink}
                onClick={handleLeaderboardClick}
                className="nav-pill-button"
              >
                <Trophy size={14} />
                <span>{t('nav.leaderboard')}</span>
              </Link>

              {user ? (
                <Link
                  to="/leaderboard/global"
                  className="nav-pill-button"
                >
                  <Trophy size={14} />
                  <span>{t('nav.globalLeaderboard')}</span>
                </Link>
              ) : null}

              {user?.isAdmin ? (
                <Link
                  to="/admin"
                  className="nav-pill-button"
                >
                  {t('nav.admin')}
                </Link>
              ) : null}

              <button
                type="button"
                onClick={toggleTheme}
                className="nav-pill-button"
                aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
              </button>

              <div className="nav-segment">
                <button
                  onClick={() => setLanguage('en')}
                  className={`nav-segment-button ${
                    language === 'en'
                      ? 'is-active'
                      : ''
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('es')}
                  className={`nav-segment-button ${
                    language === 'es'
                      ? 'is-active'
                      : ''
                  }`}
                >
                  ES
                </button>
              </div>

              {user ? (
                <div className="flex items-center space-x-4 border-l border-white/10 pl-5">
                  <Link
                    to="/profile"
                    className="nav-profile-link"
                  >
                    <div className="surface-user-initial flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">
                      {user.name?.[0] || 'U'}
                    </div>
                    <span className="hidden xl:inline font-semibold">{user.name}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="nav-quiet-button"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3 border-l border-white/10 pl-5">
                  <Link
                    to="/login"
                    className="nav-quiet-button"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="sport-button rounded-full px-5 py-2.5 font-bold text-slate-950 transition"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>

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
                onClick={() => setIsOpen((current) => !current)}
                className="text-gray-300 hover:text-white"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {isOpen ? (
            <div className="md:hidden pb-5 space-y-4">
              <div className="sport-panel rounded-panel-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="sport-display text-lg text-white">{t('nav.tournaments')}</p>
                  <Link
                    to="/#active-tournaments"
                    onClick={handleTournamentsClick}
                    className="text-sm font-semibold text-emerald-300"
                  >
                    {t('nav.viewAll')}
                  </Link>
                </div>
                {tournamentQuickLinks.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('nav.noJoinedTournaments')}</p>
                ) : (
                  tournamentQuickLinks.map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => setIsOpen(false)}
                      className="block rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
                    >
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-slate-400">{item.subtitle}</p>
                    </Link>
                  ))
                )}
              </div>

              {user ? (
                <div className="sport-panel rounded-panel-sm p-4 space-y-3">
                  <p className="sport-display text-lg text-white">{t('nav.myLeagues')}</p>
                  {leagueQuickLinks.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('nav.noLeaguesYet')}</p>
                  ) : (
                    leagueQuickLinks.map((item) => (
                      <Link
                        key={item.id}
                        to={item.to}
                        onClick={() => setIsOpen(false)}
                        className="block rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
                      >
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-slate-400">{item.subtitle}</p>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <Link
                  to={leaderboardLink}
                  onClick={handleLeaderboardClick}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {t('nav.leaderboard')}
                </Link>
                {user ? (
                  <Link
                    to="/leaderboard/global"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                  >
                    {t('nav.globalLeaderboard')}
                  </Link>
                ) : null}
                {user?.isAdmin ? (
                  <Link
                    to="/admin"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                  >
                    {t('nav.admin')}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-2xl transition"
                >
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </button>
              </div>

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
          ) : null}
        </div>
      </div>
    </nav>
  );
}
