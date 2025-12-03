import { NavigateFunction } from 'react-router-dom';

export interface NavigateToDishParams {
  restaurantId?: string;
  dishId?: string;        // menuItemId (required for dish page)
  reviewId?: string;      // optional: review that triggered navigation
  visitId?: string;       // optional: visit that triggered navigation
}

/**
 * Navigate to a dish's canonical page with optional review context.
 *
 * If dishId is provided, routes to `/dish/:dishId` with optional state.
 * If dishId is missing but restaurantId is available, falls back to `/restaurant/:restaurantId`.
 *
 * The optional reviewId/visitId are passed via state for MenuDetail to use
 * when implementing scroll-to-review functionality in the future.
 */
export const navigateToDish = (
  navigate: NavigateFunction,
  params: NavigateToDishParams
): void => {
  const { restaurantId, dishId, reviewId, visitId } = params;

  if (!dishId) {
    // Fallback: if no dishId, try restaurantId
    if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    }
    return;
  }

  navigate(`/dish/${dishId}`, {
    state: {
      originReviewId: reviewId,
      originVisitId: visitId,
      restaurantId
    }
  });
};

/**
 * Navigate to a restaurant's page.
 * (Included for consistency - can be extended later)
 */
export const navigateToRestaurant = (
  navigate: NavigateFunction,
  restaurantId: string
): void => {
  navigate(`/restaurant/${restaurantId}`);
};
