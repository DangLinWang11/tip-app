import React from 'react';
import type { TopDishRow } from '../../services/ownerPortalService';

export default function TopDishes({ rows }: { rows: TopDishRow[] }) {
  if (!rows?.length) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No dishes yet</div>
  );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">Top Dishes (30d)</div>
      <div className="divide-y divide-slate-100">
        <div className="grid grid-cols-6 py-2 text-xs font-medium text-slate-600">
          <div className="col-span-3">Dish</div>
          <div className="text-right">Posts</div>
          <div className="text-right">Avg Rating</div>
          <div className="text-right">Top Tags</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-6 py-2 text-sm">
            <div className="col-span-3 text-slate-900 truncate">{r.dishName}</div>
            <div className="text-right text-slate-800">{r.posts}</div>
            <div className="text-right text-slate-800">{r.avgRating ?? '-'}</div>
            <div className="text-right text-slate-700 truncate">{r.topTags.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

