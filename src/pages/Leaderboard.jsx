import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get } from '../utils/api';
import { getLocalizedName, getRoundLabel } from '../utils/tournament';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';

export default function Leaderboard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { language, t, formatNumber, formatCurrency } = useLanguage();
  const { user } = useAuth();

  const [tournaments, setTournaments] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [currentLeague, setCurrentLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError('');
        setLoading(true);

        const tournamentList = await get('/tournaments?status=active,upcoming');
        setTournaments(tournamentList || []);

        const selectedTournamentId = id || tournamentList?.[0]?.id;

        if (!selectedTournamentId) {
          setTournament(null);
          setPlayers([]);
          setRounds([]);
          return;
        }

        const tournamentData = await get(`/tournaments/${selectedTournamentId}`);
        setTournament(tournamentData);
        setCurrentLeague(null);

        if (!tournamentData?.access?.canViewLeaderboard) {
          setError(t('tournament.membersOnlyLeaderboard'));
          return;
        }

        const leagueId = searchParams.get('league');
        let accessibleLeagues = [];

        if (user) {
          accessibleLeagues = await get(`/tournaments/${selectedTournamentId}/leagues`).catch(() => []);
        }

        setLeagues(accessibleLeagues || []);

        const selectedLeague = leagueId
          ? (accessibleLeagues || []).find((entry) => entry.id === leagueId)
          : null;

        const leaderboardData = selectedLeague
          ? await get(`/leagues/${selectedLeague.id}/leaderboard`)
          : await get(`/tournaments/${selectedTournamentId}/leaderboard`);

        setPlayers(leaderboardData?.players || []);
        setRounds(leaderboardData?.rounds || []);
        setCurrentLeague(leaderboardData?.league || selectedLeague || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, searchParams, t, user]);

  const tournamentName = getLocalizedName(tournament, language, tournament?.name || '');
  const selectedTournamentId = tournament?.id || id || tournaments[0]?.id || null;
  const selectedLeagueId = currentLeague?.id || searchParams.get('league') || null;
  const boardTitle = currentLeague?.name || t('leaderboard.leaderboard');
  const boardDescription = currentLeague?.id
    ? currentLeague.description || t('leaderboard.leagueDescription')
    : tournamentName || t('home.noTournaments');

  if (loading) {
    return (
      <PageShell className="leaderboard-page min-h-[50vh] place-items-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="leaderboard-page min-h-[50vh] place-items-center">
        <Panel className="app-empty w-full max-w-2xl" padding="normal" radius="xl">
          <p className="text-red-400">{error}</p>
        </Panel>
      </PageShell>
    );
  }

  const entryFee = tournament?.entryFee || 0;
  const totalParticipants = tournament?.participantCount || players.length;
  const totalPrize = entryFee * totalParticipants;
  const firstPlacePrize = Math.round(totalPrize * 0.7);
  const secondPlacePrize = Math.round(totalPrize * 0.3);
  const leaderboardStats = [
    {
      label: t('leaderboard.prizePool'),
      value: formatCurrency(totalPrize, tournament?.currency || 'USD', {
        maximumFractionDigits: 0,
      }),
      tone: tournament?.prizesEnabled && tournament?.entryFee ? 'text-emerald-300' : '',
    },
    {
      label: t('leaderboard.participants'),
      value: formatNumber(totalParticipants),
      tone: '',
    },
    {
      label: t('leaderboard.firstPlace'),
      value: formatCurrency(firstPlacePrize, tournament?.currency || 'USD', {
        maximumFractionDigits: 0,
      }),
      tone: tournament?.prizesEnabled && tournament?.entryFee ? 'text-emerald-300' : '',
    },
    {
      label: t('leaderboard.secondPlace'),
      value: formatCurrency(secondPlacePrize, tournament?.currency || 'USD', {
        maximumFractionDigits: 0,
      }),
      tone: tournament?.prizesEnabled && tournament?.entryFee ? 'text-emerald-300' : '',
    },
  ];

  return (
    <PageShell className="leaderboard-page">
      <div className="leaderboard-hero">
        <Panel variant="strong" padding="normal" radius="xl" className="leaderboard-hero__copy">
          <Pill className="text-emerald-200">{t('tournament.standings')}</Pill>
          <DisplayText as="h1" className="leaderboard-title text-white">
            {boardTitle}
          </DisplayText>
          <p className="text-slate-300 text-lg leading-relaxed">
            {boardDescription}
          </p>
        </Panel>

        <div className="leaderboard-summary">
          {leaderboardStats.map((stat) => (
            <Panel key={stat.label} className="leaderboard-stat" padding="normal" radius="lg">
              <p className="text-kicker uppercase tracking-overline text-slate-500">
                {stat.label}
              </p>
              <p className={`ds-display mt-3 text-4xl leading-none tabular-nums text-white ${stat.tone}`}>
                {stat.value}
              </p>
            </Panel>
          ))}
        </div>
      </div>

      {tournaments.length > 0 ? (
        <Panel className="leaderboard-switcher" padding="normal" radius="xl">
          <div className="leaderboard-switcher__header">
            <DisplayText as="h2" className="text-2xl text-white">
              {t('leaderboard.tournamentBoards')}
            </DisplayText>
            <p className="text-slate-400">
              {t('leaderboard.selectTournamentHelp')}
            </p>
          </div>

          <div className="leaderboard-switcher__list">
            {tournaments.map((entry) => {
              const isSelected = entry.id === selectedTournamentId && !selectedLeagueId;

              return (
                <Button
                  key={entry.id}
                  as={Link}
                  to={`/leaderboard/${entry.id}`}
                  variant={isSelected ? 'primary' : 'secondary'}
                  className="leaderboard-switcher__item"
                >
                  <span className="truncate">
                    {getLocalizedName(entry, language, entry.name)}
                  </span>
                </Button>
              );
            })}
          </div>

          {selectedTournamentId && leagues.length > 0 ? (
            <div className="leaderboard-switcher__group">
              <div className="leaderboard-switcher__header">
                <DisplayText as="h3" className="text-xl text-white">
                  {t('leaderboard.privateLeagueBoards')}
                </DisplayText>
                <p className="text-slate-400">
                  {t('leaderboard.selectLeagueHelp')}
                </p>
              </div>

              <div className="leaderboard-switcher__list">
                {leagues.map((league) => {
                  const isSelected = league.id === selectedLeagueId;

                  return (
                    <Button
                      key={league.id}
                      as={Link}
                      to={`/leaderboard/${selectedTournamentId}?league=${league.id}`}
                      variant={isSelected ? 'primary' : 'secondary'}
                      className="leaderboard-switcher__item"
                    >
                      <span className="truncate">{league.name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {tournament && !tournament.prizesEnabled ? (
        <Panel className="leaderboard-callout" padding="normal" radius="xl">
          <p className="text-slate-300">{t('leaderboard.prizesDisabled')}</p>
        </Panel>
      ) : null}

      {players.length === 0 ? (
        <Panel className="leaderboard-empty" padding="loft" radius="xl">
          <p className="text-gray-400 text-lg">
            {t('leaderboard.noPlayers')}
          </p>
        </Panel>
      ) : (
        <Panel variant="strong" className="app-table-shell" radius="xl">
            <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>
                      {t('leaderboard.rank')}
                    </th>
                    <th>
                      {t('leaderboard.player')}
                    </th>
                    <th className="text-center">
                      {t('leaderboard.groupPts')}
                    </th>
                    {rounds.map((round) => (
                      <th
                        key={round.id}
                        className="text-center"
                      >
                        {getRoundLabel(round, t)}
                      </th>
                    ))}
                    <th className="text-center text-emerald-400">
                      {t('leaderboard.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => {
                    const isCurrentUser = user?.id === player.userId;

                    return (
                      <tr
                        key={player.id}
                        className={`app-table-row ${isCurrentUser ? 'app-table-row-current' : ''}`}
                      >
                        <td>
                          <span className="font-bold text-white text-lg">
                            {formatNumber(index + 1)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="surface-accent-gradient flex h-10 w-10 items-center justify-center rounded-full font-bold">
                              {player.name?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {player.name}
                              </p>
                              {isCurrentUser ? (
                                <p className="text-emerald-400 text-xs">
                                  {t('leaderboard.you')}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="text-center font-semibold">
                          {formatNumber(player.groupScore || 0)}
                        </td>
                        {rounds.map((round) => (
                          <td
                            key={round.id}
                            className="text-center font-semibold"
                          >
                            {formatNumber(player.roundScores?.[round.name] || 0)}
                          </td>
                        ))}
                        <td className="text-center font-bold text-emerald-400 text-lg">
                          {formatNumber(player.totalScore || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </Panel>
      )}
    </PageShell>
  );
}
