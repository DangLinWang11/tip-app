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

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const isFollowingAuthor = !!(
          post.author && followingMap.has(post.author.id)
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
      {!hasMore && posts.length > 0 && (
        <div className="py-8 text-center text-gray-400">
          You've seen all posts
        </div>
      )}
    </div>
  );
};
