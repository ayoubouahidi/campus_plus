'use client';

import { useState } from 'react';
import { useLiveMessages, useRealtime, type RealtimeSignal } from '@/components/providers/RealtimeProvider';

// /test only (Step 15.1): the WebSocket's status and the last messages, as RealtimeProvider hands them out
// (already mapped to EventItem). Real pages subscribe the same way in Step 15.2.
export const RealtimeMonitor = () => {
  const { status } = useRealtime();
  const [log, setLog] = useState<{ at: string; signal: RealtimeSignal }[]>([]);

  useLiveMessages((signal) =>
    setLog((current) => [{ at: new Date().toLocaleTimeString(), signal }, ...current].slice(0, 10))
  );

  const tone: Record<typeof status, string> = {
    off: 'bg-slate-400',
    connecting: 'bg-amber-400',
    live: 'bg-emerald-500',
    reconnecting: 'bg-amber-500',
    unavailable: 'bg-rose-500',
  };

  return (
    <div>
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className={`size-2.5 rounded-full ${tone[status]}`} />
        WebSocket: <strong>{status}</strong>
      </p>
      <ol className="mt-2 space-y-1 font-mono text-xs" dir="ltr">
        {log.length === 0 && <li className="text-slate-500">No messages yet.</li>}
        {log.map(({ at, signal }, index) => (
          <li key={`${at}-${index}`}>
            {at} · {signal.type}
            {'event' in signal && ` · #${signal.event.id} ${signal.event.title} @ ${signal.event.location} (${signal.event.status})`}
            {'id' in signal && ` · #${signal.id}`}
          </li>
        ))}
      </ol>
    </div>
  );
};
