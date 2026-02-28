import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Send } from 'lucide-react';
import { addComment, getComments, deleteComment, type Comment } from '../../services/reviewService';
import { getCurrentUser, getUserProfile } from '../../lib/firebase';
import { getAvatarUrl } from '../../utils/avatarUtils';

interface CommentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  reviewAuthorName?: string;
}

const CommentSheet: React.FC<CommentSheetProps> = ({
  isOpen,
  onClose,
  reviewId,
  reviewAuthorName,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readPermissionDenied, setReadPermissionDenied] = useState(false);
  const [writePermissionDenied, setWritePermissionDenied] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(72);
  const [composerAvatarUrl, setComposerAvatarUrl] = useState<string>(() =>
    getAvatarUrl({ username: 'me', displayName: 'Me', avatar: '' })
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef<number>(0);
  const currentUser = getCurrentUser();
  const composerDisabled = !currentUser || writePermissionDenied;

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, reviewId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCommentText('');
      setError(null);
      setReadPermissionDenied(false);
      setWritePermissionDenied(false);
    }
  }, [isOpen]);

  // Resolve composer avatar (current user)
  useEffect(() => {
    if (!isOpen) return;
    if (!currentUser) {
      setComposerAvatarUrl(getAvatarUrl({ username: 'me', displayName: 'Me', avatar: '' }));
      return;
    }

    if (currentUser.photoURL) {
      setComposerAvatarUrl(currentUser.photoURL);
      return;
    }

    let cancelled = false;
    const loadProfileAvatar = async () => {
      try {
        const result = await getUserProfile(currentUser.uid);
        if (cancelled) return;
        if (result.success && result.profile) {
          const profile = result.profile;
          const avatar = getAvatarUrl({
            avatar: profile.avatar || profile.photoURL || '',
            username: profile.username,
            displayName: profile.displayName || profile.actualName || profile.username
          });
          setComposerAvatarUrl(avatar);
        }
      } catch {
        if (!cancelled) {
          setComposerAvatarUrl(getAvatarUrl({ username: 'me', displayName: 'Me', avatar: '' }));
        }
      }
    };
    loadProfileAvatar();
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser]);

  // Lock background scroll on open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const { body } = document;
    scrollLockRef.current = window.scrollY || window.pageYOffset || 0;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflowY: body.style.overflowY,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollLockRef.current}px`;
    body.style.width = '100%';
    body.style.overflowY = 'scroll';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflowY = previous.overflowY;
      window.scrollTo(0, scrollLockRef.current);
    };
  }, [isOpen]);

  // Track keyboard inset using visualViewport (iOS PWA)
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset);
    };
    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, [isOpen]);

  // Measure composer height to pad list area correctly
  useEffect(() => {
    if (!isOpen || !composerRef.current) return;
    const el = composerRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setComposerHeight(rect.height);
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [isOpen]);

  const isPermissionError = (err: any) => {
    const message = String(err?.message || '').toLowerCase();
    return err?.code === 'permission-denied' || message.includes('permission');
  };

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    setReadPermissionDenied(false);
    try {
      const fetchedComments = await getComments(reviewId);
      setComments(fetchedComments);
    } catch (err: any) {
      if (isPermissionError(err)) {
        setReadPermissionDenied(true);
      } else {
        setError(err.message || 'Failed to load comments');
      }
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (composerDisabled) return;
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      await addComment(reviewId, trimmed);
      setCommentText('');
      // Reload comments to show the new one
      await loadComments();
    } catch (err: any) {
      if (isPermissionError(err)) {
        setWritePermissionDenied(true);
      } else {
        setError(err.message || 'Failed to post comment');
      }
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;

    try {
      await deleteComment(reviewId, commentId);
      // Reload comments to reflect the deletion
      await loadComments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
      console.error('Error deleting comment:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  if (!isOpen) return null;

  const sheet = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      {/* Sheet Container */}
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-lg flex flex-col overflow-hidden animate-[slideUp_200ms_ease-out] mx-auto"
        style={{
          height: 'min(85dvh, 720px)',
          maxHeight: 'min(85dvh, 720px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          ['--kb' as any]: `${keyboardInset}px`,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
            {reviewAuthorName && (
              <p className="text-xs text-gray-500">on {reviewAuthorName}'s post</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Comments List - scrollable */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: `calc(${composerHeight}px + var(--kb, 0px) + env(safe-area-inset-bottom))`,
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Loading comments...</div>
            </div>
          ) : readPermissionDenied ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-600">You don’t have permission to view comments.</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Be the first to comment</div>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* User Avatar */}
                  <img
                    src={comment.userPhoto || 'https://via.placeholder.com/40'}
                    alt={comment.userName || 'User'}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-2xl px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">
                        {comment.userName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                        {comment.text}
                      </p>
                    </div>

                    {/* Comment Actions */}
                    <div className="flex items-center gap-3 mt-1 px-3">
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                      {currentUser?.uid === comment.userId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area - fixed at bottom */}
        <div
          ref={composerRef}
          className="border-t border-gray-200 p-4 bg-white"
          style={{
            transform: 'translateY(calc(-1 * var(--kb, 0px)))',
          }}
        >
          {error && !readPermissionDenied && (
            <div className="mb-2 text-xs text-red-600">{error}</div>
          )}
          <div className="flex items-end gap-2">
            {/* User Avatar */}
            <img
              src={composerAvatarUrl}
              alt="You"
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={composerDisabled ? 'Sign in to comment' : 'Add a comment...'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                rows={1}
                style={{ maxHeight: '100px' }}
                disabled={submitting || composerDisabled}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || submitting || composerDisabled}
              className={`p-2 rounded-full transition-colors ${
                commentText.trim() && !submitting && !composerDisabled
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send comment"
            >
              <Send size={18} />
            </button>
          </div>
          {composerDisabled ? (
            <div className="mt-2 text-xs text-gray-500">
              {currentUser ? 'You don’t have permission to comment.' : 'Sign in to comment.'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return sheet;
  }

  return createPortal(sheet, document.body);
};

// Helper function to format timestamps
function formatTimestamp(timestamp: any): string {
  if (!timestamp) return 'just now';

  // Handle Firestore Timestamp
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default CommentSheet;
