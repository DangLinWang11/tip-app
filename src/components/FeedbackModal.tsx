import React, { useState } from 'react';
import { X } from 'lucide-react';
import { submitFeedback } from '../services/feedbackService';
import ReactDOM from 'react-dom';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'question' | 'suggestion';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType || !message.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback(selectedType, message);

      if (result.success) {
        setShowSuccess(true);
        setMessage('');
        setSelectedType(null);

        // Show success message for 2 seconds then close
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 2000);
      } else {
        alert(result.error || 'Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setMessage('');
      setSelectedType(null);
      setShowSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const categories = [
    { type: 'bug' as FeedbackType, label: 'Bug', emoji: '🐛', description: 'Report a problem' },
    { type: 'question' as FeedbackType, label: 'Question', emoji: '❓', description: 'Ask us anything' },
    { type: 'suggestion' as FeedbackType, label: 'Suggestion', emoji: '💡', description: 'Share your ideas' }
  ];

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Help & Feedback</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="p-6 bg-green-50 border-b border-green-100">
            <p className="text-green-800 font-medium text-center">
              Thanks for the feedback! 🎉
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Pills */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              What can we help you with?
            </label>
            <div className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <button
                  key={category.type}
                  type="button"
                  onClick={() => setSelectedType(category.type)}
                  disabled={isSubmitting}
                  className={`
                    flex-1 min-w-[140px] px-4 py-3 rounded-xl border-2 transition-all
                    ${
                      selectedType === category.type
                        ? 'border-primary bg-red-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">{category.emoji}</div>
                    <div className="font-semibold text-gray-900">{category.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{category.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Tell us what's on your mind...
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              required
              rows={6}
              className="
                w-full px-4 py-3 rounded-xl border-2 border-gray-200
                focus:outline-none focus:border-primary focus:ring-2 focus:ring-red-100
                resize-none text-gray-900 placeholder-gray-400
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
              "
              placeholder="Share your thoughts, ideas, or let us know if something isn't working right..."
            />
            <p className="mt-2 text-xs text-gray-500">
              We read every message and use your feedback to make our app better.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedType || !message.trim() || isSubmitting}
            className="
              w-full py-3 px-4 rounded-xl font-semibold text-white
              bg-primary hover:bg-red-600
              disabled:bg-gray-300 disabled:cursor-not-allowed
              transition-colors shadow-sm
            "
          >
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return ReactDOM.createPortal(modalContent, document.body);
};

export default FeedbackModal;
