import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_DURATION_SECONDS = 20;
export const MAX_IMAGE_EDGE = 1600;

export interface MediaUploadResult {
  storagePath: string;
  downloadURL: string;
}

export interface PreparedMedia {
  file: File;
  previewUrl: string;
}

const ensureStorage = () => {
  if (!storage) {
    throw new Error('Firebase storage is not initialized');
  }
  return storage;
};

export const isImageFile = (file: File) => file.type.startsWith('image/');
export const isVideoFile = (file: File) => file.type.startsWith('video/');

export const compressImage = async (file: File, maxEdge = MAX_IMAGE_EDGE): Promise<File> => {
  if (!isImageFile(file)) return file;
  if (file.size <= MAX_IMAGE_SIZE_BYTES && maxEdge >= MAX_IMAGE_EDGE) {
    return file;
  }

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup: (() => void) | undefined;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(url);
  }

  const longestEdge = Math.max(width, height);
  const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    cleanup?.();
    throw new Error('Canvas context unavailable');
  }

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  cleanup?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85);
  });

  if (!blob) {
    throw new Error('Failed to compress image');
  }

  const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg'
  });

  return compressedFile;
};

export const validateVideoFile = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!isVideoFile(file)) {
      reject(new Error('Unsupported file type'));
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      reject(new Error('File too large'));
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = video.duration;
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        reject(new Error('Video too long'));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cannot load video'));
    };
  });
};

export const createVideoThumbnail = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        cleanup();
        if (!blob) {
          reject(new Error('Failed to create thumbnail'));
          return;
        }
        const thumbnailFile = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}_thumb.jpg`, {
          type: 'image/jpeg'
        });
        resolve(thumbnailFile);
      }, 'image/jpeg', 0.8);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Cannot capture thumbnail'));
    };
  });
};

const generateStoragePath = (userId: string, prefix: string, extension: string) => {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `reviews/${userId}/${prefix}_${stamp}_${random}.${extension}`;
};

const uploadFileToStorage = async (file: File, storagePath: string): Promise<MediaUploadResult> => {
  const targetStorage = ensureStorage();
  const fileRef = ref(targetStorage, storagePath);
  const snapshot = await uploadBytes(fileRef, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(snapshot.ref);
  return {
    storagePath: snapshot.ref.toString(),
    downloadURL
  };
};

export const processAndUploadImage = async (file: File, userId: string): Promise<MediaUploadResult> => {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    file = await compressImage(file);
  }
  const extension = file.type.includes('png') ? 'png' : 'jpg';
  const storagePath = generateStoragePath(userId, 'photo', extension);
  return uploadFileToStorage(file, storagePath);
};

export const processAndUploadVideo = async (file: File, userId: string): Promise<{ video: MediaUploadResult; thumbnail: MediaUploadResult }> => {
  await validateVideoFile(file);
  const videoExtension = file.type.includes('webm') ? 'webm' : 'mp4';
  const videoPath = generateStoragePath(userId, 'video', videoExtension);
  const videoUpload = await uploadFileToStorage(file, videoPath);

  const thumbnailFile = await createVideoThumbnail(file);
  const thumbPath = generateStoragePath(userId, 'thumb', 'jpg');
  const thumbUpload = await uploadFileToStorage(thumbnailFile, thumbPath);

  return {
    video: videoUpload,
    thumbnail: thumbUpload
  };
};

export const revokePreview = (url?: string) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

export const fileToPreview = (file: File): string => {
  return URL.createObjectURL(file);
};
