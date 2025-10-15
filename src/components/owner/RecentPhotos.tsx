import React from 'react';
import type { RecentPhotoItem } from '../../services/ownerPortalService';

export default function RecentPhotos({ items }: { items: RecentPhotoItem[] }) {
  if (!items?.length) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No photos yet</div>
  );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">Recent Photos</div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((p, i) => (
          <img key={i} src={p.url} alt="dish" className="w-full h-24 object-cover rounded-xl" />
        ))}
      </div>
    </div>
  );
}

