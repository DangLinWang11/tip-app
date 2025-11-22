import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../lib/firebase';
import { getOwnedRestaurants, fetchRestaurantKpis, submitOwnerClaim, getOrUpdateStatsCache } from '../../services/ownerPortalService';
import RestaurantSwitcher from '../../components/owner/RestaurantSwitcher';
import { KpiCards } from '../../components/owner/cards/KpiCards';
import Trends from '../../components/owner/charts/Trends';
import TagDistribution from '../../components/owner/charts/TagDistribution';
import TopDishes from '../../components/owner/TopDishes';
import RecentPhotos from '../../components/owner/RecentPhotos';
import DealForm from '../../components/owner/DealForm';
import { listDealsForRestaurant } from '../../services/dealsService';
import { collection, getDocs, limit, orderBy, query, startAt, endAt } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadClaimProofs } from '../../services/claimsService';

export default function OwnerPortal() {
  const location = useLocation();
  const user = getCurrentUser();
  const [owned, setOwned] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any | null>(null);
  const [tags30, setTags30] = useState<Record<string, number>>({});
  const [deals, setDeals] = useState<any[]>([]);
  const [showClaim, setShowClaim] = useState(false);

  const signedIn = !!user;

  useEffect(() => {
    (async () => {
      if (!user) return;
      const restaurants = await getOwnedRestaurants(user.uid);
      setOwned(restaurants);
      setSelected(restaurants[0]?.id);
      setLoading(false);
    })();
  }, [user?.uid]);

  // Deep-link handling: ?start=claim, ?claim=<restaurantId>
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const start = sp.get('start');
    const claimId = sp.get('claim');
    if (start === 'claim') {
      setShowClaim(true);
    }
    if (claimId) {
      setClaimRestaurantId(claimId);
      setShowClaim(true);
      // scroll into view after a tick
      setTimeout(() => {
        document.getElementById('claim-panel')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!selected) return;
      // Prefer cache
      try {
        const data = await getOrUpdateStatsCache(selected, async () => {
          const res = await fetchRestaurantKpis(selected, 30);
          return { ...res, lastUpdated: new Date() };
        });
        if (data?.kpis) {
          setKpis({ ...data.kpis, topDishes: data.topDishes, photos: data.photos, lastUpdated: data.lastUpdated });
          setTags30(data.tagCounts || {});
        } else {
          // Fallback live compute
          const { kpis, tagCounts, topDishes, photos } = await fetchRestaurantKpis(selected, 30);
          setKpis({ ...kpis, topDishes, photos, lastUpdated: new Date() });
          setTags30(tagCounts);
        }
      } catch {
        const { kpis, tagCounts, topDishes, photos } = await fetchRestaurantKpis(selected, 30);
        setKpis({ ...kpis, topDishes, photos, lastUpdated: new Date() });
        setTags30(tagCounts);
      }
      const ds = await listDealsForRestaurant(selected);
      setDeals(ds);
    })();
  }, [selected]);

  // Claim flow state (for users with 0 owned restaurants)
  const [claimRestaurantId, setClaimRestaurantId] = useState('');
  const [claimBusinessName, setClaimBusinessName] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimEmail, setClaimEmail] = useState(user?.email || '');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimLink, setClaimLink] = useState('');
  const [proofFiles, setProofFiles] = useState<FileList | null>(null);
  const [claimMsg, setClaimMsg] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingProofs, setIsUploadingProofs] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});

  // Autocomplete for restaurants
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCantFind, setShowCantFind] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = searchTerm.trim();
      if (!term) { setSearchResults([]); return; }
      try {
        const qy = query(
          collection(db, 'restaurants'),
          orderBy('name'),
          startAt(term),
          endAt(term + '\uf8ff'),
          limit(10)
        );
        const snap = await getDocs(qy);
        const rows = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Restaurant', address: (d.data() as any).address }));
        setSearchResults(rows);
        setSearchOpen(true);
      } catch (e) {
        setSearchResults([]);
        setSearchOpen(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const handleSubmitClaimWithProofs = async () => {
    if (!claimRestaurantId.trim()) return;
    setUploadError(null);
    const ref = await submitOwnerClaim({
      restaurantId: claimRestaurantId.trim(),
      notes: [claimNotes, `business: ${claimBusinessName}`, `phone: ${claimPhone}`, claimLink].filter(Boolean).join(' \n '),
      contactEmail: claimEmail,
      supportingLink: claimLink
    });
    if (proofFiles && proofFiles.length > 0) {
      try {
        setIsUploadingProofs(true);
        const urls = await uploadClaimProofs(ref.id, Array.from(proofFiles), (idx, pct) => {
          setProgressMap((m) => ({ ...m, [idx]: pct }));
        });
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await updateDoc(doc(db, 'owner_claims', ref.id), { proofUrls: urls });
      } catch (e) {
        console.warn('Proof upload failed:', e);
        setUploadError('Upload failed. Please try again.');
        setIsUploadingProofs(false);
        return;
      }
      setIsUploadingProofs(false);
    }
    setClaimMsg('Request submitted! Our team will review.');
    setClaimRestaurantId('');
    setClaimBusinessName('');
    setClaimNotes('');
    setClaimEmail('');
    setClaimPhone('');
    setClaimLink('');
    setProofFiles(null);
    setProgressMap({});
  };

  if (!signedIn) {
    // Preserve any existing query string (e.g., start=claim, claim=ID) so
    // we only deep-link into claim flow when explicitly requested.
    const search = window.location.search || '';
    const path = window.location.pathname || '/owner';
    const enc = encodeURIComponent(`${path}${search}`);
    window.location.assign(`/login?redirect=${enc}`);
    return null;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Decide which surface to show
  const forceDashboard = location.pathname.endsWith('/owner/dashboard') || (new URLSearchParams(location.search).get('start') === 'dashboard');
  const shouldShowClaim = showClaim || (!forceDashboard && owned.length === 0);

  // If no owned restaurants and not forcing dashboard, show claim UI
  if (shouldShowClaim) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-2xl font-bold text-slate-900">Owner Portal</div>
          <div id="claim-panel" className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold text-slate-900 mb-2">Claim your restaurant</div>
            <p className="text-sm text-slate-600 mb-4">Tip owners get insights, top dishes, and simple promos — all free.</p>
            <div className="grid gap-3">
              {/* Autocomplete: restaurant search */}
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-300 p-2 text-base"
                  placeholder="Search restaurant by name"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchOpen(!!searchResults.length)}
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow">
                    {searchResults.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setClaimRestaurantId(r.id);
                          setClaimBusinessName(r.name);
                          setSearchTerm(r.name);
                          setSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="text-sm text-slate-900">{r.name}</div>
                        {r.address ? <div className="text-xs text-slate-500">{r.address}</div> : null}
                      </button>
                    ))}
                  </div>
                )}
                {searchOpen && searchResults.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow p-3 text-sm text-slate-600">
                    No results. <button className="underline" onClick={() => setShowCantFind(true)}>Can’t find your restaurant?</button>
                  </div>
                )}
              </div>
              <input className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Restaurant ID (auto-set on select)" value={claimRestaurantId} onChange={e => setClaimRestaurantId(e.target.value)} />
              <input className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Business Name" value={claimBusinessName} onChange={e => setClaimBusinessName(e.target.value)} />
              <input className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Contact email" value={claimEmail} onChange={e => setClaimEmail(e.target.value)} />
              <input className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Contact phone (optional)" value={claimPhone} onChange={e => setClaimPhone(e.target.value)} />
              <input className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Supporting link (website or social)" value={claimLink} onChange={e => setClaimLink(e.target.value)} />
              <textarea className="rounded-xl border border-slate-300 p-2 text-base" placeholder="Notes (optional)" value={claimNotes} onChange={e => setClaimNotes(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proof files (optional)</label>
                <input type="file" multiple onChange={e => setProofFiles(e.target.files)} className="text-base" />
                <p className="text-xs text-slate-500 mt-1">Upload a photo of license, POS, or utility bill. Visible only to admins.</p>
                {proofFiles && proofFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Array.from(proofFiles).map((f, i) => (
                      <div key={i} className="text-xs text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="truncate mr-2">{f.name}</span>
                          <span>{progressMap[i] ? `${progressMap[i]}%` : ''}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded">
                          <div className="h-1 bg-emerald-500 rounded" style={{ width: `${progressMap[i] || 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {uploadError ? <div className="text-xs text-rose-600 mt-1">{uploadError}</div> : null}
              </div>
              <button disabled={isUploadingProofs} className="rounded-xl bg-red-500 px-4 py-2 text-white text-sm disabled:opacity-50" onClick={handleSubmitClaimWithProofs}>Submit claim</button>
              {claimMsg ? <div className="text-sm text-emerald-600">{claimMsg}</div> : null}
              {showCantFind && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="font-semibold mb-1">Can’t find your restaurant?</div>
                  <p>Please contact us at support@tipapp.example with your business name, address, and a link to a website or social page. We’ll help get it added.</p>
                  <div className="mt-2">
                    <button className="text-xs underline" onClick={() => setShowCantFind(false)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If dashboard explicitly requested but user has no ownerships, show an empty state
  if (forceDashboard && owned.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-2xl font-bold text-slate-900">Owner Portal</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold text-slate-900 mb-2">No restaurants linked to your account</div>
            <p className="text-sm text-slate-600 mb-4">To access analytics, first claim your restaurant.</p>
            <a href="/owner?start=claim" className="inline-block rounded-xl bg-red-500 px-4 py-2 text-white text-sm">Claim my restaurant</a>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard for selected restaurant
  const topDishes = kpis?.topDishes || [];
  const photos = kpis?.photos || [];

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">Owner Portal</div>
            {kpis?.lastUpdated ? (
              <div className="text-xs text-slate-500 mt-1">Last updated: {new Date(kpis.lastUpdated?.toDate ? kpis.lastUpdated.toDate() : kpis.lastUpdated).toLocaleString()}</div>
            ) : null}
          </div>
          <RestaurantSwitcher options={owned} value={selected} onChange={setSelected} />
        </div>

        {kpis ? (
          <>
            <KpiCards reviewCount={kpis.reviewCount} uniqueReviewers={kpis.uniqueReviewers} prevCount={kpis.reviewCountPrev} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Trends series={kpis.trendSeries} />
              </div>
              <div>
                <TagDistribution tags={tags30} title="Top Tags (30d)" />
              </div>
            </div>
            <TopDishes rows={topDishes} />
            <RecentPhotos items={photos} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DealForm restaurantId={selected!} onCreated={async () => { const ds = await listDealsForRestaurant(selected!); setDeals(ds); }} />
              <div className="self-stretch">
                <Suspense>
                  {/* Simple deals list */}
                </Suspense>
                {/* Inline list to avoid extra imports */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Deals</div>
                  {!deals?.length ? (
                    <div className="text-sm text-slate-500">No deals yet</div>
                  ) : (
                    <div className="space-y-2">
                      {deals.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{d.title}</div>
                            <div className="text-xs text-slate-600">{d.description}</div>
                          </div>
                          <div className="text-xs font-semibold rounded-full px-2 py-1 border">{String(d.status)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">Loading metrics…</div>
        )}
      </div>
    </div>
  );
}
