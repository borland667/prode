import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Shield,
  TimerReset,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get } from '../utils/api';
import { getLocalizedName, getModeLabel, getModeRuleSections } from '../utils/tournament';

export default function Home() {
  const { language, t, formatDate, formatNumber } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const data = await get('/tournaments?status=active,upcoming');
        setTournaments(data || []);
      } catch (err) {
        console.error('Failed to fetch tournaments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.replace('#', '');
    const scrollToTarget = () => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const timeoutId = window.setTimeout(scrollToTarget, 50);
    return () => window.clearTimeout(timeoutId);
  }, [location.hash, loading]);

  const featuredTournament = tournaments[0] || null;
  const featuredClosingDate = featuredTournament?.closingDate
    ? formatDate(featuredTournament.closingDate)
    : 'TBD';
  const featuredTournamentLink = featuredTournament ? `/tournament/${featuredTournament.id}` : '/';
  const featuredLeaderboardLink = featuredTournament ? `/leaderboard/${featuredTournament.id}` : '/';
  const modeRuleSections = getModeRuleSections({
    mode: featuredTournament?.mode,
    rules: featuredTournament?.rules,
    language,
    t,
  });
  const heroStats = [
    {
      label: 'Players',
      value: formatNumber(featuredTournament?.participantCount || 0),
      icon: Users,
      tone: 'text-emerald-300',
    },
    {
      label: 'Format',
      value: `${featuredTournament?.groups?.length || 12}G`,
      icon: Shield,
      tone: 'text-amber-300',
    },
    {
      label: 'Max',
      value: featuredTournament?.rules?.totalMaximumPoints
        ? formatNumber(featuredTournament.rules.totalMaximumPoints)
        : '--',
      icon: TimerReset,
      tone: 'text-cyan-300',
    },
  ];
  const steps = [
    {
      key: '01',
      title: t('home.step1Title'),
      description: t('home.step1Desc'),
      icon: Zap,
      iconClassName: 'from-emerald-300 to-emerald-500',
      stepClassName: 'text-emerald-200',
    },
    {
      key: '02',
      title: t('home.step2Title'),
      description: t('home.step2Desc'),
      icon: Users,
      iconClassName: 'from-amber-300 to-orange-500',
      stepClassName: 'text-amber-100',
    },
    {
      key: '03',
      title: t('home.step3Title'),
      description: t('home.step3Desc'),
      icon: Trophy,
      iconClassName: 'from-cyan-300 to-blue-500',
      stepClassName: 'text-cyan-100',
    },
  ];

  return (
    <div className="sport-shell min-h-screen">
      <section className="px-4 pt-10 pb-10 md:pt-14 md:pb-12 max-w-7xl mx-auto">
        <div className="grid xl:grid-cols-[1.3fr_0.92fr] gap-6 items-stretch">
          <div className="sport-panel-strong sport-pitch rounded-[2rem] px-6 py-8 md:px-10 md:py-10 overflow-hidden">
            <div className="relative z-10 flex h-full flex-col">
              <div className="score-pill mb-6 text-emerald-200">
                {getLocalizedName(featuredTournament, language, 'World Cup 2026')}
              </div>
              <h1 className="sport-display text-5xl md:text-7xl leading-[0.92] text-white mb-5 max-w-4xl">
                {t('home.tagline')}
              </h1>
              <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
                {t('home.description')}
              </p>

              {!user ? (
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    to="/register"
                    className="sport-button px-8 py-4 rounded-full text-slate-950 font-bold text-center hover:scale-[1.02] transition"
                  >
                    {t('auth.register')}
                  </Link>
                  <Link
                    to="/login"
                    className="sport-button-secondary px-8 py-4 rounded-full text-emerald-300 font-bold text-center hover:bg-white/5 transition"
                  >
                    {t('auth.login')}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    to={featuredTournamentLink}
                    className="sport-button px-8 py-4 rounded-full text-slate-950 font-bold text-center hover:scale-[1.02] transition"
                  >
                    {t('home.enterPredictions')}
                  </Link>
                  <Link
                    to={featuredLeaderboardLink}
                    className="sport-button-secondary px-8 py-4 rounded-full text-emerald-300 font-bold text-center hover:bg-white/5 transition"
                  >
                    {t('nav.leaderboard')}
                  </Link>
                </div>
              )}

              <div className="mt-auto grid sm:grid-cols-3 gap-4">
                {heroStats.map((stat) => {
                  const StatIcon = stat.icon;

                  return (
                    <div key={stat.label} className="sport-panel rounded-3xl p-5">
                      <div className={`flex items-center gap-3 mb-3 ${stat.tone}`}>
                        <StatIcon size={18} />
                        <span className="score-pill">{stat.label}</span>
                      </div>
                      <div className="sport-display text-4xl text-white">
                        {stat.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="sport-panel-strong rounded-[2rem] p-7">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="sport-display text-sm text-emerald-300 mb-2">
                    Featured Tournament
                  </p>
                  <h2 className="text-3xl font-bold text-white">
                    {getLocalizedName(featuredTournament, language, 'World Cup 2026')}
                  </h2>
                </div>
                <Trophy size={28} className="text-amber-300" />
              </div>

              <div className="space-y-4 mb-6">
                <div className="sport-divider flex items-center justify-between pb-4">
                  <span className="text-slate-400">{t('home.currentMode')}</span>
                  <span className="text-white font-semibold text-right max-w-[12rem]">
                    {featuredTournament?.mode
                      ? getModeLabel(featuredTournament.mode, language)
                      : '--'}
                  </span>
                </div>
                <div className="sport-divider flex items-center justify-between pb-4">
                  <span className="text-slate-400">{t('tournament.access')}</span>
                  <span className="text-white font-semibold">
                    {featuredTournament?.accessType === 'private'
                      ? t('home.privateTournament')
                      : t('home.publicTournament')}
                  </span>
                </div>
                <div className="sport-divider flex items-center justify-between pb-4">
                  <span className="text-slate-400">{t('tournament.closingDate')}</span>
                  <span className="text-white font-semibold">{featuredClosingDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{t('tournament.prizes')}</span>
                  <span className="text-white font-semibold">
                    {featuredTournament?.prizesEnabled
                      ? t('home.prizesEnabled')
                      : t('home.prizesDisabled')}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Link
                  to={featuredTournamentLink}
                  className="sport-button w-full px-4 py-3 rounded-full text-slate-950 font-bold text-center transition hover:scale-[1.01]"
                >
                  {featuredTournament ? t('home.enterPredictions') : t('nav.tournaments')}
                </Link>
                <Link
                  to={featuredLeaderboardLink}
                  className="sport-button-secondary w-full px-4 py-3 rounded-full text-emerald-300 font-bold text-center hover:bg-white/5 transition"
                >
                  {t('nav.leaderboard')}
                </Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sport-panel rounded-[1.75rem] p-6">
                <div className="flex items-center gap-3 text-emerald-300 mb-4">
                  <CalendarDays size={18} />
                  <span className="score-pill">{t('tournament.closingDate')}</span>
                </div>
                <p className="sport-display text-3xl text-white">{featuredClosingDate}</p>
              </div>
              <div className="sport-panel rounded-[1.75rem] p-6">
                <div className="flex items-center gap-3 text-amber-300 mb-4">
                  <Trophy size={18} />
                  <span className="score-pill">{t('home.maximumScore')}</span>
                </div>
                <p className="sport-display text-3xl text-white">
                  {featuredTournament?.rules?.totalMaximumPoints
                    ? formatNumber(featuredTournament.rules.totalMaximumPoints)
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 md:pb-12 max-w-7xl mx-auto">
        <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-6 items-start">
          <div className="sport-panel-strong rounded-[2rem] p-7 md:p-8">
            <div className="flex items-end justify-between gap-6 mb-8">
              <h2 className="sport-display text-4xl md:text-5xl text-white">
                {t('home.howItWorks')}
              </h2>
              <div className="hidden md:flex score-pill text-emerald-200">
                Match Flow
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className="sport-panel rounded-[1.5rem] p-5 md:p-6 grid sm:grid-cols-[auto_1fr] gap-5 items-center"
                  >
                    <div className="flex items-center gap-4 sm:block">
                      <div className={`w-14 h-14 bg-gradient-to-br ${step.iconClassName} rounded-2xl flex items-center justify-center text-slate-950 sm:mb-4`}>
                        <StepIcon size={28} />
                      </div>
                      <div className={`score-pill ${step.stepClassName}`}>{step.key}</div>
                    </div>
                    <div>
                      <h3 className="sport-display text-2xl text-white mb-3">
                        {step.title}
                      </h3>
                      <p className="text-slate-300 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sport-panel-strong rounded-[2rem] p-7 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="sport-display text-4xl md:text-5xl text-white">
                  {t('home.scoringRules')}
                </h2>
                <p className="text-slate-400 mt-3 max-w-2xl">
                  {modeRuleSections?.summary?.note || t('home.groupStageRuleExact')}
                </p>
              </div>
              {modeRuleSections?.summary?.value ? (
                <div className="score-pill text-emerald-200">
                  {modeRuleSections.summary.value}
                </div>
              ) : null}
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-4">
              <div className="sport-panel rounded-[1.75rem] p-6 md:p-7">
                <h3 className="sport-display text-2xl text-emerald-300 mb-4">
                  {modeRuleSections?.primary?.title || t('home.groupStage')}
                </h3>
                <div className="space-y-3 text-slate-300">
                  {(modeRuleSections?.primary?.lines || []).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {modeRuleSections?.primary?.footer ? (
                    <p className="text-white pt-3 font-semibold">
                      {modeRuleSections.primary.footer}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 content-start">
                {modeRuleSections?.secondary?.length > 0 ? (
                  modeRuleSections.secondary.map((section) => (
                    <div
                      key={section.id}
                      className="sport-panel rounded-[1.75rem] p-6"
                    >
                      <h3 className="sport-display text-xl text-emerald-300 mb-4">
                        {section.title}
                      </h3>
                      <div className="space-y-2">
                        {section.lines.map((line, index) => (
                          <p
                            key={line}
                            className={index === 0 ? 'text-slate-200 text-lg' : 'text-slate-400'}
                          >
                            {line}
                          </p>
                        ))}
                        {section.footer ? (
                          <p className="text-white mt-3 font-semibold">
                            {section.footer}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sport-panel rounded-[1.75rem] p-6 sm:col-span-2">
                    <h3 className="sport-display text-xl text-emerald-300 mb-4">
                      Knockout
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      {t('home.enterPredictions')} {t('home.currentMode').toLowerCase()}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="active-tournaments" className="px-4 pb-16 md:pb-20 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h2 className="sport-display text-4xl md:text-5xl text-white">
              {t('home.activeTournaments')}
            </h2>
            <p className="text-slate-400 mt-3 max-w-2xl">
              {featuredTournament
                ? getLocalizedName(featuredTournament, language, featuredTournament.name)
                : t('home.noTournaments')}
            </p>
          </div>
          <div className="hidden md:flex score-pill text-emerald-200">
            {formatNumber(tournaments.length)} live boards
          </div>
        </div>

        {loading ? (
          <div className="sport-panel rounded-[1.75rem] p-8 text-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="sport-panel-strong rounded-[1.9rem] p-8 md:p-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
            <div>
              <div className="score-pill mb-5 text-emerald-200">
                Tournament Center
              </div>
              <h3 className="sport-display text-3xl md:text-4xl text-white mb-4">
                {t('home.noTournaments')}
              </h3>
              <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
                {t('home.description')}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sport-panel rounded-[1.5rem] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Private Leagues
                </p>
                <p className="sport-display text-2xl text-white">On</p>
              </div>
              <div className="sport-panel rounded-[1.5rem] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Prize Pools
                </p>
                <p className="sport-display text-2xl text-white">Optional</p>
              </div>
              <div className="sport-panel rounded-[1.5rem] p-5 sm:col-span-2">
                <Link
                  to="/"
                  className="flex items-center justify-between text-white font-semibold hover:text-emerald-300 transition"
                >
                  <span>{t('nav.tournaments')}</span>
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                to={`/tournament/${tournament.id}`}
                className="sport-panel-strong rounded-[1.9rem] p-7 hover:-translate-y-1 transition group overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="score-pill mb-3 text-emerald-200">
                      {tournament.accessType === 'private'
                        ? t('home.privateTournament')
                        : t('home.publicTournament')}
                    </div>
                    <h3 className="sport-display text-3xl text-white group-hover:text-emerald-300 transition">
                      {getLocalizedName(tournament, language, tournament.name)}
                    </h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-300">
                    <Trophy size={24} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                      {t('tournament.participants')}
                    </p>
                    <p className="sport-display text-3xl text-white">
                      {formatNumber(tournament.participantCount || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                      {t('home.maximumScore')}
                    </p>
                    <p className="sport-display text-3xl text-white">
                      {tournament.rules?.totalMaximumPoints
                        ? formatNumber(tournament.rules.totalMaximumPoints)
                        : '--'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-7 text-slate-400">
                  <p>
                    <span className="font-semibold text-white">
                      {t('home.currentMode')}:
                    </span>{' '}
                    {getModeLabel(tournament.mode, language)}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('tournament.closingDate')}:
                    </span>{' '}
                    {tournament.closingDate
                      ? formatDate(tournament.closingDate)
                      : 'TBD'}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('tournament.prizes')}:
                    </span>{' '}
                    {tournament.prizesEnabled
                      ? t('home.prizesEnabled')
                      : t('home.prizesDisabled')}
                  </p>
                </div>
                <button className="sport-button w-full px-4 py-3 rounded-full text-slate-950 font-bold transition hover:scale-[1.01]">
                  {t('home.enterPredictions')}
                </button>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
