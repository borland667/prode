import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../utils/api';
import {
  buildTeamMap,
  getEligibleBestThirdGroups,
  getKnockoutRounds,
  getRoundLabel,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  sortGroups,
} from '../utils/tournament';

export default function Predict() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [groupPredictions, setGroupPredictions] = useState({});
  const [knockoutPredictions, setKnockoutPredictions] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchData = async () => {
      try {
        const tournamentData = await get(`/tournaments/${id}`);
        setTournament(tournamentData);

        if (!tournamentData?.access?.canSubmitPredictions) {
          setError(t('tournament.privateLocked'));
          return;
        }

        const predictionData = await get(`/tournaments/${id}/my-predictions`);

        setGroupPredictions(predictionData?.groupPredictionMap || {});
        setKnockoutPredictions(predictionData?.knockoutPredictionMap || {});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, t, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const groups = sortGroups(tournament?.groups || []);
  const rounds = getKnockoutRounds(tournament?.rounds || []);
  const teamMap = buildTeamMap(groups);
  const requiresThirdPlaceSelections = hasBestThirdPlaceSlots(rounds);
  const knockoutWinnerSelections = Object.fromEntries(
    Object.entries(knockoutPredictions).map(([matchId, prediction]) => [
      matchId,
      prediction?.predictedWinner || '',
    ])
  );
  const steps = tournament
    ? [
        {
          key: 'groups',
          type: 'groups',
          label: t('predict.stepGroupStage'),
        },
        ...rounds.map((round) => ({
          key: round.id,
          type: 'round',
          round,
          label: getRoundLabel(round, t),
        })),
      ]
    : [];

  const validateStep = (step) => {
    const stepConfig = steps[step];
    if (!stepConfig) {
      return false;
    }

    if (stepConfig.type === 'groups') {
      for (const group of groups) {
        const prediction = groupPredictions[group.id];
        if (!prediction?.first || !prediction?.second || (requiresThirdPlaceSelections && !prediction?.third)) {
          setError(t('predict.incompleteGroups'));
          return false;
        }

        const selectedTeams = [prediction.first, prediction.second, prediction.third].filter(Boolean);
        if (new Set(selectedTeams).size !== selectedTeams.length) {
          setError(t('predict.duplicateGroupTeams'));
          return false;
        }
      }
    }

    if (stepConfig.type === 'round') {
      for (const match of stepConfig.round.matches) {
        if (!knockoutPredictions[match.id]?.predictedWinner) {
          setError(t('predict.incompleteRounds'));
          return false;
        }
      }
    }

    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!steps.every((_, index) => validateStep(index))) {
      return;
    }

    setSaving(true);
    try {
      await post(`/tournaments/${id}/predictions`, {
        groupPredictions,
        knockoutPredictions,
      });
      navigate(`/tournament/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.noResults')}</p>
      </div>
    );
  }

  const activeStep = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-12">
          {t('predict.makePredictions')}
        </h1>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    if (index <= currentStep) {
                      setCurrentStep(index);
                    }
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition ${
                    index === currentStep
                      ? 'bg-emerald-500 text-white'
                      : index < currentStep
                        ? 'bg-emerald-600 text-white cursor-pointer'
                        : 'bg-slate-700 text-gray-400'
                  }`}
                >
                  {index + 1}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition ${
                      index < currentStep ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-4 text-gray-300">
            {t('predict.step')} {currentStep + 1} {t('predict.of')} {steps.length}:
            <span className="text-emerald-400 font-semibold">
              {' '}
              {activeStep.label}
            </span>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
          {activeStep.type === 'groups' ? (
            <GroupStageStep
              groups={groups}
              predictions={groupPredictions}
              requiresThirdPlaceSelections={requiresThirdPlaceSelections}
              onSelect={(groupId, position, teamId) => {
                setGroupPredictions((prev) => ({
                  ...prev,
                  [groupId]: {
                    ...prev[groupId],
                    [position]: teamId,
                  },
                }));
              }}
              t={t}
            />
          ) : (
            <RoundStep
              round={activeStep.round}
              groups={groups}
              rounds={rounds}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              knockoutWinnerSelections={knockoutWinnerSelections}
              teamMap={teamMap}
              onSelectSlot={(matchId, side, teamId) => {
                setKnockoutPredictions((prev) => {
                  const current = prev[matchId] || {};
                  const nextPrediction = {
                    ...current,
                    [side === 'home' ? 'selectedHomeTeamId' : 'selectedAwayTeamId']: teamId,
                  };
                  const homeTeamId =
                    side === 'home' ? teamId : current.selectedHomeTeamId || '';
                  const awayTeamId =
                    side === 'away' ? teamId : current.selectedAwayTeamId || '';

                  if (
                    current.predictedWinner &&
                    current.predictedWinner !== homeTeamId &&
                    current.predictedWinner !== awayTeamId
                  ) {
                    nextPrediction.predictedWinner = '';
                  }

                  return {
                    ...prev,
                    [matchId]: nextPrediction,
                  };
                });
              }}
              onSelect={(matchId, teamId) => {
                setKnockoutPredictions((prev) => ({
                  ...prev,
                  [matchId]: {
                    ...(prev[matchId] || {}),
                    predictedWinner: teamId,
                  },
                }));
              }}
              t={t}
            />
          )}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-6 py-3 border-2 border-slate-700 text-white rounded-lg hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={20} />
            {t('predict.previous')}
          </button>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? t('predict.savingPredictions') : t('predict.savePredictions')}
            </button>
          ) : (
            <button
              onClick={() => {
                if (validateStep(currentStep)) {
                  setCurrentStep(currentStep + 1);
                }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              {t('predict.next')}
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupStageStep({ groups, predictions, requiresThirdPlaceSelections, onSelect, t }) {
  return (
    <div>
      <p className="text-gray-300 mb-8">
        {t('predict.selectWinners')}
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  {t('predict.selectFirst')}
                </label>
                <select
                  value={predictions[group.id]?.first || ''}
                  onChange={(e) => onSelect(group.id, 'first', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
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
                  {t('predict.selectSecond')}
                </label>
                <select
                  value={predictions[group.id]?.second || ''}
                  onChange={(e) => onSelect(group.id, 'second', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- {t('common.select')} --</option>
                  {group.teams?.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      disabled={predictions[group.id]?.first === team.id}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {requiresThirdPlaceSelections ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {t('predict.selectThird')}
                  </label>
                  <select
                    value={predictions[group.id]?.third || ''}
                    onChange={(e) => onSelect(group.id, 'third', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- {t('common.select')} --</option>
                    {group.teams?.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                        disabled={
                          predictions[group.id]?.first === team.id ||
                          predictions[group.id]?.second === team.id
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
    </div>
  );
}

function RoundStep({
  round,
  groups,
  rounds,
  groupPredictions,
  knockoutPredictions,
  knockoutWinnerSelections,
  teamMap,
  onSelectSlot,
  onSelect,
  t,
}) {
  return (
    <div>
      <h3 className="text-2xl font-bold text-white mb-8">
        {round.label}
      </h3>

      <div className="grid md:grid-cols-2 gap-8">
        {round.matches.map((match) => {
          const prediction = knockoutPredictions[match.id] || {};
          const slotSelections = {
            [match.homeLabel]: prediction.selectedHomeTeamId || '',
            [match.awayLabel]: prediction.selectedAwayTeamId || '',
          };
          const matchup = resolveMatchParticipants({
            match,
            groups,
            rounds,
            groupSelections: groupPredictions,
            knockoutSelections: knockoutWinnerSelections,
            slotSelections,
            teamMap,
          });

          const isDisabled = !matchup.home.teamId || !matchup.away.teamId;
          const homeBestThirdOptions = getBestThirdOptions(match.homeLabel, groups, groupPredictions, teamMap);
          const awayBestThirdOptions = getBestThirdOptions(match.awayLabel, groups, groupPredictions, teamMap);

          return (
            <div
              key={match.id}
              className="bg-slate-900 border border-slate-700 rounded-lg p-6"
            >
              <p className="text-sm text-gray-400 mb-4 font-semibold">
                {match.code}: {match.homeLabel} vs {match.awayLabel}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => onSelect(match.id, matchup.home.teamId)}
                  disabled={isDisabled}
                  className={`w-full p-3 border-2 rounded transition text-left ${
                    prediction.predictedWinner === matchup.home.teamId
                      ? 'border-emerald-500 bg-emerald-900'
                      : 'border-slate-600 bg-slate-800 hover:border-emerald-500'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <p className="text-white font-semibold">
                    {matchup.home.teamName || `(${matchup.home.slotLabel})`}
                  </p>
                </button>

                {matchup.home.isBestThirdSlot ? (
                  <select
                    value={prediction.selectedHomeTeamId || ''}
                    onChange={(event) => onSelectSlot(match.id, 'home', event.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- {t('predict.selectBestThirdTeam')} --</option>
                    {homeBestThirdOptions.map((team) => (
                        <option
                          key={team.id}
                          value={team.id}
                          disabled={
                            prediction.selectedAwayTeamId === team.id ||
                            isBestThirdTeamUsedElsewhere(knockoutPredictions, match.id, team.id)
                          }
                        >
                          {team.name}
                        </option>
                    ))}
                  </select>
                ) : null}

                <div className="text-center text-gray-500 font-bold">
                  {t('predict.vs')}
                </div>

                <button
                  onClick={() => onSelect(match.id, matchup.away.teamId)}
                  disabled={isDisabled}
                  className={`w-full p-3 border-2 rounded transition text-left ${
                    prediction.predictedWinner === matchup.away.teamId
                      ? 'border-emerald-500 bg-emerald-900'
                      : 'border-slate-600 bg-slate-800 hover:border-emerald-500'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <p className="text-white font-semibold">
                    {matchup.away.teamName || `(${matchup.away.slotLabel})`}
                  </p>
                </button>

                {matchup.away.isBestThirdSlot ? (
                  <select
                    value={prediction.selectedAwayTeamId || ''}
                    onChange={(event) => onSelectSlot(match.id, 'away', event.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- {t('predict.selectBestThirdTeam')} --</option>
                    {awayBestThirdOptions.map((team) => (
                        <option
                          key={team.id}
                          value={team.id}
                          disabled={
                            prediction.selectedHomeTeamId === team.id ||
                            isBestThirdTeamUsedElsewhere(knockoutPredictions, match.id, team.id)
                          }
                        >
                          {team.name}
                        </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBestThirdOptions(label, groups, groupPredictions, teamMap) {
  const eligibleGroupCodes = getEligibleBestThirdGroups(label);

  return eligibleGroupCodes
    .map((groupCode) => {
      const group = groups.find((entry) => entry.name.toUpperCase() === groupCode);
      const teamId = group ? groupPredictions[group.id]?.third : '';
      return teamId ? teamMap[teamId] : null;
    })
    .filter(Boolean);
}

function isBestThirdTeamUsedElsewhere(knockoutPredictions, matchId, teamId) {
  return Object.entries(knockoutPredictions).some(([currentMatchId, prediction]) => {
    if (currentMatchId === matchId) {
      return false;
    }

    return prediction?.selectedHomeTeamId === teamId || prediction?.selectedAwayTeamId === teamId;
  });
}
