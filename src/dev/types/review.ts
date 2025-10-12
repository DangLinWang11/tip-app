export type DishCategory = 'appetizer' | 'entree' | 'handheld' | 'side' | 'dessert' | 'drink';

export type PortionLevel = 'small' | 'just_right' | 'generous';
export type ValueLevel = 'overpriced' | 'fair' | 'bargain';
export type PresentationLevel = 'messy' | 'clean' | 'wow';
export type FreshnessLevel = 'not_fresh' | 'just_right' | 'very_fresh';
export type SaltinessLevel = 'needs_more_salt' | 'balanced' | 'too_salty';
export type TemperatureLevel = 'needs_reheating' | 'ideal' | 'too_hot';
export type TextureLevel = 'mushy' | 'great_bite' | 'tough';
export type SpicinessLevel = 'lacked_kick' | 'nice_warmth' | 'too_spicy';

export interface TasteAttribute<L extends string> {
  level: L;
  note?: string;
}

export interface MediaBundle {
  photos: string[];
  videos: string[];
  thumbnails: string[];
}

export type ComparisonMode = 'same_restaurant' | 'history' | 'archetype' | 'free_text';

export interface ReviewDraft {
  userId: string;
  restaurantId?: string;
  restaurantCuisines?: string[];
  cuisines?: string[];
  // Optional tag slugs selected by the reviewer (e.g., 'overpriced', 'very_fresh')
  tags?: string[];
  dishId?: string;
  dishName: string;
  dishCategory?: DishCategory;
  rating: number; // 0.1..10.0
  dishTag?: string;
  caption?: string;
  media: MediaBundle;
  taste: {
    portion: TasteAttribute<PortionLevel>;
    value: TasteAttribute<ValueLevel>;
    presentation: TasteAttribute<PresentationLevel>;
    freshness: TasteAttribute<FreshnessLevel>;
    saltiness?: TasteAttribute<SaltinessLevel>;
    temperature?: TasteAttribute<TemperatureLevel>;
    texture?: TasteAttribute<TextureLevel>;
    spiciness?: TasteAttribute<SpicinessLevel>;
  };
  comparison?: {
    mode: ComparisonMode;
    targetDishId?: string;
    targetText?: string;
    archetypeTag?: string;
    reasons?: string[];
    targetLocation?: { city?: string; geohash?: string };
  };
  outcome: {
    orderAgain: boolean;
    recommend: boolean;
    audience?: string[];
    returnIntent: 'for_this' | 'for_others' | 'no';
  };
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted?: boolean;
}


