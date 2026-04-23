import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, patch, post, put } from '../utils/api';
import {
  buildTeamMap,
  getEligibleBestThirdGroups,
  getKnockoutRounds,
  getRoundLabel,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  sortGroups,
} from '../utils/tournament';

const DEFAULT_GROUPS_TEMPLATE = JSON.stringify(
  [
    {
      name: 'A',
      teams: [
        { name: 'Team 1', code: 'T1' },
        { name: 'Team 2', code: 'T2' },
        { name: 'Team 3', code: 'T3' },
        { name: 'Team 4', code: 'T4' },
      ],
    },
  ],
  null,
  2
);

const DEFAULT_ROUNDS_TEMPLATE = JSON.stringify(
  [
    {
      name: 'round_of_16',
      nameEs: 'Octavos de Final',
      order: 1,
      pointsPerCorrect: 2,
      matches: [
        { matchNumber: 1, homeLabel: '1A', awayLabel: '2B' },
        { matchNumber: 2, homeLabel: '1B', awayLabel: '2A' },
      ],
    },
  ],
  null,
  2
);

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createEmptyBuilderForm() {
  return {
    name: '',
    nameEs: '',
    sport: 'football',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 0,
    currency: 'USD',
    accessType: 'public',
    joinCode: '',
    startDate: '',
    endDate: '',
    closingDate: '',
    groupsJson: DEFAULT_GROUPS_TEMPLATE,
    roundsJson: DEFAULT_ROUNDS_TEMPLATE,
  };
}

