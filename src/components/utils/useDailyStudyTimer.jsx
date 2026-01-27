import { useState, useEffect } from 'react';
import { loadRemainingTime, saveRemainingTime } from './timerPersistence';

/**
 * Shared hook for daily study timer (free users only)
 * Single source of truth for remaining time
 */
export const useDailyStudyTimer = (userId, isPremium) => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value
  useEffect(() => {
    if (isPremium || !userId) {
      setIsLoading(false);
      return;
    }

    const { remainingSeconds: initial, source } = loadRemainingTime(userId);
    setRemainingSeconds(initial);
    setIsLoading(false);
    
    console.log(`[HOME TIMER] dayKey=${new Date().toISOString().split('T')[0]} remaining=${initial} source=${source}`);
  }, [userId, isPremium]);

  // Listen to storage events (updates from other tabs/pages)
  useEffect(() => {
    if (isPremium || !userId) return;

    const handleStorageChange = (e) => {
      const dayKey = new Date().toISOString().split('T')[0];
      const storageKey = `studyTime:${userId}:${dayKey}`;
      
      if (e.key === storageKey && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          setRemainingSeconds(data.remainingSeconds);
          console.log(`[HOME TIMER] dayKey=${dayKey} remaining=${data.remainingSeconds} source=storage-event`);
        } catch (err) {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userId, isPremium]);

  // Periodic refresh every 15s to catch same-tab updates
  useEffect(() => {
    if (isPremium || !userId) return;

    const interval = setInterval(() => {
      const { remainingSeconds: current } = loadRemainingTime(userId);
      if (current !== remainingSeconds) {
        setRemainingSeconds(current);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [userId, isPremium, remainingSeconds]);

  return { remainingSeconds, isLoading };
};