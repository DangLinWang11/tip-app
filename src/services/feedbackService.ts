import { db, getCurrentUser } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface FeedbackData {
  userId: string;
  userName: string;
  userEmail?: string;
  type: 'bug' | 'question' | 'suggestion';
  message: string;
  timestamp: any;
  status: 'new' | 'in-progress' | 'resolved';
}

export const submitFeedback = async (
  type: 'bug' | 'question' | 'suggestion',
  message: string
): Promise<{ success: boolean; error?: string }> => {
  if (!db) {
    const error = 'Firestore not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    const error = 'No authenticated user';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!message || !message.trim()) {
    const error = 'Message is required';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('💬 Submitting feedback from user:', currentUser.uid);

    const feedbackData: FeedbackData = {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || 'Anonymous',
      userEmail: currentUser.email || undefined,
      type,
      message: message.trim(),
      timestamp: serverTimestamp(),
      status: 'new'
    };

    await addDoc(collection(db, 'feedback'), feedbackData);

    console.log('✅ Feedback submitted successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to submit feedback:', error);

    let errorMessage = 'Failed to submit feedback';

    switch (error.code) {
      case 'permission-denied':
        errorMessage = 'Permission denied. Please check Firestore security rules';
        break;
      case 'unavailable':
        errorMessage = 'Service temporarily unavailable. Please try again';
        break;
      case 'deadline-exceeded':
        errorMessage = 'Request timeout. Please check your internet connection';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }

    return { success: false, error: errorMessage };
  }
};
