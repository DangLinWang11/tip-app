import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef, useEffect } from 'react';
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
  scrollRef,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => (typeof window !== 'undefined' ? window : null),
    estimateSize: () => 600, // Average post height
    overscan: 5, // Render 5 extra items above/below viewport
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('jsdom') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // Infinite scroll detection
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    // Trigger load when within 5 items of end
    if (
      lastItem.index >= posts.length - 5 &&
      hasMore &&
      !loadingMore &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [
    hasMore,
    loadingMore,
    onLoadMore,
    posts.length,
    virtualizer.getVirtualItems(),
  ]);

  return (
    <div ref={parentRef} className="space-y-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const post = posts[virtualItem.index];
          const isFollowingAuthor = !!(
            post.author && followingMap.has(post.author.id)
          );

          return (
            <div
              key={post.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-4 py-2"
            >
              <FeedPost
                {...post}
                isFollowingAuthor={isFollowingAuthor}
                onFollowChange={onFollowChange}
              />
            </div>
          );
        })}

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
    </div>
  );
};
