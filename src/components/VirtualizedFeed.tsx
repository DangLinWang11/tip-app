import React, { useEffect, useRef } from 'react';
import FeedPost from './FeedPost';

interface VirtualizedFeedProps {
  posts: any[];
  followingMap: Map<string, boolean>;
  onFollowChange: (userId: string, isFollowing: boolean) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const VirtualizedFeed: React.FC<VirtualizedFeedProps> = ({
  posts,
  followingMap,
  onFollowChange,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  // SAFE START: Defensive check to prevent crashes from undefined/invalid posts
  if (!posts || !Array.isArray(posts)) {
    console.warn('[VirtualizedFeed] Invalid posts prop:', posts);
    return null;
  }

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll detection with Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observerRef.current.observe(currentRef);
    }

    return () => {
      if (observerRef.current && currentRef) {
        observerRef.current.unobserve(currentRef);
      }
    };
  }, [onLoadMore, hasMore, loadingMore]);

  // VIRTUALIZED LIST SAFETY: Explicit item count for safety
  const itemCount = posts?.length || 0;

  return (
    <div className="space-y-4" data-item-count={itemCount}>
      {posts.map((post) => {
        // Defensive: skip posts with missing data
        if (!post || !post.id) {
          console.warn('[VirtualizedFeed] Skipping invalid post:', post);
          return null;
        }

        const isFollowingAuthor = !!(
          post?.author && followingMap.has(post.author.id)
        );

        return (
          <FeedPost
            key={post.id}
            {...post}
            isFollowingAuthor={isFollowingAuthor}
            onFollowChange={onFollowChange}
          />
        );
      })}

      {/* Infinite scroll trigger */}
      {hasMore && <div ref={loadMoreRef} style={{ height: '20px' }} />}

      {/* Loading indicator */}
      {loadingMore && (
        <div className="py-4 text-center text-gray-500">
          Loading more posts...
        </div>
      )}

      {/* End of feed */}
      {!hasMore && itemCount > 0 && (
        <div className="py-8 text-center text-gray-400">
          You've seen all posts
        </div>
      )}

      {/* Empty state */}
      {!loadingMore && itemCount === 0 && (
        <div className="py-8 text-center text-gray-400">
          No posts to display
        </div>
      )}
    </div>
  );
};
