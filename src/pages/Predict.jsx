import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../utils/api';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';
import { ANALYTICS_EVENTS, trackEvent } from '../utils/analytics';
import {
  buildTeamMap,
  buildRandomPredictionSet,
  getEligibleBestThirdGroups,
  getKnockoutRounds,
  getLocalizedName,
  getRoundLabel,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  sanitizeKnockoutPredictionMap,
  sortGroups,
} from '../utils/tournament';

export default function Predict() {
  const { id } = useParams();
  const { language, t, formatNumber } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLeagueScope = location.pathname.startsWith('/league/');

  const [tournament, setTournament] = useState(null);
  const [league, setLeague] = useState(null);
  const [groupPredictions, setGroupPredictions] = useState({});
  const [knockoutPredictions, setKnockoutPredictions] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchData = async () => {
      try {
        let tournamentData;

        if (isLeagueScope) {
          const leagueData = await get(`/leagues/${id}`);
          setLeague(leagueData);
          tournamentData = await get(`/tournaments/${leagueData.tournamentId}`);
        } else {
          setLeague(null);
          tournamentData = await get(`/tournaments/${id}`);
        }

        setTournament(tournamentData);

        if (!tournamentData?.access?.canSubmitPredictions) {
          setError(
            tournamentData?.access?.predictionsLocked
              ? t('tournament.predictionsClosed')
              : t('tournament.privateLocked')
          );
          return;
        }

        const predictionData = await get(
          isLeagueScope ? `/leagues/${id}/my-predictions` : `/tournaments/${id}/my-predictions`
        );
        const nextGroups = sortGroups(tournamentData?.groups || []);
        const nextRounds = getKnockoutRounds(tournamentData?.rounds || []);
        const nextTeamMap = buildTeamMap(nextGroups);
        const nextGroupPredictions = predictionData?.groupPredictionMap || {};
        const nextKnockoutPredictions = sanitizeKnockoutPredictionMap({
          groups: nextGroups,
          rounds: nextRounds,
          groupSelections: nextGroupPredictions,
          knockoutPredictions: predictionData?.knockoutPredictionMap || {},
          teamMap: nextTeamMap,
        });

        setGroupPredictions(nextGroupPredictions);
        setKnockoutPredictions(nextKnockoutPredictions);
        setNotice('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isLeagueScope, t, user]);

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
    setNotice('');
    try {
      await post(isLeagueScope ? `/leagues/${id}/predictions` : `/tournaments/${id}/predictions`, {
        groupPredictions,
        knockoutPredictions,
      });
      trackEvent(ANALYTICS_EVENTS.PREDICTION_SAVED, {
        groupCount: Object.keys(groupPredictions).length,
        knockoutCount: Object.keys(knockoutPredictions).length,
        leagueId: league?.id,
        scope: isLeagueScope ? 'league' : 'tournament',
        tournamentId: tournament?.id,
      });
      navigate(isLeagueScope ? `/league/${id}` : `/tournament/${id}`);
    } catch (err) {
      setError(
        err.status === 403 && tournament?.access?.predictionsLocked
          ? t('tournament.predictionsClosed')
          : err.message
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRandomFill = () => {
    if (!tournament) {
      return;
    }

    const randomPredictions = buildRandomPredictionSet({
      groups,
      rounds,
      teamMap,
    });

    setGroupPredictions(randomPredictions.groupPredictions);
    setKnockoutPredictions(randomPredictions.knockoutPredictions);
    setCurrentStep(Math.max(steps.length - 1, 0));
    setError('');
    setNotice(t('predict.randomFillDone'));
  };

  const applyPredictionState = (nextGroupPredictions, nextKnockoutPredictions) => {
    setGroupPredictions(nextGroupPredictions);
    setKnockoutPredictions(
      sanitizeKnockoutPredictionMap({
        groups,
        rounds,
        groupSelections: nextGroupPredictions,
        knockoutPredictions: nextKnockoutPredictions,
        teamMap,
      })
    );
  };

  useEffect(() => {
    if (!tournament?.id || loading || !tournament?.access?.canSubmitPredictions) {
      return;
    }

    trackEvent(
      ANALYTICS_EVENTS.PREDICTION_STARTED,
      {
        leagueId: league?.id,
        scope: isLeagueScope ? 'league' : 'tournament',
        tournamentId: tournament.id,
      },
      {
        dedupeKey: `prediction_started:${isLeagueScope ? `league:${id}` : `tournament:${id}`}`,
      }
    );
  }, [id, isLeagueScope, league, loading, tournament]);

  if (authLoading) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.noResults')}</p>
      </div>
    );
  }

  const activeStep = steps[currentStep];

  return (
    <div className="ds-shell min-h-screen">
      <PageShell>
        <header className="space-y-4 mb-10">
          <Pill className="text-emerald-200">
            {league?.name || getLocalizedName(tournament, language, tournament.name)}
          </Pill>
          <DisplayText as="h1" className="text-white">
            {t('predict.makePredictions')}
          </DisplayText>
          <p className="ds-copy max-w-3xl">
            {isLeagueScope
              ? t('predict.leaguePredictionHelp')
              : t('predict.tournamentPredictionHelp')}
          </p>
          {isLeagueScope ? (
            <p className="text-sm uppercase tracking-overline-wide text-gray-500">
              {getLocalizedName(tournament, language, tournament.name)}
            </p>
          ) : null}
        </header>

        {error && (
          <div className="app-alert app-alert-error mb-8">
            {error}
          </div>
        )}

        {notice ? (
          <div className="app-alert app-alert-success mb-8">
            {notice}
          </div>
        ) : null}

        <Panel variant="strong" padding="normal" radius="2xl" className="mb-8">
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
                  {formatNumber(index + 1)}
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
            {t('predict.step')} {formatNumber(currentStep + 1)} {t('predict.of')} {formatNumber(steps.length)}:
            <span className="text-emerald-400 font-semibold">
              {' '}
              {activeStep.label}
            </span>
          </div>
        </Panel>

        <Panel variant="strong" padding="normal" radius="2xl" className="mb-8">
          {activeStep.type === 'groups' ? (
            <GroupStageStep
              groups={groups}
              predictions={groupPredictions}
              requiresThirdPlaceSelections={requiresThirdPlaceSelections}
              language={language}
              onSelect={(groupId, position, teamId) => {
                const nextGroupPredictions = {
                  ...groupPredictions,
                  [groupId]: {
                    ...groupPredictions[groupId],
                    [position]: teamId,
                  },
                };

                applyPredictionState(nextGroupPredictions, knockoutPredictions);
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
              language={language}
              onSelectSlot={(matchId, side, teamId) => {
                const current = knockoutPredictions[matchId] || {};
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

                applyPredictionState(groupPredictions, {
                  ...knockoutPredictions,
                  [matchId]: nextPrediction,
                });
              }}
              onSelect={(matchId, teamId) => {
                applyPredictionState(groupPredictions, {
                  ...knockoutPredictions,
                  [matchId]: {
                    ...(knockoutPredictions[matchId] || {}),
                    predictedWinner: teamId,
                  },
                });
              }}
              t={t}
            />
          )}
        </Panel>

        <Panel padding="normal" radius="2xl" className="prediction-footer">
          <div className="prediction-footer__meta">
            <div className="prediction-footer__actions">
              <Button
                onClick={handleRandomFill}
                disabled={saving}
                variant="secondary"
                className="prediction-footer__button prediction-footer__button--secondary"
              >
                {t('predict.randomFill')}
              </Button>

              <Button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                variant="ghost"
                className="prediction-footer__button prediction-footer__button--ghost"
              >
                <ChevronLeft size={20} />
                {t('predict.previous')}
              </Button>
            </div>
            <p className="prediction-footer__help">
              {isLeagueScope
                ? t('predict.randomFillHelpLeague')
                : t('predict.randomFillHelpTournament')}
            </p>
          </div>

          <div className="prediction-footer__cta">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="primary"
                className="prediction-footer__button prediction-footer__button--primary"
              >
                {saving ? t('predict.savingPredictions') : t('predict.savePredictions')}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (validateStep(currentStep)) {
                    setNotice('');
                    setCurrentStep(currentStep + 1);
                  }
                }}
                variant="primary"
                className="prediction-footer__button prediction-footer__button--primary"
              >
                {t('predict.next')}
                <ChevronRight size={20} />
              </Button>
            )}
          </div>
        </Panel>
      </PageShell>
    </div>
  );
}

function GroupStageStep({ groups, predictions, requiresThirdPlaceSelections, language, onSelect, t }) {
  return (
    <div>
      <p className="text-gray-300 mb-8">
        {t('predict.selectWinners')}
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <Panel key={group.id} padding="compact" radius="xl" className="app-card">
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
                  className="app-select"
                >
                  <option value="">-- {t('common.select')} --</option>
                  {group.teams?.map((team) => (
                    <option key={team.id} value={team.id}>
                      {getLocalizedName(team, language, team.name)}
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
                  className="app-select"
                >
                  <option value="">-- {t('common.select')} --</option>
                  {group.teams?.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      disabled={predictions[group.id]?.first === team.id}
                    >
                      {getLocalizedName(team, language, team.name)}
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
                    className="app-select"
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
                        {getLocalizedName(team, language, team.name)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </Panel>
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
  language,
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
            <Panel key={match.id} padding="compact" radius="xl" className="app-card">
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
                    {(matchup.home.teamId ? getLocalizedName(teamMap[matchup.home.teamId], language, matchup.home.teamName) : matchup.home.teamName) || `(${matchup.home.slotLabel})`}
                  </p>
                </button>

                {matchup.home.isBestThirdSlot ? (
                  <select
                    value={prediction.selectedHomeTeamId || ''}
                    onChange={(event) => onSelectSlot(match.id, 'home', event.target.value)}
                    className="app-select"
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
                          {getLocalizedName(team, language, team.name)}
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
                    {(matchup.away.teamId ? getLocalizedName(teamMap[matchup.away.teamId], language, matchup.away.teamName) : matchup.away.teamName) || `(${matchup.away.slotLabel})`}
                  </p>
                </button>

                {matchup.away.isBestThirdSlot ? (
                  <select
                    value={prediction.selectedAwayTeamId || ''}
                    onChange={(event) => onSelectSlot(match.id, 'away', event.target.value)}
                    className="app-select"
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
                          {getLocalizedName(team, language, team.name)}
                        </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </Panel>
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
