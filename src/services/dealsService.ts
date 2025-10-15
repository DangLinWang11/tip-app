import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, getCurrentUser } from '../lib/firebase';

export interface DealDraftInput {
  restaurantId: string;
  title: string;
  description?: string;
  validFrom?: string | null;
  validTo?: string | null;
}

export async function createDealDraft(input: DealDraftInput) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const data = {
    restaurantId: input.restaurantId,
    title: input.title,
    description: input.description || '',
    status: 'draft',
    validFrom: input.validFrom || null,
    validTo: input.validTo || null,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(collection(db, 'deals'), data);
}

export async function submitDealForApproval(dealId: string) {
  await updateDoc(doc(db, 'deals', dealId), {
    status: 'submitted',
    updatedAt: serverTimestamp(),
  });
}

export async function listDealsForRestaurant(restaurantId: string) {
  const q = query(
    collection(db, 'deals'),
    where('restaurantId', '==', restaurantId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

