import React from 'react';

export default function Trends({ series }: { series: { date: string; count: number }[] }) {
  if (!series?.length) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No data yet</div>
  );

  const max = Math.max(...series.map(s => s.count), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">Reviews per day (30d)</div>
      <div className="flex items-end gap-1 h-24">
        {series.map((s, i) => (
          <div key={i} className="flex-1 bg-red-500/20" style={{ height: `${Math.max(6, (s.count / max) * 100)}%` }} title={`${s.date}: ${s.count}`} />
        ))}
      </div>
    </div>
  );
}

