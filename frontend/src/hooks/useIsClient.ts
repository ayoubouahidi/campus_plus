'use client';

import { useSyncExternalStore } from 'react';

// true in the browser, false while rendering on the server and during hydration (Step 20.1, DOCS.md §20).
//
// Replaces the old guard `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`
// used before portals and `document` access. That guard sets state inside an effect: one extra render pass
// for every component, and React's lint rule (react-hooks/set-state-in-effect) reports it.
//
// useSyncExternalStore with a server snapshot is React's own answer: the server (and the first hydration
// render) read `false`, so the HTML matches; right after hydration React reads the client snapshot, `true`, and
// re-renders once. Components mounted later, after navigation, get `true` immediately, with no extra pass.
const subscribe = () => () => {}; // nothing changes over time: there is nothing to listen to
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const useIsClient = (): boolean => useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
