import React, { useState, useEffect, useMemo, startTransition } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, HeartIcon, MessageCircleIcon, BookmarkIcon, ShareIcon, CheckCircleIcon, MapPinIcon } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FirebaseReview } from '../services/reviewService';
import RatingBadge from '../components/RatingBadge';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useUserStore } from '../stores/userStore';

interface PostDetailProps {}

interface FeedPostAuthor {
  id: string;
  name: string;
  image: string;
  isVerified: boolean;
}

const PostDetail: React.FC<PostDetailProps> = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const getProfileCached = useUserStore(state => state.getProfileCached);
  
  const [post, setPost] = useState<FirebaseReview | null>(null);
  const [author, setAuthor] = useState<FeedPostAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Optimized: Memoize avatar generation - only recalculate when author changes
  const authorAvatar = useMemo(() => {
    if (!author) return '';
    return author.image;
  }, [author]);

  // Function to get quality circle color based on percentage
  const getQualityColor = (percentage: number): string => {
    const clampedScore = Math.max(0, Math.min(100, percentage));

    if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
    if (clampedScore >= 80) return '#4F9B75'; // Very Good
    if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
    if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
    if (clampedScore >= 50) return '#F0A43C'; // Declining
    if (clampedScore >= 36) return '#E06B2D'; // Poor
    return '#C92A2A';                          // Hard Red / Avoid
  };

  // Function to format timestamp Instagram-style
  const formatInstagramTimestamp = (dateString: string): string => {
    const reviewDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - reviewDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays <= 30) {
      return `${diffDays}d`;
    } else {
      const month = reviewDate.getMonth() + 1;
      const day = reviewDate.getDate();
      const year = reviewDate.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    }
  };

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) {
        setError('No post ID provided');
        setLoading(false);
        return;
      }

      try {
        console.log('[PostDetail] Fetching post with ID:', postId);
        
        // Fetch the review document from Firestore
        const postRef = doc(db, 'reviews', postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) {
          setError('Post not found');
          setLoading(false);
          return;
        }

        const postData = {
          id: postSnap.id,
          ...postSnap.data()
        } as FirebaseReview;

        // Set post data immediately with startTransition for non-blocking update
        startTransition(() => {
          setPost(postData);
          setLikeCount(Math.floor(Math.random() * 50) + 10);
          setLoading(false); // Show UI immediately
        });

        // Set placeholder author immediately (silent update pattern)
        if (postData.userId) {
          const placeholderImage = getAvatarUrl({ username: postData.userId });
          setAuthor({
            id: postData.userId,
            name: 'Loading...',
            image: placeholderImage,
            isVerified: false
          });

          // Fetch user profile from cache asynchronously
          getProfileCached(postData.userId).then(profile => {
            if (profile) {
              startTransition(() => {
                setAuthor({
                  id: postData.userId,
                  name: profile.displayName || profile.username,
                  image: getAvatarUrl(profile),
                  isVerified: (profile as any).isVerified || false
                });
              });
            } else {
              startTransition(() => {
                setAuthor({
                  id: postData.userId,
                  name: 'Anonymous User',
                  image: placeholderImage,
                  isVerified: false
                });
              });
            }
          }).catch(error => {
            console.warn('[PostDetail] Failed to fetch author:', error);
            startTransition(() => {
              setAuthor({
                id: postData.userId,
                name: 'Anonymous User',
                image: placeholderImage,
                isVerified: false
              });
            });
          });
        }

      } catch (error) {
        console.error('[PostDetail] Error fetching post:', error);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, getProfileCached]);

  const handleBack = () => {
    // Abort any pending network requests
    if (window.stop) {
      window.stop();
    }
    navigate(-1);
  };

  const handleUserClick = () => {
    if (author) {
      navigate(`/user/${author.name}`);
    }
  };

  const handleRestaurantClick = () => {
    if (post?.restaurantId) {
      navigate(`/restaurant/${post.restaurantId}`);
    }
  };

  const handleDishClick = () => {
    if (post?.menuItemId) {
      navigate(`/dish/${post.menuItemId}`);
    } else if (post?.restaurantId) {
      navigate(`/restaurant/${post.restaurantId}`);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${post?.dish} at ${post?.restaurant}`,
        text: `Check out this ${post?.rating}/10 rated dish!`,
        url: window.location.href
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Post Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The post you are looking for does not exist.'}</p>
          <button 
            onClick={handleBack}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors mr-3"
          >
            <ArrowLeftIcon size={20} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Post</h1>
        </div>
      </div>

      {/* Post content */}
      <div className="max-w-2xl mx-auto bg-white">
        {/* Author header */}
        <div className="p-6 flex items-center gap-4">
          <img
            src={authorAvatar}
            alt={author?.name}
            loading="lazy"
            decoding="async"
            className="w-12 h-12 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span 
                onClick={handleUserClick}
                className="font-medium text-lg cursor-pointer hover:text-primary"
              >
                {author?.name}
              </span>
              {author?.isVerified && (
                <CheckCircleIcon size={18} className="text-blue-500" />
              )}
            </div>
            {post.restaurant && (
              <div className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                <MapPinIcon size={14} className="text-red-500" />
                <span 
                  onClick={handleRestaurantClick}
                  className={`hover:text-primary cursor-pointer`}
                >
                  {post.restaurant}
                </span>
                <CheckCircleIcon size={14} className="text-secondary" />
                <div 
                  className="w-8 h-5 flex items-center justify-center rounded-full ml-1"
                  style={{ backgroundColor: getQualityColor(85) }}
                >
                  <span className="text-xs font-medium text-white">85%</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <RatingBadge rating={post.rating} size="lg" />
          </div>
        </div>
        
        {/* Image */}
        <div className="relative">
          <img
            src={(Array.isArray(post.images) && post.images.length > 0) ? post.images[0] : `https://source.unsplash.com/800x600/?food,${encodeURIComponent(post.dish)}`}
            alt={post.dish}
            loading="lazy"
            decoding="async"
            className="w-full aspect-square object-cover" 
          />
          {post.visitedTimes && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              Visited {post.visitedTimes}x
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-2xl">
              <span 
                onClick={handleDishClick}
                className="hover:text-primary cursor-pointer"
              >
                {post.dish}
              </span>
            </h2>
            <span className="text-sm text-gray-400 ml-2 flex-shrink-0">
              {formatInstagramTimestamp(post.createdAt)}
            </span>
          </div>
          
          {/* Price */}
          {post.price && (
            <div className="mb-4">
              <span className="text-lg font-medium text-green-600">{post.price}</span>
            </div>
          )}
          
          {/* Dual Review System */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm font-medium">+</span>
              </div>
              <p className="text-base flex-1 leading-relaxed">{post.personalNote}</p>
            </div>
            <div className="flex items-start">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                <span className="text-red-600 text-sm font-medium">-</span>
              </div>
              <p className="text-base flex-1 leading-relaxed">{post.negativeNote}</p>
            </div>
          </div>

          {/* Tags */}
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Engagement buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-6">
              <button 
                onClick={handleLike}
                className="flex items-center text-gray-600 hover:text-red-500 transition-colors"
              >
                <HeartIcon 
                  size={24} 
                  className={`mr-2 ${liked ? 'fill-red-500 text-red-500' : ''}`} 
                />
                <span className="text-base font-medium">{likeCount}</span>
              </button>
              <button className="flex items-center text-gray-600 hover:text-blue-500 transition-colors">
                <MessageCircleIcon size={24} className="mr-2" />
                <span className="text-base font-medium">Comment</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setSaved(!saved)}
                className="flex items-center text-gray-600 hover:text-primary transition-colors"
              >
                <BookmarkIcon 
                  size={24} 
                  className={`mr-1 ${saved ? 'text-primary fill-primary' : ''}`} 
                />
                <span className="text-base">{saved ? 'Saved' : 'Save'}</span>
              </button>
              <button 
                onClick={handleShare}
                className="text-gray-600 hover:text-blue-500 transition-colors"
              >
                <ShareIcon size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
