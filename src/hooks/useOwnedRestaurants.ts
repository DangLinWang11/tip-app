import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

let cache: { uid: string; ids: string[] } | null = null;

export function useOwnedRestaurants() {
  const user = auth.currentUser;
  const [ids, setIds] = useState<string[]>(cache && cache.uid === user?.uid ? cache.ids : []);

  useEffect(() => {
    (async () => {
      if (!user) { setIds([]); return; }
      if (cache && cache.uid === user.uid) { setIds(cache.ids); return; }
      try {
        // Primary + fallback
        const q1 = query(collection(db, 'restaurants'), where('ownerIds', 'array-contains', user.uid));
        const q2 = query(collection(db, 'restaurants'), where('ownerUid', '==', user.uid));
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const set = new Set<string>([...s1.docs.map(d => d.id), ...s2.docs.map(d => d.id)]);
        const list = Array.from(set);
        cache = { uid: user.uid, ids: list };
        setIds(list);
      } catch {
        setIds([]);
      }
    })();
  }, [user?.uid]);

  return { ownedRestaurantIds: ids, ownsAny: ids.length > 0 };
}
