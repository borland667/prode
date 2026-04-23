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
      iconSurfaceClass: 'home-step-icon-primary',
      stepClassName: 'text-emerald-200',
    },
    {
      key: '02',
      title: t('home.step2Title'),
      description: t('home.step2Desc'),
      icon: Users,
      iconSurfaceClass: 'home-step-icon-warm',
      stepClassName: 'text-amber-100',
    },
    {
      key: '03',
      title: t('home.step3Title'),
      description: t('home.step3Desc'),
      icon: Trophy,
      iconSurfaceClass: 'home-step-icon-cool',
      stepClassName: 'text-cyan-100',
    },
  ];

  return (
    <div className="sport-shell min-h-screen">
      <section className="page-shell pt-10 pb-12 md:pt-14 md:pb-16">
        <div className="grid items-start gap-8 xl:grid-cols-[1.3fr_0.92fr] xl:gap-10">
          <div className="sport-panel-strong rounded-panel-2xl page-panel-pad">
            <div className="relative z-10 flex flex-col">
              <div className="space-y-5">
                <div className="score-pill text-emerald-200">
                  {getLocalizedName(featuredTournament, language, 'World Cup 2026')}
                </div>
                <h1 className="sport-display max-w-4xl text-5xl leading-display-tight text-white md:text-7xl">
                  {t('home.tagline')}
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
                  {t('home.description')}
                </p>
              </div>

              {!user ? (
                <div className="mt-8 max-w-2xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-5">
                    <Link
                      to="/register"
                      className="sport-button w-full justify-center rounded-full px-8 py-4 text-center font-bold text-slate-950 transition sm:inline-flex sm:w-auto"
                    >
                      {t('auth.register')}
                    </Link>
                    <Link
                      to="/login"
                      className="sport-button-secondary w-full justify-center rounded-full px-8 py-4 text-center font-bold text-emerald-300 transition hover:bg-white/5 sm:inline-flex sm:w-auto"
                    >
                      {t('auth.login')}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-8 max-w-2xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-5">
                    <Link
                      to={featuredTournamentLink}
                      className="sport-button w-full justify-center rounded-full px-8 py-4 text-center font-bold text-slate-950 transition sm:inline-flex sm:w-auto"
                    >
                      {t('home.enterPredictions')}
                    </Link>
                    <Link
                      to={featuredLeaderboardLink}
                      className="sport-button-secondary w-full justify-center rounded-full px-8 py-4 text-center font-bold text-emerald-300 transition hover:bg-white/5 sm:inline-flex sm:w-auto"
                    >
                      {t('nav.leaderboard')}
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-12 max-w-4xl border-t border-white/10 pt-12">
                <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
                {heroStats.map((stat) => {
                  const StatIcon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="sport-panel home-metric-tile rounded-3xl"
                    >
                      <div className={`home-metric-tile__kicker ${stat.tone}`}>
                        <StatIcon size={18} className="shrink-0" />
                        <span className="score-pill max-w-full truncate">{stat.label}</span>
                      </div>
                      <div className="sport-display text-4xl leading-none tabular-nums text-white">
                        {stat.value}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 xl:gap-6">
            <div className="sport-panel-strong rounded-panel-2xl page-panel-pad-md pb-8 md:pb-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <p className="sport-display mb-3 text-sm text-emerald-300">
                    Featured Tournament
                  </p>
                  <h2 className="text-3xl font-bold text-white">
                    {getLocalizedName(featuredTournament, language, 'World Cup 2026')}
                  </h2>
                </div>
                <Trophy size={28} className="shrink-0 text-amber-300" />
              </div>

              <div className="mb-8 space-y-0">
                <div className="sport-divider flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-400">{t('home.currentMode')}</span>
                  <span className="max-w-48 text-right font-semibold text-white">
                    {featuredTournament?.mode
                      ? getModeLabel(featuredTournament.mode, language)
                      : '--'}
                  </span>
                </div>
                <div className="sport-divider flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-400">{t('tournament.access')}</span>
                  <span className="text-right font-semibold text-white">
                    {featuredTournament?.accessType === 'private'
                      ? t('home.privateTournament')
                      : t('home.publicTournament')}
                  </span>
                </div>
                <div className="sport-divider flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-400">{t('tournament.closingDate')}</span>
                  <span className="text-right font-semibold text-white">{featuredClosingDate}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-400">{t('tournament.prizes')}</span>
                  <span className="text-right font-semibold text-white">
                    {featuredTournament?.prizesEnabled
                      ? t('home.prizesEnabled')
                      : t('home.prizesDisabled')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Link
                  to={featuredTournamentLink}
                  className="sport-button flex w-full min-h-[3.5rem] items-center justify-center !whitespace-normal rounded-full px-8 py-4 text-center text-base font-bold leading-snug text-slate-950 transition"
                >
                  {featuredTournament ? t('home.enterPredictions') : t('nav.tournaments')}
                </Link>
                <Link
                  to={featuredLeaderboardLink}
                  className="sport-button-secondary flex w-full min-h-[3.5rem] items-center justify-center !whitespace-normal rounded-full px-8 py-4 text-center text-base font-bold leading-snug text-emerald-300 transition hover:bg-white/5"
                >
                  {t('nav.leaderboard')}
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-4">
              <div className="sport-panel home-metric-tile rounded-panel-lg">
                <div className="home-metric-tile__kicker text-emerald-300">
                  <CalendarDays size={18} className="shrink-0" />
                  <span className="score-pill">{t('tournament.closingDate')}</span>
                </div>
                <p className="sport-display text-3xl leading-none tabular-nums text-white">
                  {featuredClosingDate}
                </p>
              </div>
              <div className="sport-panel home-metric-tile rounded-panel-lg">
                <div className="home-metric-tile__kicker text-amber-300">
                  <Trophy size={18} className="shrink-0" />
                  <span className="score-pill">{t('home.maximumScore')}</span>
                </div>
                <p className="sport-display text-3xl leading-none tabular-nums text-white">
                  {featuredTournament?.rules?.totalMaximumPoints
                    ? formatNumber(featuredTournament.rules.totalMaximumPoints)
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pt-4 pb-12 md:pt-6 md:pb-16">
        <div className="grid items-start gap-8 xl:grid-cols-[1.3fr_0.92fr] xl:gap-10">
          <div className="sport-panel-strong rounded-panel-2xl page-panel-pad page-panel-pad-loft-top">
            <div className="mb-12 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-3">
              <h2 className="sport-display min-w-0 flex-1 text-4xl text-white md:text-5xl">
                {t('home.howItWorks')}
              </h2>
              <div className="hidden shrink-0 md:flex md:pt-1">
                <span className="score-pill text-emerald-200">Match Flow</span>
              </div>
            </div>

            <div className="space-y-6 md:space-y-7">
              {steps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className="sport-panel rounded-panel-sm p-6 md:p-7"
                  >
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                      <div className="flex shrink-0 items-center gap-4 sm:w-24 sm:flex-col sm:items-center sm:gap-3">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconSurfaceClass}`}
                        >
                          <StepIcon size={28} />
                        </div>
                        <div className={`score-pill ${step.stepClassName}`}>{step.key}</div>
                      </div>
                      <div className="min-w-0 flex-1 sm:pt-0.5">
                        <h3 className="sport-display mb-3 text-2xl leading-snug text-white">
                          {step.title}
                        </h3>
                        <p className="leading-relaxed text-slate-300">{step.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sport-panel-strong rounded-panel-2xl page-panel-pad page-panel-pad-loft-top">
            <div className="mb-10 flex flex-col gap-5 md:mb-12 md:flex-row md:items-start md:justify-between md:gap-8">
              <div className="min-w-0 md:max-w-[min(100%,42rem)]">
                <h2 className="sport-display text-4xl leading-tight text-white md:text-5xl">
                  {t('home.scoringRules')}
                </h2>
                <p className="mt-4 max-w-2xl leading-relaxed text-slate-400">
                  {modeRuleSections?.summary?.note || t('home.groupStageRuleExact')}
                </p>
              </div>
              {modeRuleSections?.summary?.value ? (
                <div className="shrink-0 md:max-w-[min(100%,16rem)] md:pt-1 md:text-right">
                  <span className="score-pill inline-flex text-emerald-200">
                    {modeRuleSections.summary.value}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
              <div className="sport-panel flex min-h-0 flex-col rounded-panel-lg p-7 md:p-9">
                <h3 className="sport-display mb-5 text-2xl leading-snug text-emerald-300">
                  {modeRuleSections?.primary?.title || t('home.groupStage')}
                </h3>
                <div className="space-y-3.5 text-slate-300">
                  {(modeRuleSections?.primary?.lines || []).map((line) => (
                    <p key={line} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                  {modeRuleSections?.primary?.footer ? (
                    <p className="mt-3 border-t border-white/10 pt-5 font-semibold leading-snug text-white">
                      {modeRuleSections.primary.footer}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 sm:gap-5">
                {modeRuleSections?.secondary?.length > 0 ? (
                  modeRuleSections.secondary.map((section) => (
                    <div
                      key={section.id}
                      className="sport-panel flex h-full min-h-0 flex-col rounded-panel-lg p-6 md:p-8"
                    >
                      <div className="mb-4 min-h-[3.25rem] md:min-h-[3.75rem]">
                        <h3 className="sport-display text-xl leading-snug text-emerald-300">
                          {section.title}
                        </h3>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                        {section.lines.map((line, index) => (
                          <p
                            key={line}
                            className={`leading-relaxed ${index === 0 ? 'text-lg text-slate-200' : 'text-slate-400'}`}
                          >
                            {line}
                          </p>
                        ))}
                        {section.footer ? (
                          <p className="mt-auto border-t border-white/10 pt-5 font-semibold leading-snug text-white">
                            {section.footer}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sport-panel flex flex-col rounded-panel-lg p-7 sm:col-span-2 md:p-9">
                    <h3 className="sport-display mb-4 text-xl leading-snug text-emerald-300">
                      Knockout
                    </h3>
                    <p className="leading-relaxed text-slate-300">
                      {t('home.enterPredictions')} {t('home.currentMode').toLowerCase()}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="active-tournaments" className="page-shell pt-0 pb-16 md:pb-20">
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
          <div className="sport-panel rounded-panel-lg page-panel-pad text-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="sport-panel-strong grid items-center gap-8 rounded-panel-xl page-panel-pad lg:grid-cols-[1.15fr_0.85fr]">
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
              <div className="sport-panel rounded-panel-sm p-5">
                <p className="text-xs uppercase tracking-overline text-slate-500 mb-2">
                  Private Leagues
                </p>
                <p className="sport-display text-2xl text-white">On</p>
              </div>
              <div className="sport-panel rounded-panel-sm p-5">
                <p className="text-xs uppercase tracking-overline text-slate-500 mb-2">
                  Prize Pools
                </p>
                <p className="sport-display text-2xl text-white">Optional</p>
              </div>
              <div className="sport-panel rounded-panel-sm p-5 sm:col-span-2">
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
                className="sport-panel-strong group flex min-h-0 flex-col rounded-panel-xl page-panel-pad-md pb-8 transition hover:-translate-y-1 md:pb-9"
              >
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div>
                    <div className="score-pill mb-4 text-emerald-200">
                      {tournament.accessType === 'private'
                        ? t('home.privateTournament')
                        : t('home.publicTournament')}
                    </div>
                    <h3 className="sport-display text-3xl text-white group-hover:text-emerald-300 transition">
                      {getLocalizedName(tournament, language, tournament.name)}
                    </h3>
                  </div>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300">
                    <Trophy size={24} />
                  </div>
                </div>

                <div className="mb-7 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-5">
                    <p className="mb-3 text-xs uppercase tracking-overline text-slate-500">
                      {t('tournament.participants')}
                    </p>
                    <p className="sport-display text-3xl tabular-nums text-white">
                      {formatNumber(tournament.participantCount || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-5">
                    <p className="mb-3 text-xs uppercase tracking-overline text-slate-500">
                      {t('home.maximumScore')}
                    </p>
                    <p className="sport-display text-3xl tabular-nums text-white">
                      {tournament.rules?.totalMaximumPoints
                        ? formatNumber(tournament.rules.totalMaximumPoints)
                        : '--'}
                    </p>
                  </div>
                </div>

                <div className="mb-8 space-y-4 text-slate-400">
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
                <span className="sport-button sport-button--subtle-interaction mt-auto w-full rounded-full px-5 py-3.5 text-center text-base font-bold text-slate-950 transition">
                  {t('home.enterPredictions')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
