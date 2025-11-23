import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { approveClaim, rejectClaim } from '../../services/claimsService';
import { addDoc, collection as coll } from 'firebase/firestore';

export default function ClaimsReview() {
  const user = auth.currentUser;
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [claims, setClaims] = useState<any[]>([]);
  const [restaurantMap, setRestaurantMap] = useState<Record<string, { name?: string; address?: string }>>({});
  const [statusFilter, setStatusFilter] = useState<'pending'|'approved'|'rejected'>('pending');
  const [sortDesc, setSortDesc] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      setIsAdmin(!!snap.exists() && !!(snap.data() as any)?.isAdmin);
    })();
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      if (!isAdmin) return;
      const qy = query(collection(db, 'owner_claims'), where('status', '==', statusFilter), orderBy('createdAt', sortDesc ? 'desc' : 'asc'));
      const snap = await getDocs(qy);
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setClaims(rows);
      // Load restaurant names/addresses (dedup)
      const ids = Array.from(new Set(rows.map(r => r.restaurantId).filter(Boolean)));
      const map: Record<string, { name?: string; address?: string }> = { ...restaurantMap };
      for (const id of ids) {
        if (!map[id]) {
          const rdoc = await getDoc(doc(db, 'restaurants', id));
          map[id] = { name: (rdoc.data() as any)?.name, address: (rdoc.data() as any)?.address };
        }
      }
      setRestaurantMap(map);
    })();
  }, [isAdmin, statusFilter, sortDesc]);

  if (!user) return <div className="p-6">Not authorized</div>;
  if (!isAdmin) return <div className="p-6">Not authorized</div>;

  const writeAudit = async (action: 'approve_claim'|'reject_claim', claim: any) => {
    await addDoc(coll(db, 'admin_audit'), {
      action,
      claimId: claim.id,
      restaurantId: claim.restaurantId || null,
      actorUid: user?.uid || null,
      actorEmail: user?.email || null,
      at: serverTimestamp(),
    });
  };
  const handleApprove = async (id: string) => {
    try {
      setBusyId(id);
      const claim = claims.find(c => c.id === id);
      await approveClaim(id);
      await updateDoc(doc(db, 'owner_claims', id), { reviewedBy: user?.uid || null, reviewedAt: serverTimestamp() });
      await writeAudit('approve_claim', claim || { id });
      setClaims(prev => prev.filter(c => c.id !== id));
      setToast('Claim approved');
    } catch (e) {
      setToast('Failed to approve claim');
    } finally {
      setTimeout(() => setToast(null), 1800);
      setBusyId(null);
    }
  };
  const handleReject = async (id: string) => {
    try {
      setBusyId(id);
      const claim = claims.find(c => c.id === id);
      await rejectClaim(id);
      await updateDoc(doc(db, 'owner_claims', id), { reviewedBy: user?.uid || null, reviewedAt: serverTimestamp() });
      await writeAudit('reject_claim', claim || { id });
      setClaims(prev => prev.filter(c => c.id !== id));
      setToast('Claim rejected');
    } catch (e) {
      setToast('Failed to reject claim');
    } finally {
      setTimeout(() => setToast(null), 1800);
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-2xl font-bold text-slate-900 mb-4">Claims</div>
        <div className="flex items-center gap-3 mb-3">
          <select className="rounded-lg border border-slate-300 p-2 text-base" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="text-sm rounded-lg border px-2 py-1" onClick={()=>setSortDesc(s=>!s)}>{sortDesc ? 'Newest first' : 'Oldest first'}</button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left p-3">Restaurant</th>
                <th className="text-left p-3">Requester</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Notes</th>
                <th className="text-left p-3">Proofs</th>
                <th className="text-left p-3">Created</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{restaurantMap[c.restaurantId]?.name || c.restaurantId}</div>
                    {restaurantMap[c.restaurantId]?.address ? (
                      <div className="text-xs text-slate-500">{restaurantMap[c.restaurantId]?.address}</div>
                    ) : null}
                  </td>
                  <td className="p-3">{c.contactEmail || c.requesterUid}</td>
                  <td className="p-3">
                    <div>{c.contactEmail || '-'}</div>
                    <div className="text-xs text-slate-500">{(c.notes || '').toString().match(/phone: ([^\n]+)/)?.[1] || '-'}</div>
                  </td>
                  <td className="p-3 max-w-xs truncate">{c.notes || '-'}</td>
                  <td className="p-3">
                    {Array.isArray(c.proofUrls) && c.proofUrls.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {c.proofUrls.map((u: string, i: number) => (
                          <a key={i} className="text-blue-600 hover:underline" href={u} target="_blank" rel="noreferrer">Proof {i+1}</a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-700">{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : '-'}</td>
                  <td className="p-3 text-right">
                    <button disabled={busyId===c.id} className="mr-2 rounded-lg border px-3 py-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50" onClick={() => handleApprove(c.id)}>Approve</button>
                    <button disabled={busyId===c.id} className="rounded-lg border px-3 py-1 text-rose-700 border-rose-300 hover:bg-rose-50 disabled:opacity-50" onClick={() => handleReject(c.id)}>Reject</button>
                  </td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500" colSpan={6}>No pending claims</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {toast && (
          <div className="fixed bottom-4 right-4 rounded-xl bg-black/80 text-white text-sm px-3 py-2">{toast}</div>
        )}
      </div>
    </div>
  );
}
