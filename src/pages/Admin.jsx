import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, patch, post } from '../utils/api';
import {
  buildTeamMap,
  getEligibleBestThirdGroups,
  getKnockoutRounds,
  getRoundLabel,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  sortGroups,
} from '../utils/tournament';

export default function Admin() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [tournament, setTournament] = useState(null);
  const [groupResults, setGroupResults] = useState({});
  const [knockoutResults, setKnockoutResults] = useState({});
  const [settings, setSettings] = useState({
    prizesEnabled: false,
    entryFee: 0,
    currency: 'USD',
    accessType: 'public',
    joinCode: '',
    regenerateJoinCode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const data = await get('/tournaments');
        setTournaments(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournament) {
      setTournament(null);
      setGroupResults({});
      setKnockoutResults({});
      setSettings({
        prizesEnabled: false,
        entryFee: 0,
        currency: 'USD',
        accessType: 'public',
        joinCode: '',
        regenerateJoinCode: false,
      });
      return;
    }

    const fetchTournament = async () => {
      try {
        const data = await get(`/tournaments/${selectedTournament}`);
        setTournament(data);

        const nextGroupResults = {};
        for (const group of data.groups || []) {
          if (group.result) {
            nextGroupResults[group.id] = {
              first: group.result.first,
              second: group.result.second,
              third: group.result.third || '',
            };
          }
        }

        const nextKnockoutResults = {};
        for (const round of data.rounds || []) {
          for (const match of round.matches || []) {
            if (match.winner || match.selectedHomeTeamId || match.selectedAwayTeamId) {
              nextKnockoutResults[match.id] = {
                predictedWinner: match.winner || '',
                selectedHomeTeamId: match.selectedHomeTeamId || '',
                selectedAwayTeamId: match.selectedAwayTeamId || '',
              };
            }
          }
        }

        setGroupResults(nextGroupResults);
        setKnockoutResults(nextKnockoutResults);
        setSettings({
          prizesEnabled: Boolean(data.prizesEnabled),
          entryFee: data.entryFee || 0,
          currency: data.currency || 'USD',
          accessType: data.accessType || 'public',
          joinCode: data.joinCode || '',
          regenerateJoinCode: false,
        });
      } catch (err) {
        setError(err.message);
      }
    };

    fetchTournament();
  }, [selectedTournament]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const groups = sortGroups(tournament?.groups || []);
  const rounds = getKnockoutRounds(tournament?.rounds || []);
  const teamMap = buildTeamMap(groups);
  const requiresThirdPlaceSelections = hasBestThirdPlaceSlots(rounds);
  const knockoutWinnerSelections = Object.fromEntries(
    Object.entries(knockoutResults).map(([matchId, prediction]) => [
      matchId,
      prediction?.predictedWinner || '',
    ])
  );

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const data = await patch(`/tournaments/${selectedTournament}/settings`, {
        prizesEnabled: settings.prizesEnabled,
        entryFee: Number(settings.entryFee || 0),
        currency: settings.currency,
        accessType: settings.accessType,
        joinCode: settings.accessType === 'private' ? settings.joinCode : '',
        regenerateJoinCode: settings.regenerateJoinCode,
      });

      setTournament(data.tournament);
      setSettings({
        prizesEnabled: Boolean(data.tournament?.prizesEnabled),
        entryFee: data.tournament?.entryFee || 0,
        currency: data.tournament?.currency || 'USD',
        accessType: data.tournament?.accessType || 'public',
        joinCode: data.tournament?.joinCode || '',
        regenerateJoinCode: false,
      });
      setSuccess(t('admin.settingsSaved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGroupResults = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await post(`/tournaments/${selectedTournament}/results/groups`, {
        results: groupResults,
      });
      setSuccess(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKnockoutResults = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await post(`/tournaments/${selectedTournament}/results/knockout`, {
        results: Object.fromEntries(
          Object.entries(knockoutResults).filter(([, prediction]) => prediction?.predictedWinner)
        ),
      });
      setSuccess(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateScores = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await post(`/tournaments/${selectedTournament}/calculate-scores`, {});
      setSuccess(t('admin.scoresCalculated'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-12">
          {t('admin.adminPanel')}
        </h1>

        {error ? (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-8">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-8">
            {success}
          </div>
        ) : null}

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
          <label className="block text-lg font-semibold text-white mb-4">
            {t('admin.selectTournament')}
          </label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">-- {t('admin.selectTournament')} --</option>
            {tournaments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        {tournament ? (
          <>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                {t('admin.tournamentSettings')}
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-white font-semibold">
                      {t('admin.prizesEnabled')}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.prizesEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          prizesEnabled: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        {t('admin.entryFeeLabel')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.entryFee}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            entryFee: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        {t('admin.currencyLabel')}
                      </label>
                      <input
                        type="text"
                        value={settings.currency}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            currency: event.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      {t('admin.accessType')}
                    </label>
                    <select
                      value={settings.accessType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          accessType: event.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="public">{t('admin.publicAccess')}</option>
                      <option value="private">{t('admin.privateAccess')}</option>
                    </select>
                  </div>

                  {settings.accessType === 'private' ? (
                    <>
                      <div className="mt-6">
                        <label className="block text-sm text-gray-400 mb-2">
                          {t('admin.joinCode')}
                        </label>
                        <input
                          type="text"
                          value={settings.joinCode}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              joinCode: event.target.value.toUpperCase(),
                              regenerateJoinCode: false,
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-3 mt-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.regenerateJoinCode}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              regenerateJoinCode: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-gray-300">
                          {t('admin.regenerateJoinCode')}
                        </span>
                      </label>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                >
                  {saving ? t('admin.saving') : t('admin.saveSettings')}
                </button>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                {t('admin.groupResults')}
              </h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-6"
                  >
                    <h3 className="text-lg font-bold text-emerald-400 mb-4">
                      {group.name}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          {t('admin.firstPlace')}
                        </label>
                        <select
                          value={groupResults[group.id]?.first || ''}
                          onChange={(e) =>
                            setGroupResults((prev) => ({
                              ...prev,
                              [group.id]: {
                                ...prev[group.id],
                                first: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">-- {t('common.select')} --</option>
                          {group.teams?.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          {t('admin.secondPlace')}
                        </label>
                        <select
                          value={groupResults[group.id]?.second || ''}
                          onChange={(e) =>
                            setGroupResults((prev) => ({
                              ...prev,
                              [group.id]: {
                                ...prev[group.id],
                                second: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">-- {t('common.select')} --</option>
                          {group.teams?.map((team) => (
                            <option
                              key={team.id}
                              value={team.id}
                              disabled={groupResults[group.id]?.first === team.id}
                            >
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {requiresThirdPlaceSelections ? (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            {t('admin.thirdPlace')}
                          </label>
                          <select
                            value={groupResults[group.id]?.third || ''}
                            onChange={(e) =>
                              setGroupResults((prev) => ({
                                ...prev,
                                [group.id]: {
                                  ...prev[group.id],
                                  third: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="">-- {t('common.select')} --</option>
                            {group.teams?.map((team) => (
                              <option
                                key={team.id}
                                value={team.id}
                                disabled={
                                  groupResults[group.id]?.first === team.id ||
                                  groupResults[group.id]?.second === team.id
                                }
                              >
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveGroupResults}
                disabled={saving}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? t('admin.saving') : t('common.save')}
              </button>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                {t('admin.knockoutResults')}
              </h2>

              <div className="space-y-8 mb-8">
                {rounds.map((round) => (
                  <div key={round.id}>
                    <h3 className="text-xl font-bold text-emerald-400 mb-4">
                      {getRoundLabel(round, t)}
                    </h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      {round.matches.map((match) => {
                        const prediction = knockoutResults[match.id] || {};
                        const slotSelections = {
                          [match.homeLabel]: prediction.selectedHomeTeamId || match.selectedHomeTeamId || '',
                          [match.awayLabel]: prediction.selectedAwayTeamId || match.selectedAwayTeamId || '',
                        };
                        const matchup = resolveMatchParticipants({
                          match,
                          groups,
                          rounds,
                          groupSelections: groupResults,
                          knockoutSelections: knockoutWinnerSelections,
                          slotSelections,
                          teamMap,
                        });
                        const homeBestThirdOptions = getBestThirdOptions(
                          match.homeLabel,
                          groups,
                          groupResults,
                          teamMap
                        );
                        const awayBestThirdOptions = getBestThirdOptions(
                          match.awayLabel,
                          groups,
                          groupResults,
                          teamMap
                        );

                        const options = [
                          matchup.home.teamId
                            ? { id: matchup.home.teamId, label: matchup.home.teamName }
                            : null,
                          matchup.away.teamId
                            ? { id: matchup.away.teamId, label: matchup.away.teamName }
                            : null,
                        ].filter(Boolean);

                        return (
                          <div
                            key={match.id}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-6"
                          >
                            <label className="block text-sm text-gray-400 mb-2">
                              {match.code}: {match.homeLabel} vs {match.awayLabel}
                            </label>
                            {matchup.home.isBestThirdSlot ? (
                              <select
                                value={prediction.selectedHomeTeamId || ''}
                                onChange={(e) =>
                                  setKnockoutResults((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...(prev[match.id] || {}),
                                      selectedHomeTeamId: e.target.value,
                                      predictedWinner:
                                        prev[match.id]?.predictedWinner === prev[match.id]?.selectedHomeTeamId
                                          ? ''
                                          : prev[match.id]?.predictedWinner || '',
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none mb-3"
                              >
                                <option value="">-- {t('predict.selectBestThirdTeam')} --</option>
                                {homeBestThirdOptions.map((option) => (
                                  <option
                                    key={option.id}
                                    value={option.id}
                                    disabled={
                                      prediction.selectedAwayTeamId === option.id ||
                                      isBestThirdTeamUsedElsewhere(knockoutResults, match.id, option.id)
                                    }
                                  >
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            {matchup.away.isBestThirdSlot ? (
                              <select
                                value={prediction.selectedAwayTeamId || ''}
                                onChange={(e) =>
                                  setKnockoutResults((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...(prev[match.id] || {}),
                                      selectedAwayTeamId: e.target.value,
                                      predictedWinner:
                                        prev[match.id]?.predictedWinner === prev[match.id]?.selectedAwayTeamId
                                          ? ''
                                          : prev[match.id]?.predictedWinner || '',
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none mb-3"
                              >
                                <option value="">-- {t('predict.selectBestThirdTeam')} --</option>
                                {awayBestThirdOptions.map((option) => (
                                  <option
                                    key={option.id}
                                    value={option.id}
                                    disabled={
                                      prediction.selectedHomeTeamId === option.id ||
                                      isBestThirdTeamUsedElsewhere(knockoutResults, match.id, option.id)
                                    }
                                  >
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <select
                              value={prediction.predictedWinner || ''}
                              onChange={(e) =>
                                setKnockoutResults((prev) => ({
                                  ...prev,
                                  [match.id]: {
                                    ...(prev[match.id] || {}),
                                    predictedWinner: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">-- {t('common.select')} --</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveKnockoutResults}
                  disabled={saving}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {saving ? t('admin.saving') : t('common.save')}
                </button>
                <button
                  onClick={handleCalculateScores}
                  disabled={saving}
                  className="px-6 py-3 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {saving ? t('admin.calculating') : t('admin.calculateScores')}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function getBestThirdOptions(label, groups, groupSelections, teamMap) {
  const eligibleGroupCodes = getEligibleBestThirdGroups(label);

  return eligibleGroupCodes
    .map((groupCode) => {
      const group = groups.find((entry) => entry.name.toUpperCase() === groupCode);
      const teamId = group ? groupSelections[group.id]?.third : '';
      return teamId ? teamMap[teamId] : null;
    })
    .filter(Boolean);
}

function isBestThirdTeamUsedElsewhere(knockoutResults, matchId, teamId) {
  return Object.entries(knockoutResults).some(([currentMatchId, prediction]) => {
    if (currentMatchId === matchId) {
      return false;
    }

    return prediction?.selectedHomeTeamId === teamId || prediction?.selectedAwayTeamId === teamId;
  });
}
