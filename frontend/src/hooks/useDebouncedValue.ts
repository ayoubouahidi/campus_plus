import { useEffect, useState } from 'react';

// Returns `value` once it has stopped changing for `delayMs`. Each change cancels the pending update,
// so typing "hackathon" filters once, not nine times.
export const useDebouncedValue = <T>(value: T, delayMs = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
};
