import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Send } from 'lucide-react';
import { addComment, getComments, deleteComment, type Comment } from '../../services/reviewService';
import { getCurrentUser } from '../../lib/firebase';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentUser = getCurrentUser();

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
    }
  }, [isOpen]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedComments = await getComments(reviewId);
      setComments(fetchedComments);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
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
      setError(err.message || 'Failed to post comment');
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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      {/* Sheet Container */}
      <div
        className="w-full max-w-md h-[85vh] rounded-t-2xl bg-white shadow-lg flex flex-col animate-[slideUp_200ms_ease-out] mx-auto"
        onClick={(e) => e.stopPropagation()}
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
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Loading comments...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">No comments yet. Be the first!</div>
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
        <div className="border-t border-gray-200 p-4 bg-white">
          {error && (
            <div className="mb-2 text-xs text-red-600">{error}</div>
          )}
          <div className="flex items-end gap-2">
            {/* User Avatar */}
            <img
              src={currentUser?.photoURL || 'https://via.placeholder.com/40'}
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
                placeholder="Add a comment..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                rows={1}
                style={{ maxHeight: '100px' }}
                disabled={submitting}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || submitting}
              className={`p-2 rounded-full transition-colors ${
                commentText.trim() && !submitting
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send comment"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
