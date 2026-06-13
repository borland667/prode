import posthog from 'posthog-js';

export const ANALYTICS_EVENTS = {
  AUTH_LOGIN_COMPLETED: 'auth_login_completed',
  AUTH_REGISTER_COMPLETED: 'auth_register_completed',
  AUTH_VERIFICATION_SENT: 'auth_verification_sent',
  AUTH_VERIFIED: 'auth_verified',
  TOURNAMENT_VIEWED: 'tournament_viewed',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
  PREDICTION_STARTED: 'prediction_started',
  PREDICTION_SAVED: 'prediction_saved',
  LEAGUE_CREATED: 'league_created',
  LEAGUE_JOINED: 'league_joined',
  LEAGUE_PREDICTION_COPIED: 'league_prediction_copied',
  PRIMARY_ENTRY_SELECTED: 'primary_entry_selected',
};

const ANALYTICS_PROVIDER = (import.meta.env.VITE_ANALYTICS_PROVIDER || 'none').toLowerCase();
const ANALYTICS_ENABLED =
  String(import.meta.env.VITE_ANALYTICS_ENABLED || 'false').toLowerCase() === 'true';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const PAGEVIEW_EVENT = '$pageview';

let analyticsInitialized = false;
let identifiedUserId = null;
let lastPageviewPath = '';
const recentEventMap = new Map();

function sanitizeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

function shouldSkipRecentEvent(key, dedupeMs) {
  const now = Date.now();
  const lastSeenAt = recentEventMap.get(key) || 0;
  recentEventMap.set(key, now);
  return now - lastSeenAt < dedupeMs;
}

function canUsePosthog() {
  return ANALYTICS_ENABLED && ANALYTICS_PROVIDER === 'posthog' && Boolean(POSTHOG_KEY);
}

function ensureAnalytics() {
  if (analyticsInitialized || !canUsePosthog()) {
    return canUsePosthog();
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
  });

  analyticsInitialized = true;
  return true;
}

export function analyticsEnabled() {
  return canUsePosthog();
}

export function initAnalytics(context = {}) {
  if (!ensureAnalytics()) {
    return false;
  }

  setAnalyticsContext(context);
  return true;
}

export function setAnalyticsContext(context = {}) {
  if (!ensureAnalytics()) {
    return;
  }

  posthog.register(
    sanitizeProperties({
      language: context.language,
      locale: context.locale,
      theme: context.theme,
      authenticated: context.authenticated,
    })
  );
}

export function identifyAnalyticsUser(user, context = {}) {
  if (!ensureAnalytics() || !user?.id) {
    return;
  }

  if (identifiedUserId !== user.id) {
    posthog.identify(
      user.id,
      sanitizeProperties({
        role: user.role,
        showInGlobalRankings: Boolean(user.showInGlobalRankings),
        language: context.language,
        locale: context.locale,
        theme: context.theme,
      })
    );
    identifiedUserId = user.id;
  }

  setAnalyticsContext({
    ...context,
    authenticated: true,
  });
}

export function resetAnalytics() {
  if (!analyticsInitialized || ANALYTICS_PROVIDER !== 'posthog') {
    identifiedUserId = null;
    lastPageviewPath = '';
    recentEventMap.clear();
    return;
  }

  posthog.reset();
  identifiedUserId = null;
  lastPageviewPath = '';
  recentEventMap.clear();
}

export function trackEvent(name, properties = {}, options = {}) {
  if (!ensureAnalytics()) {
    return;
  }

  const dedupeKey = options.dedupeKey;
  if (dedupeKey && shouldSkipRecentEvent(dedupeKey, options.dedupeMs || 1500)) {
    return;
  }

  posthog.capture(name, sanitizeProperties(properties));
}

export function trackPageView(location, properties = {}) {
  if (!ensureAnalytics() || !location) {
    return;
  }

  const path = `${location.pathname || ''}${location.search || ''}`;
  if (path === lastPageviewPath) {
    return;
  }

  lastPageviewPath = path;

  posthog.capture(
    PAGEVIEW_EVENT,
    sanitizeProperties({
      $current_url: typeof window !== 'undefined' ? window.location.href : path,
      pathname: location.pathname,
      search: location.search,
      ...properties,
    })
  );
}
