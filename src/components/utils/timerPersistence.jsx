/**
 * Timer persistence for free plan daily study limit
 * Stores remaining time keyed by date + user
 */

const DAILY_LIMIT_SECONDS = 7.5 * 60; // 7.5 minutes

const getStorageKey = (userId, dayKey) => {
  return `studyTime:${userId}:${dayKey}`;
};

const getTodayKey = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Load remaining time for today
 * @returns {Object} { remainingSeconds, source: 'default'|'storage' }
 */
export const loadRemainingTime = (userId) => {
  if (!userId) {
    console.log(`[TIMER] load dayKey=none remaining=${DAILY_LIMIT_SECONDS} source=default`);
    return { remainingSeconds: DAILY_LIMIT_SECONDS, source: 'default' };
  }

  const dayKey = getTodayKey();
  const key = getStorageKey(userId, dayKey);
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const data = JSON.parse(stored);
      const remaining = Math.max(0, data.remainingSeconds);
      console.log(`[TIMER] load dayKey=${dayKey} remaining=${remaining} source=storage`);
      return { remainingSeconds: remaining, source: 'storage' };
    } catch (e) {
      console.log(`[TIMER] load dayKey=${dayKey} remaining=${DAILY_LIMIT_SECONDS} source=default`);
      return { remainingSeconds: DAILY_LIMIT_SECONDS, source: 'default' };
    }
  }

  console.log(`[TIMER] load dayKey=${dayKey} remaining=${DAILY_LIMIT_SECONDS} source=default`);
  return { remainingSeconds: DAILY_LIMIT_SECONDS, source: 'default' };
};

/**
 * Save remaining time for today
 * @param {string} userId 
 * @param {number} remainingSeconds 
 * @param {string} reason - quit|finish|unmount|routeChange
 */
export const saveRemainingTime = (userId, remainingSeconds, reason) => {
  if (!userId) return;

  const dayKey = getTodayKey();
  const key = getStorageKey(userId, dayKey);
  const remaining = Math.max(0, Math.min(remainingSeconds, DAILY_LIMIT_SECONDS));
  
  const data = {
    remainingSeconds: remaining,
    updatedAt: Date.now()
  };

  localStorage.setItem(key, JSON.stringify(data));
  console.log(`[TIMER] save dayKey=${dayKey} remaining=${remaining} reason=${reason}`);
};

/**
 * Reset to daily allowance (called on day change)
 * @param {string} userId 
 */
export const resetDailyAllowance = (userId) => {
  if (!userId) return;

  const dayKey = getTodayKey();
  const key = getStorageKey(userId, dayKey);
  
  const data = {
    remainingSeconds: DAILY_LIMIT_SECONDS,
    updatedAt: Date.now()
  };

  localStorage.setItem(key, JSON.stringify(data));
  console.log(`[TIMER] reset dayKey=${dayKey} remaining=${DAILY_LIMIT_SECONDS} reason=dayChange`);
};

/**
 * Check if day has changed and reset if needed
 * @param {string} userId 
 * @param {string} lastDayKey 
 * @returns {boolean} true if day changed
 */
export const checkAndResetIfNewDay = (userId, lastDayKey) => {
  const currentDayKey = getTodayKey();
  
  if (lastDayKey && lastDayKey !== currentDayKey) {
    resetDailyAllowance(userId);
    return true;
  }
  
  return false;
};

let lastTickLog = 0;

/**
 * Throttled tick log (max once per 30 seconds)
 */
export const logTick = (remainingSeconds) => {
  const now = Date.now();
  if (now - lastTickLog >= 30000) {
    console.log(`[TIMER] tick remaining=${remainingSeconds}`);
    lastTickLog = now;
  }
};