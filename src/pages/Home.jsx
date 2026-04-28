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
import {
  countTournamentMatches,
  formatClosingCountdown,
  getLocalizedName,
  getModeLabel,
  getModeRuleSections,
} from '../utils/tournament';
import { Button, DisplayText, Panel, Pill } from '../components/ui/DesignSystem';

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
  const featuredTournamentName = featuredTournament
    ? getLocalizedName(featuredTournament, language, featuredTournament.name)
    : t('home.featuredTournamentFallback');
  const featuredClosingDate = featuredTournament?.closingDate
    ? formatDate(featuredTournament.closingDate)
    : t('home.tbd');
  const featuredClosingCountdown = featuredTournament?.closingDate
    ? formatClosingCountdown(featuredTournament.closingDate, { formatNumber, t })
    : '';
  const featuredTournamentLink = featuredTournament ? `/tournament/${featuredTournament.id}` : '/';
  const featuredLeaderboardLink = featuredTournament ? `/leaderboard/${featuredTournament.id}` : '/';
  const featuredMatchCount = featuredTournament
    ? countTournamentMatches({
        groups: featuredTournament.groups || [],
        rounds: featuredTournament.rounds || [],
      })
    : 0;
  const modeRuleSections = getModeRuleSections({
    mode: featuredTournament?.mode,
    rules: featuredTournament?.rules,
    language,
    t,
  });
  const heroStats = [
    {
      label: t('home.metricPlayers'),
      value: formatNumber(featuredTournament?.participantCount || 0),
      icon: Users,
      tone: 'text-emerald-300',
    },
    {
      label: t('home.metricFormat'),
      value: `${featuredTournament?.groups?.length || 12}G`,
      icon: Shield,
      tone: 'text-amber-300',
    },
    {
      label: t('home.metricEvents'),
      value: formatNumber(featuredMatchCount),
      icon: CalendarDays,
      tone: 'text-violet-300',
    },
    {
      label: t('home.metricMax'),
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
      stepClassName: 'home-step-badge home-step-badge--primary',
    },
    {
      key: '02',
      title: t('home.step2Title'),
      description: t('home.step2Desc'),
      icon: Users,
      iconSurfaceClass: 'home-step-icon-warm',
      stepClassName: 'home-step-badge home-step-badge--warm',
    },
    {
      key: '03',
      title: t('home.step3Title'),
      description: t('home.step3Desc'),
      icon: Trophy,
      iconSurfaceClass: 'home-step-icon-cool',
      stepClassName: 'home-step-badge home-step-badge--cool',
    },
  ];

  return (
    <div className="ds-shell min-h-screen">
      <section className="ds-page pt-8 pb-10 md:pt-10 md:pb-12">
        <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_0.9fr] xl:gap-8">
          <div className="ds-panel-strong rounded-panel-2xl ds-panel-pad">
            <div className="relative z-10 flex flex-col">
              <div className="space-y-5">
                <div className="ds-pill ds-pill--compact text-emerald-200">
                  {featuredTournamentName}
                </div>
                <h1 className="ds-display max-w-4xl text-5xl leading-display-tight text-white md:text-7xl">
                  {t('home.tagline')}
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
                  {t('home.description')}
                </p>
              </div>

              {!user ? (
                <div className="home-hero-action-block">
                  <div className="home-hero-actions">
                    <Link
                      to="/register"
                      className="ds-button ds-button-primary home-hero-action w-full font-bold transition sm:w-auto"
                    >
                      {t('auth.register')}
                    </Link>
                    <Link
                      to="/login"
                      className="ds-button-secondary home-hero-action w-full font-bold transition sm:w-auto"
                    >
                      {t('auth.login')}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="home-hero-action-block">
                  <div className="home-hero-actions">
                    <Link
                      to={featuredTournamentLink}
                      className="ds-button ds-button-primary home-hero-action w-full font-bold transition sm:w-auto"
                    >
                      {t('home.enterPredictions')}
                    </Link>
                    <Link
                      to={featuredLeaderboardLink}
                      className="ds-button-secondary home-hero-action w-full font-bold transition sm:w-auto"
                    >
                      {t('nav.leaderboard')}
                    </Link>
                  </div>
                </div>
              )}

              <div className="home-hero-metrics max-w-4xl">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-5">
                {heroStats.map((stat) => {
                  const StatIcon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="ds-panel home-metric-tile rounded-3xl"
                    >
                      <div className={`home-metric-tile__kicker ${stat.tone}`}>
                        <StatIcon size={18} className="shrink-0" />
                        <span className="ds-pill max-w-full truncate">{stat.label}</span>
                      </div>
                      <div className="ds-display text-4xl leading-none tabular-nums text-white">
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
            <div className="ds-panel-strong home-featured-card rounded-panel-2xl">
              <div className="home-featured-header">
                <div>
                  <p className="ds-display mb-2 text-xs text-emerald-300">
                    {t('home.featuredTournament')}
                  </p>
                  <h2 className="text-2xl font-bold leading-tight text-white md:text-3xl">
                    {featuredTournamentName}
                  </h2>
                </div>
                <div className="home-featured-icon">
                  <Trophy size={22} />
                </div>
              </div>

              <div className="home-featured-details">
                <div className="home-featured-row">
                  <span className="home-featured-label">{t('home.currentMode')}</span>
                  <span className="home-featured-value">
                    {featuredTournament?.mode
                      ? getModeLabel(featuredTournament.mode, language)
                      : '--'}
                  </span>
                </div>
                <div className="home-featured-row">
                  <span className="home-featured-label">{t('tournament.access')}</span>
                  <span className="home-featured-value">
                    {featuredTournament?.accessType === 'private'
                      ? t('home.privateTournament')
                      : t('home.publicTournament')}
                  </span>
                </div>
                <div className="home-featured-row">
                  <span className="home-featured-label">{t('tournament.closingDate')}</span>
                  <span className="home-featured-value">
                    {featuredClosingDate}
                    {featuredClosingCountdown ? (
                      <span className="home-featured-subvalue">{t('home.tournamentEndsIn')} {featuredClosingCountdown}</span>
                    ) : null}
                  </span>
                </div>
                <div className="home-featured-row">
                  <span className="home-featured-label">{t('tournament.prizes')}</span>
                  <span className="home-featured-value">
                    {featuredTournament?.prizesEnabled
                      ? t('home.prizesEnabled')
                      : t('home.prizesDisabled')}
                  </span>
                </div>
                <div className="home-featured-row">
                  <span className="home-featured-label">{t('tournament.events')}</span>
                  <span className="home-featured-value">{formatNumber(featuredMatchCount)}</span>
                </div>
              </div>

              <div className="home-featured-actions">
                <Link
                  to={featuredTournamentLink}
                  className="ds-button ds-button-primary home-featured-action font-bold transition"
                >
                  {featuredTournament ? t('home.enterPredictions') : t('nav.tournaments')}
                </Link>
                <Link
                  to={featuredLeaderboardLink}
                  className="ds-button-secondary home-featured-action font-bold transition"
                >
                  {t('nav.leaderboard')}
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-4">
              <div className="ds-panel home-metric-tile rounded-panel-lg">
                <div className="home-metric-tile__kicker text-emerald-300">
                  <CalendarDays size={18} className="shrink-0" />
                  <span className="ds-pill">{t('tournament.closingDate')}</span>
                </div>
                <p className="ds-display text-3xl leading-none tabular-nums text-white">
                  {featuredClosingDate}
                </p>
              </div>
              <div className="ds-panel home-metric-tile rounded-panel-lg">
                <div className="home-metric-tile__kicker text-amber-300">
                  <Trophy size={18} className="shrink-0" />
                  <span className="ds-pill">{t('home.maximumScore')}</span>
                </div>
                <p className="ds-display text-3xl leading-none tabular-nums text-white">
                  {featuredTournament?.rules?.totalMaximumPoints
                    ? formatNumber(featuredTournament.rules.totalMaximumPoints)
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ds-page pt-2 pb-10 md:pt-3 md:pb-12">
        <div className="grid gap-6 xl:gap-8">
          <div className="ds-panel-strong rounded-panel-2xl ds-panel-pad">
            <div className="mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-3">
              <h2 className="ds-display min-w-0 flex-1 text-4xl text-white md:text-5xl">
                {t('home.howItWorks')}
              </h2>
              <div className="hidden shrink-0 md:flex md:pt-1">
                <span className="ds-pill text-emerald-200">{t('home.matchFlow')}</span>
              </div>
            </div>

            <div className="home-step-grid">
              {steps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className="ds-panel home-step-card rounded-panel-sm"
                  >
                    <div className="flex h-full flex-col gap-5">
                      <div className="flex items-center justify-between gap-4">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconSurfaceClass}`}
                        >
                          <StepIcon size={28} />
                        </div>
                        <div className={`ds-pill ${step.stepClassName}`}>{step.key}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="ds-display mb-3 text-2xl leading-snug text-white">
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

          <div className="ds-panel-strong home-rules-panel rounded-panel-2xl">
            <div className="home-rules-header">
              <div className="min-w-0 md:max-w-[min(100%,42rem)]">
                <h2 className="ds-display home-rules-title text-white">
                  {t('home.scoringRules')}
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-slate-400">
                  {modeRuleSections?.summary?.note || t('home.groupStageRuleExact')}
                </p>
              </div>
              {modeRuleSections?.summary?.value ? (
                <div className="shrink-0 md:max-w-[min(100%,16rem)] md:text-right">
                  <span className="ds-pill inline-flex text-emerald-200">
                    {modeRuleSections.summary.value}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="home-rules-layout">
              <div className="ds-panel home-rule-card home-rule-card--primary rounded-panel-lg">
                <h3 className="ds-display home-rule-card__title">
                  {modeRuleSections?.primary?.title || t('home.groupStage')}
                </h3>
                <div className="home-rule-card__body">
                  {(modeRuleSections?.primary?.lines || []).map((line) => (
                    <p key={line} className="home-rule-card__line">
                      {line}
                    </p>
                  ))}
                  {modeRuleSections?.primary?.footer ? (
                    <p className="home-rule-card__footer">
                      {modeRuleSections.primary.footer}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="home-knockout-grid">
                {modeRuleSections?.secondary?.length > 0 ? (
                  modeRuleSections.secondary.map((section) => (
                    <div
                      key={section.id}
                      className="ds-panel home-rule-card rounded-panel-lg"
                    >
                      <h3 className="ds-display home-rule-card__title">
                        {section.title}
                      </h3>
                      <div className="home-rule-card__body">
                        {section.lines.map((line, index) => (
                          <p
                            key={line}
                            className={`home-rule-card__line ${index === 0 ? 'home-rule-card__line--lead' : ''}`}
                          >
                            {line}
                          </p>
                        ))}
                        {section.footer ? (
                          <p className="home-rule-card__footer">
                            {section.footer}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="ds-panel home-rule-card rounded-panel-lg sm:col-span-2">
                    <h3 className="ds-display home-rule-card__title">
                      {t('home.knockout')}
                    </h3>
                    <p className="home-rule-card__line">
                      {t('home.enterPredictions')} {t('home.currentMode').toLowerCase()}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="active-tournaments" className="ds-page pt-0 pb-16 md:pb-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h2 className="ds-display text-4xl md:text-5xl text-white">
              {t('home.activeTournaments')}
            </h2>
            <p className="text-slate-400 mt-3 max-w-2xl">
              {t('home.activeTournamentsHelp')}
            </p>
          </div>
          <div className="hidden md:flex ds-pill text-emerald-200">
            {formatNumber(tournaments.length)} {t('home.liveBoards').toLowerCase()}
          </div>
        </div>

        {loading ? (
          <div className="ds-panel rounded-panel-lg ds-panel-pad text-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : tournaments.length === 0 ? (
          <Panel variant="strong" padding="normal" radius="xl" className="home-tournament-empty">
            <div className="home-tournament-empty__copy">
              <Pill className="text-emerald-200">
                {t('home.tournamentCenter')}
              </Pill>
              <DisplayText as="h3" className="text-3xl md:text-4xl text-white">
                {t('home.noTournaments')}
              </DisplayText>
              <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
                {t('home.description')}
              </p>
            </div>

            <div className="home-tournament-empty__aside">
              <Panel radius="md" className="home-tournament-empty__stat">
                <p className="text-xs uppercase tracking-overline text-slate-500 mb-2">
                  {t('home.privateLeagues')}
                </p>
                <p className="ds-display text-2xl text-white">{t('common.enabled')}</p>
              </Panel>
              <Panel radius="md" className="home-tournament-empty__stat">
                <p className="text-xs uppercase tracking-overline text-slate-500 mb-2">
                  {t('home.prizePools')}
                </p>
                <p className="ds-display text-2xl text-white">{t('home.optional')}</p>
              </Panel>
              <Panel radius="md" className="home-tournament-empty__cta">
                <Button
                  as={Link}
                  to="/"
                  variant="secondary"
                  className="home-tournament-empty__action"
                >
                  <span>{t('nav.tournaments')}</span>
                  <ArrowRight size={18} />
                </Button>
              </Panel>
            </div>
          </Panel>
        ) : (
          <div className="home-tournament-grid">
            {tournaments.map((tournament) => {
              const tournamentMatchCount = countTournamentMatches({
                groups: tournament.groups || [],
                rounds: tournament.rounds || [],
              });

              return (
              <Link
                key={tournament.id}
                to={`/tournament/${tournament.id}`}
                className="ds-panel-strong home-tournament-card rounded-panel-xl"
              >
                <div className="home-tournament-main min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="ds-pill ds-pill--compact text-emerald-200">
                      {tournament.accessType === 'private'
                        ? t('home.privateTournament')
                        : t('home.publicTournament')}
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300 md:hidden">
                      <Trophy size={22} />
                    </div>
                  </div>
                  <h3 className="ds-display home-tournament-card__title">
                    {getLocalizedName(tournament, language, tournament.name)}
                  </h3>
                </div>

                <div className="home-tournament-info min-w-0">
                  <div className="home-tournament-stats">
                    <div className="home-tournament-stat">
                      <p className="mb-2 text-xs uppercase tracking-overline text-slate-500">
                        {t('tournament.participants')}
                      </p>
                      <p className="ds-display text-3xl tabular-nums text-white">
                        {formatNumber(tournament.participantCount || 0)}
                      </p>
                    </div>
                    <div className="home-tournament-stat">
                      <p className="mb-2 text-xs uppercase tracking-overline text-slate-500">
                        {t('tournament.events')}
                      </p>
                      <p className="ds-display text-3xl tabular-nums text-white">
                        {formatNumber(tournamentMatchCount)}
                      </p>
                    </div>
                    <div className="home-tournament-stat">
                      <p className="mb-2 text-xs uppercase tracking-overline text-slate-500">
                        {t('home.maximumScore')}
                      </p>
                      <p className="ds-display text-3xl tabular-nums text-white">
                        {tournament.rules?.totalMaximumPoints
                          ? formatNumber(tournament.rules.totalMaximumPoints)
                          : '--'}
                      </p>
                    </div>
                  </div>

                  <div className="home-tournament-meta">
                    <p>
                      <strong>
                        {t('home.currentMode')}:
                      </strong>{' '}
                      {getModeLabel(tournament.mode, language)}
                    </p>
                    <p>
                      <strong>
                        {t('tournament.closingDate')}:
                      </strong>{' '}
                      {tournament.closingDate
                        ? formatDate(tournament.closingDate)
                        : t('home.tbd')}
                      {tournament.closingDate ? (
                        <span className="home-tournament-meta__detail">
                          {' '}
                          ({t('home.tournamentEndsIn')} {formatClosingCountdown(tournament.closingDate, { formatNumber, t })})
                        </span>
                      ) : null}
                    </p>
                    <p>
                      <strong>
                        {t('tournament.prizes')}:
                      </strong>{' '}
                      {tournament.prizesEnabled
                        ? t('home.prizesEnabled')
                        : t('home.prizesDisabled')}
                    </p>
                  </div>
                </div>

                <div className="home-tournament-cta">
                  <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300 md:flex">
                    <Trophy size={22} />
                  </div>
                  <span className="ds-button ds-button-primary home-tournament-action w-full font-bold transition">
                    {t('home.enterPredictions')}
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
