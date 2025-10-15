import React from 'react';

export default function DealsList({ deals }: { deals: any[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">Deals</div>
      {!deals?.length ? (
        <div className="text-sm text-slate-500">No deals yet</div>
      ) : (
        <div className="space-y-2">
          {deals.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{d.title}</div>
                <div className="text-xs text-slate-600">{d.description}</div>
              </div>
              <div className="text-xs font-semibold rounded-full px-2 py-1 border"
                   title={String(d.status)}>
                {String(d.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

