import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Trophy, TrendingUp } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get } from '../utils/api';
import { getModeLabel, getRoundLabel } from '../utils/tournament';

export default function Home() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
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

  const featuredTournament = tournaments[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Hero Section */}
      <section className="px-4 py-20 md:py-32 text-center max-w-6xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          {t('home.tagline')}
        </h1>
        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
          {t('home.description')}
        </p>

        {!user && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
            >
              {t('auth.register')}
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white transition"
            >
              {t('auth.login')}
            </Link>
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="px-4 py-20 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          {t('home.howItWorks')}
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500 transition">
            <div className="w-16 h-16 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900 mb-6 mx-auto">
              <Zap size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-4">
              {t('home.step1Title')}
            </h3>
            <p className="text-gray-400 text-center">
              {t('home.step1Desc')}
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500 transition">
            <div className="w-16 h-16 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900 mb-6 mx-auto">
              <TrendingUp size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-4">
              {t('home.step2Title')}
            </h3>
            <p className="text-gray-400 text-center">
              {t('home.step2Desc')}
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500 transition">
            <div className="w-16 h-16 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900 mb-6 mx-auto">
              <Trophy size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-4">
              {t('home.step3Title')}
            </h3>
            <p className="text-gray-400 text-center">
              {t('home.step3Desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Scoring Rules */}
      <section className="px-4 py-20 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          {t('home.scoringRules')}
        </h2>

        {featuredTournament?.mode ? (
          <div className="mb-8 bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-400 mb-2">
              {t('home.scoringMode')}
            </p>
            <p className="text-2xl font-bold text-white">
              {getModeLabel(featuredTournament.mode, language)}
            </p>
            {featuredTournament.rules?.totalMaximumPoints ? (
              <p className="text-gray-300 mt-3">
                {t('home.maximumScore')}: {featuredTournament.rules.totalMaximumPoints}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
            <h3 className="text-2xl font-bold text-emerald-400 mb-4">
              {t('home.groupStage')}
            </h3>
            <div className="space-y-2 text-gray-300">
              <p>{t('home.groupStageRuleExact')}</p>
              <p>{t('home.groupStageRuleInverted')}</p>
              <p>{t('home.groupStageRuleOneRight')}</p>
              <p>{t('home.groupStageRuleOneWrong')}</p>
              {featuredTournament?.rules?.groupStageSummary ? (
                <p className="text-white pt-2">
                  {t('home.maxPoints')} {featuredTournament.rules.groupStageSummary.maxPoints}
                </p>
              ) : null}
            </div>
          </div>

          {featuredTournament?.rules?.knockout?.map((round) => (
            <div
              key={round.round}
              className="bg-slate-800 border border-slate-700 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-emerald-400 mb-4">
                {getRoundLabel(round, t)}
              </h3>
              <p className="text-gray-300 text-lg">
                {round.pointsPerCorrect} {t('home.pointsPerCorrect')}
              </p>
              <p className="text-gray-400 mt-2">
                {round.maxMatches} {t('home.matchesForRound')} · {t('home.maxPoints')} {round.maxPoints}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Active Tournaments */}
      <section className="px-4 py-20 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          {t('home.activeTournaments')}
        </h2>

        {loading ? (
          <div className="text-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-8">
              {t('home.noTournaments')}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                to={`/tournament/${tournament.id}`}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-emerald-500 transition group"
              >
                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-emerald-400 transition">
                  {tournament.name}
                </h3>
                <div className="space-y-2 mb-6 text-gray-400">
                  <p>
                    <span className="font-semibold text-white">
                      {t('home.currentMode')}:
                    </span>{' '}
                    {getModeLabel(tournament.mode, language)}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('home.access')}:
                    </span>{' '}
                    {tournament.accessType === 'private'
                      ? t('home.privateTournament')
                      : t('home.publicTournament')}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('tournament.prizes')}:
                    </span>{' '}
                    {tournament.prizesEnabled
                      ? t('home.prizesEnabled')
                      : t('home.prizesDisabled')}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('tournament.participants')}:
                    </span>{' '}
                    {tournament.participantCount || 0}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      {t('tournament.closingDate')}:
                    </span>{' '}
                    {tournament.closingDate
                      ? new Date(tournament.closingDate).toLocaleDateString()
                      : 'TBD'}
                  </p>
                </div>
                <button className="w-full px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition">
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
