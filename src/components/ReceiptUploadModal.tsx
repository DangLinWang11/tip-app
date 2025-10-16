import React, { useState, useRef } from 'react';
import { X, Camera, Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
}

const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      await onUpload(Array.from(files));
      setUploadComplete(true);
      setTimeout(() => {
        onClose();
        setUploadComplete(false);
      }, 1500);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white shadow-2xl pb-6 animate-[slideUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-6 pt-2 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Verify Your Purchase</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Explanation */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText size={16} className="text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Why do we need this?</h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  To maintain trust and earn rewards, we verify all reviews. Upload a receipt or screenshot
                  showing your purchase from your bank, credit card, or payment app.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Choose upload method:</h3>

            {/* Camera Option */}
            <button
              onClick={handleCameraClick}
              disabled={uploading}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <Camera size={24} className="text-red-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Take Photo</div>
                <div className="text-sm text-gray-500">Use your camera</div>
              </div>
            </button>

            {/* Upload from Device */}
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Upload size={24} className="text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Choose from Device</div>
                <div className="text-sm text-gray-500">Photos, PDFs, or screenshots</div>
              </div>
            </button>
          </div>

          {/* Upload Status */}
          {uploading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 size={20} className="animate-spin text-red-500" />
              <span className="text-sm font-medium text-gray-700">Uploading...</span>
            </div>
          )}

          {uploadComplete && (
            <div className="flex items-center justify-center gap-3 py-4 bg-green-50 rounded-2xl">
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="text-sm font-semibold text-green-700">Upload complete!</span>
            </div>
          )}

          {/* Info Note */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Your receipt will be reviewed within 24 hours. Once verified, you'll earn reward points!
              We protect your privacy and only use receipts for verification purposes.
            </p>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>
    </div>
  );
};

export default ReceiptUploadModal;
