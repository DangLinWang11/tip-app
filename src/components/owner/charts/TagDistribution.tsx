import React from 'react';

export default function TagDistribution({ tags, title }: { tags: Record<string, number>; title?: string }) {
  const entries = Object.entries(tags || {}).sort((a,b) => b[1]-a[1]).slice(0, 12);
  if (!entries.length) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No tags yet</div>
  );
  const max = Math.max(...entries.map(([,v]) => v), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-3">{title || 'Top Tags'}</div>
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <div className="w-28 text-xs text-slate-700 truncate">{k}</div>
            <div className="flex-1 h-2 bg-slate-100 rounded">
              <div className="h-2 rounded bg-emerald-500" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <div className="w-8 text-xs text-right text-slate-600">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

