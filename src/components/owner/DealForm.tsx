import React, { useState } from 'react';
import { createDealDraft, submitDealForApproval } from '../../services/dealsService';

export default function DealForm({ restaurantId, onCreated }: { restaurantId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const ref = await createDealDraft({ restaurantId, title: title.trim(), description });
      await submitDealForApproval(ref.id);
      setTitle('');
      setDescription('');
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">Post a Deal/Promo</div>
      <div className="space-y-2">
        <input className="w-full rounded-xl border border-slate-300 p-2 text-sm" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="w-full rounded-xl border border-slate-300 p-2 text-sm" placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
        <button disabled={submitting || !title.trim()} onClick={handleCreate} className="rounded-xl bg-red-500 px-4 py-2 text-white text-sm disabled:opacity-50">Submit for approval</button>
      </div>
    </div>
  );
}

