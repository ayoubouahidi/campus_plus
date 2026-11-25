import { useState } from 'react';

// Local state that starts from a server prop AND follows it when the server sends a new value (Step 15.2):
// after router.refresh() (live update, DOCS.md §15.2) the page re-renders on the server and passes new
// objects; useState(prop) alone would keep the old copy forever. Local changes (optimistic RSVP) stay until the
// next server value arrives. React's documented "adjust state when a prop changes" pattern (no effect).
export const useSyncedState = <T,>(serverValue: T) => {
  const [value, setValue] = useState(serverValue);
  const [source, setSource] = useState(serverValue);
  if (source !== serverValue) {
    setSource(serverValue);
    setValue(serverValue);
  }
  return [value, setValue] as const;
};
