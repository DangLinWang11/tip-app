import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditListNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  currentName: string;
  onSave: (listId: string, newName: string) => Promise<void>;
}

const EditListNameModal: React.FC<EditListNameModalProps> = ({
  isOpen,
  onClose,
  listId,
  currentName,
  onSave
}) => {
  const [newName, setNewName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSave = async () => {
    if (!newName.trim()) {
      setError('List name cannot be empty');
      return;
    }

    if (newName.trim() === currentName.trim()) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(listId, newName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update list name');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Edit List Name</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={saving}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          {/* Input Field */}
          <div className="mb-4">
            <label htmlFor="listName" className="block text-sm font-medium text-gray-700 mb-2">
              List Name
            </label>
            <input
              id="listName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              placeholder="Enter list name..."
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !newName.trim()}
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditListNameModal;