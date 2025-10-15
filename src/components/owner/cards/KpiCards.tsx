import React from 'react';

export function KpiCards({
  reviewCount,
  uniqueReviewers,
  prevCount,
}: {
  reviewCount: number;
  uniqueReviewers: number;
  prevCount: number;
}) {
  const pct = prevCount > 0 ? Math.round(((reviewCount - prevCount) / prevCount) * 100) : (reviewCount > 0 ? 100 : 0);
  const pctLabel = (pct >= 0 ? '+' : '') + pct + '%';
  const pctColor = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-rose-600' : 'text-slate-600';

  const Card = ({ title, value, sub }: { title: string; value: React.ReactNode; sub?: React.ReactNode }) => (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card title="Reviews (30d)" value={reviewCount} sub={<span className={pctColor}>{pctLabel} vs prev 30d</span>} />
      <Card title="Unique Reviewers (30d)" value={uniqueReviewers} />
      <Card title="Prev 30d" value={prevCount} />
    </div>
  );
}