function buildBuilderFormFromTournament(tournament) {
  return {
    name: tournament?.name || '',
    nameEs: tournament?.nameEs || '',
    sport: tournament?.sport || 'football',
    modeKey: tournament?.mode?.key || 'classic_argentinian_prode',
    modeName: tournament?.mode?.name || 'Classic Prode',
    modeNameEs: tournament?.mode?.nameEs || 'Prode Clasico',
    status: tournament?.status || 'upcoming',
    prizesEnabled: Boolean(tournament?.prizesEnabled),
    entryFee: tournament?.entryFee || 0,
    currency: tournament?.currency || 'USD',
    accessType: tournament?.accessType || 'public',
    joinCode: tournament?.joinCode || '',
    startDate: toDateTimeLocalValue(tournament?.startDate),
    endDate: toDateTimeLocalValue(tournament?.endDate),
    closingDate: toDateTimeLocalValue(tournament?.closingDate),
    groupsJson: JSON.stringify(
      (tournament?.groups || []).map((group) => ({
        name: group.name,
        teams: (group.teams || []).map((team) => ({
          name: team.name,
          nameEs: team.nameEs || '',
          code: team.code || '',
          flagUrl: team.flagUrl || '',
        })),
      })),
      null,
      2
    ),
    roundsJson: JSON.stringify(
      (tournament?.rounds || []).map((round) => ({
        name: round.name,
        nameEs: round.nameEs || '',
        order: round.order,
        pointsPerCorrect: round.pointsPerCorrect,
        matches: (round.matches || []).map((match) => ({
          matchNumber: match.matchNumber,
          homeLabel: match.homeLabel,
          awayLabel: match.awayLabel,
          matchDate: match.matchDate ? toDateTimeLocalValue(match.matchDate) : '',
        })),
      })),
      null,
      2
    ),
  };
}

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
  const [builderMode, setBuilderMode] = useState('create');
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderError, setBuilderError] = useState('');
  const [builderForm, setBuilderForm] = useState(createEmptyBuilderForm);

  const loadTournaments = async () => {
    const data = await get('/tournaments');
    setTournaments(data || []);
    return data || [];
  };

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        await loadTournaments();
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
      setBuilderMode('create');
      setBuilderError('');
      setBuilderForm(createEmptyBuilderForm());
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
        setBuilderMode('edit');
        setBuilderError('');
        setBuilderForm(buildBuilderFormFromTournament(data));
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
      <div className="sport-shell min-h-screen flex items-center justify-center">
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

  const handleBuilderFieldChange = (field, value) => {
    setBuilderForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const parseBuilderPayload = () => {
    let groups;
    let rounds;

    try {
      groups = JSON.parse(builderForm.groupsJson);
    } catch {
      throw new Error(`${t('admin.groupsJsonLabel')} must be valid JSON`);
    }

    try {
      rounds = JSON.parse(builderForm.roundsJson);
    } catch {
      throw new Error(`${t('admin.roundsJsonLabel')} must be valid JSON`);
    }

    return {
      name: builderForm.name,
      nameEs: builderForm.nameEs,
      sport: builderForm.sport,
      modeKey: builderForm.modeKey,
      modeName: builderForm.modeName,
      modeNameEs: builderForm.modeNameEs,
      status: builderForm.status,
      prizesEnabled: builderForm.prizesEnabled,
      entryFee: Number(builderForm.entryFee || 0),
      currency: builderForm.currency,
      accessType: builderForm.accessType,
      joinCode: builderForm.joinCode,
      startDate: builderForm.startDate || null,
      endDate: builderForm.endDate || null,
      closingDate: builderForm.closingDate || null,
      groups,
      rounds,
    };
  };

  const handleSaveStructure = async () => {
    setBuilderSaving(true);
    setBuilderError('');
    setError('');
    setSuccess('');

    try {
      const payload = parseBuilderPayload();
      const response =
        builderMode === 'edit' && selectedTournament
          ? await put(`/tournaments/${selectedTournament}/structure`, payload)
          : await post('/tournaments', payload);

      const refreshedTournaments = await loadTournaments();
      const nextTournamentId = response?.tournament?.id || selectedTournament || refreshedTournaments[0]?.id || '';

      if (nextTournamentId) {
        setSelectedTournament(nextTournamentId);
      }

      if (response?.tournament) {
        setTournament(response.tournament);
        setBuilderMode('edit');
        setBuilderForm(buildBuilderFormFromTournament(response.tournament));
      }

      setSuccess(
        builderMode === 'edit' ? t('admin.structureSaved') : t('admin.structureCreated')
      );
    } catch (err) {
      setBuilderError(err.message);
    } finally {
      setBuilderSaving(false);
    }
  };

  return (
    <div className="sport-shell min-h-screen">
      <div className="page-shell">
        <div className="app-page-header">
          <div className="app-page-kicker score-pill text-emerald-200">
            {t('nav.admin')}
          </div>
          <h1 className="app-page-title sport-display">
            {t('admin.adminPanel')}
          </h1>
          <p className="app-page-description">
            {t('admin.tournamentBuilderHelp')}
          </p>
        </div>

        {error ? (
          <div className="app-alert app-alert-error mb-8">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="app-alert app-alert-success mb-8">
            {success}
          </div>
        ) : null}

        <div className="sport-panel-strong app-card-strong mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
            <div>
              <h2 className="app-section-title">
                {t('admin.tournamentBuilder')}
              </h2>
              <p className="app-section-copy max-w-3xl">
                {t('admin.tournamentBuilderHelp')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTournament('');
                setBuilderMode('create');
                setBuilderError('');
                setBuilderForm(createEmptyBuilderForm());
              }}
              className="app-button-secondary sm:w-auto"
            >
              {t('admin.newTournament')}
            </button>
          </div>

          {builderError ? (
            <div className="app-alert app-alert-error mb-6">
              {builderError}
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="account-label">
                {t('admin.tournamentName')}
              </label>
              <input
                type="text"
                value={builderForm.name}
                onChange={(event) => handleBuilderFieldChange('name', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.tournamentNameEs')}
              </label>
              <input
                type="text"
                value={builderForm.nameEs}
                onChange={(event) => handleBuilderFieldChange('nameEs', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.sportLabel')}
              </label>
              <input
                type="text"
                value={builderForm.sport}
                onChange={(event) => handleBuilderFieldChange('sport', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.statusLabel')}
              </label>
              <select
                value={builderForm.status}
                onChange={(event) => handleBuilderFieldChange('status', event.target.value)}
                className="app-select"
              >
                <option value="upcoming">{t('tournament.upcoming')}</option>
                <option value="active">{t('tournament.active')}</option>
                <option value="closed">{t('tournament.closed')}</option>
                <option value="finished">{t('tournament.finished')}</option>
              </select>
            </div>

            <div>
              <label className="account-label">
                {t('admin.modeKey')}
              </label>
              <input
                type="text"
                value={builderForm.modeKey}
                onChange={(event) => handleBuilderFieldChange('modeKey', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.modeName')}
              </label>
              <input
                type="text"
                value={builderForm.modeName}
                onChange={(event) => handleBuilderFieldChange('modeName', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.modeNameEs')}
              </label>
              <input
                type="text"
                value={builderForm.modeNameEs}
                onChange={(event) => handleBuilderFieldChange('modeNameEs', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.accessType')}
              </label>
              <select
                value={builderForm.accessType}
                onChange={(event) => handleBuilderFieldChange('accessType', event.target.value)}
                className="app-select"
              >
                <option value="public">{t('admin.publicAccess')}</option>
                <option value="private">{t('admin.privateAccess')}</option>
              </select>
            </div>

            <div>
              <label className="account-label">
                {t('admin.entryFeeLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={builderForm.entryFee}
                onChange={(event) => handleBuilderFieldChange('entryFee', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.currencyLabel')}
              </label>
              <input
                type="text"
                value={builderForm.currency}
                onChange={(event) => handleBuilderFieldChange('currency', event.target.value.toUpperCase())}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.joinCode')}
              </label>
              <input
                type="text"
                value={builderForm.joinCode}
                onChange={(event) => handleBuilderFieldChange('joinCode', event.target.value.toUpperCase())}
                className="app-input"
              />
            </div>

            <label className="sport-panel app-card flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-white font-semibold">
                {t('admin.prizesEnabled')}
              </span>
              <input
                type="checkbox"
                checked={builderForm.prizesEnabled}
                onChange={(event) => handleBuilderFieldChange('prizesEnabled', event.target.checked)}
                className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <div>
              <label className="account-label">
                {t('admin.startDateLabel')}
              </label>
              <input
                type="datetime-local"
                value={builderForm.startDate}
                onChange={(event) => handleBuilderFieldChange('startDate', event.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('admin.endDateLabel')}
              </label>
              <input
                type="datetime-local"
                value={builderForm.endDate}
                onChange={(event) => handleBuilderFieldChange('endDate', event.target.value)}
                className="app-input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="account-label">
                {t('admin.closingDateLabel')}
              </label>
              <input
                type="datetime-local"
                value={builderForm.closingDate}
                onChange={(event) => handleBuilderFieldChange('closingDate', event.target.value)}
                className="app-input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="account-label">
                {t('admin.groupsJsonLabel')}
              </label>
              <textarea
                rows={16}
                value={builderForm.groupsJson}
                onChange={(event) => handleBuilderFieldChange('groupsJson', event.target.value)}
                className="app-textarea font-mono text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="account-label">
                {t('admin.roundsJsonLabel')}
              </label>
              <textarea
                rows={18}
                value={builderForm.roundsJson}
                onChange={(event) => handleBuilderFieldChange('roundsJson', event.target.value)}
                className="app-textarea font-mono text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={handleSaveStructure}
              disabled={builderSaving}
              className="app-button-primary sm:w-auto"
            >
              {builderSaving
                ? t('admin.saving')
                : builderMode === 'edit'
                  ? t('admin.updateStructure')
                  : t('admin.createTournament')}
            </button>
          </div>
        </div>

        <div className="sport-panel-strong app-card-strong mb-8">
          <label className="account-label text-base">
            {t('admin.selectTournament')}
          </label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="app-select"
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
            <div className="sport-panel-strong app-card-strong mb-8">
              <h2 className="app-section-title">
                {t('admin.tournamentSettings')}
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="sport-panel app-card">
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
                      <label className="account-label">
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
                        className="app-input"
                      />
                    </div>

                    <div>
                      <label className="account-label">
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
                        className="app-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="sport-panel app-card">
                  <div>
                    <label className="account-label">
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
                      className="app-select"
                    >
                      <option value="public">{t('admin.publicAccess')}</option>
                      <option value="private">{t('admin.privateAccess')}</option>
                    </select>
                  </div>

                  {settings.accessType === 'private' ? (
                    <>
                      <div className="mt-6">
                        <label className="account-label">
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
                          className="app-input"
                        />
                      </div>

                      <label className="flex items-center gap-3 mt-4 cursor-pointer text-gray-300">
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
                        <span>
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
                  className="app-button-primary sm:w-auto"
                >
                  {saving ? t('admin.saving') : t('admin.saveSettings')}
                </button>
              </div>
            </div>

            <div className="sport-panel-strong app-card-strong mb-8">
              <h2 className="app-section-title">
                {t('admin.groupResults')}
              </h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="sport-panel app-card"
                  >
                    <h3 className="text-lg font-bold text-emerald-400 mb-4">
                      {group.name}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="account-label">
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
                          className="app-select"
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
                        <label className="account-label">
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
                          className="app-select"
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
                          <label className="account-label">
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
                            className="app-select"
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
                className="app-button-primary sm:w-auto"
              >
                {saving ? t('admin.saving') : t('common.save')}
              </button>
            </div>

            <div className="sport-panel-strong app-card-strong mb-8">
              <h2 className="app-section-title">
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
                            className="sport-panel app-card"
                          >
                            <label className="account-label">
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
                                className="app-select mb-3"
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
                                className="app-select mb-3"
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
                              className="app-select"
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
                  className="app-button-primary sm:w-auto"
                >
                  {saving ? t('admin.saving') : t('common.save')}
                </button>
                <button
                  onClick={handleCalculateScores}
                  disabled={saving}
                  className="app-button-secondary sm:w-auto"
                >
                  {saving ? t('admin.calculating') : t('admin.calculateScores')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="sport-panel app-empty">
            <p className="text-gray-400 text-lg">
              {t('admin.selectTournament')}
            </p>
          </div>
        )}
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
