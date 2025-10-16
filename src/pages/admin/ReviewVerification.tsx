import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, Timestamp } from 'firebase/firestore';
import { addDoc, collection as coll } from 'firebase/firestore';
import { adminApproveReview, adminRejectReview } from '../../services/reviewVerificationService';

type Row = any;

export default function ReviewVerification() {
  const user = auth.currentUser;
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [restaurantMap, setRestaurantMap] = useState<Record<string, { name?: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [points, setPoints] = useState<number>(50);
  const [blockDuplicates, setBlockDuplicates] = useState<boolean>(false);
  const [dupMap, setDupMap] = useState<Record<string, boolean>>({});

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
      const qy = query(
        collection(db, 'reviews'),
        where('verification.state', 'in', ['pending_proof','pending_review']),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(qy);
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setRows(items);
      const ids = Array.from(new Set(items.map(r => r.restaurantId).filter(Boolean)));
      const map: Record<string, { name?: string }> = { ...restaurantMap };
      for (const id of ids) {
        if (!map[id]) {
          const rdoc = await getDoc(doc(db, 'restaurants', id));
          map[id] = { name: (rdoc.data() as any)?.name };
        }
      }
      setRestaurantMap(map);
    })();
  }, [isAdmin]);

  // Duplicate proof detection helper (same hash as upload path usage)
  const usageIdForUrl = (url: string) => btoa(unescape(encodeURIComponent(url))).replace(/=+$/,'');

  // Compute duplicate per row; cache results
  useEffect(() => {
    (async () => {
      const next: Record<string, boolean> = { ...dupMap };
      for (const r of rows) {
        if (next[r.id] !== undefined) continue;
        const urls: string[] = Array.isArray(r?.verification?.proofUrls) ? r.verification.proofUrls : [];
        let duplicate = false;
        for (const u of urls) {
          try {
            const id = usageIdForUrl(u);
            const snap = await getDoc(doc(db, 'proof_file_usage', id));
            if (snap.exists()) {
              const usedBy = (snap.data() as any)?.reviewId;
              if (usedBy && usedBy !== r.id) { duplicate = true; break; }
            }
          } catch {}
        }
        next[r.id] = duplicate;
      }
      setDupMap(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  if (!user) return <div className="p-6">Not authorized</div>;
  if (!isAdmin) return <div className="p-6">Not authorized</div>;

  const recentVerifiedCount = async (uid: string) => {
    const since = Timestamp.fromMillis(Date.now() - 24*60*60*1000);
    const qy = query(
      collection(db, 'reviews'),
      where('userId', '==', uid),
      where('verification.state','==','verified'),
      where('verification.verifiedAt','>=', since)
    );
    try {
      const snap = await getDocs(qy);
      return snap.size;
    } catch { return 0; }
  };

  const handleApprove = async (id: string, uid?: string) => {
    try {
      setBusyId(id);
      await adminApproveReview(id, points, user?.uid || '');
      await addDoc(coll(db, 'rewardsEvents'), { userId: uid || null, reviewId: id, points, method: 'admin', at: serverTimestamp() });
      setRows(prev => prev.filter(r => r.id !== id));
      setToast('Approved & awarded');
    } catch (e: any) {
      console.error(e);
      if (e?.code === 'DAILY_CAP') {
        setToast('Daily cap reached for this user. Try again tomorrow or override policy.');
      } else {
        setToast('Failed to approve');
      }
    } finally {
      setTimeout(() => setToast(null), 1600);
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection?') || 'Not sufficient';
    try {
      setBusyId(id);
      await adminRejectReview(id, reason, user?.uid || '');
      setRows(prev => prev.filter(r => r.id !== id));
      setToast('Rejected');
    } catch (e) {
      console.error(e);
      setToast('Failed to reject');
    } finally {
      setTimeout(() => setToast(null), 1600);
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold text-slate-900">Review Verification</div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={blockDuplicates} onChange={(e)=>setBlockDuplicates(e.target.checked)} />
              Block duplicate approvals
            </label>
            <label className="text-sm text-slate-600">Award points</label>
            <input type="number" className="w-20 rounded-lg border px-2 py-1" value={points} onChange={e=>setPoints(parseInt(e.target.value||'0',10)||0)} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left p-3">Review</th>
                <th className="text-left p-3">Restaurant</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Proofs</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{r.dish || r.dishName}</div>
                    <div className="text-xs text-slate-500">Rating {r.rating}</div>
                  </td>
                  <td className="p-3">{restaurantMap[r.restaurantId]?.name || r.restaurantId}</td>
                  <td className="p-3">
                    <div className="text-slate-800">{r.userId || '-'}</div>
                    <UserBurst uid={r.userId} />
                  </td>
                  <td className="p-3">
                    {typeof r?.verification?.matchScore === 'number' ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">Score {r.verification.matchScore.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '-'}</td>
                  <td className="p-3">
                    {Array.isArray(r.verification?.proofUrls) && r.verification.proofUrls.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {r.verification.proofUrls.map((u: string, i: number) => (
                          <div key={i}>
                            <a className="text-blue-600 hover:underline" href={u} target="_blank" rel="noreferrer">Proof {i+1}</a>
                            {dupMap[r.id] && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Duplicate proof</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button disabled={busyId===r.id || (blockDuplicates && !!dupMap[r.id])} title={blockDuplicates && dupMap[r.id] ? 'This receipt was used on another review' : undefined} className="mr-2 rounded-lg border px-3 py-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50" onClick={() => handleApprove(r.id, r.userId)}>Approve & award</button>
                    <button disabled={busyId===r.id} className="rounded-lg border px-3 py-1 text-rose-700 border-rose-300 hover:bg-rose-50 disabled:opacity-50" onClick={() => handleReject(r.id)}>Reject</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500" colSpan={6}>No pending reviews</td>
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

function UserBurst({ uid }: { uid?: string }) {
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => { (async () => {
    try {
      if (!uid) return;
      const since = Timestamp.fromMillis(Date.now() - 24*60*60*1000);
      const qy = query(collection(db, 'reviews'), where('userId','==',uid), where('verification.state','==','verified'), where('verification.verifiedAt','>=', since));
      const snap = await getDocs(qy);
      if (snap.size > 5) setWarning(`High volume: ${snap.size} verified in 24h`);
    } catch {}
  })(); }, [uid]);
  if (!warning) return null;
  return <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-0.5 inline-block mt-1">{warning}</div>;
}
