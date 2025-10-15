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
        const qy = query(collection(db, 'restaurants'), where('ownerIds', 'array-contains', user.uid));
        const snap = await getDocs(qy);
        const list = snap.docs.map(d => d.id);
        cache = { uid: user.uid, ids: list };
        setIds(list);
      } catch {
        setIds([]);
      }
    })();
  }, [user?.uid]);

  return { ownedRestaurantIds: ids, ownsAny: ids.length > 0 };
}

