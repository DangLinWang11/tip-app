export type TourId =
  | 'home'
  | 'profile'
  | 'create_step2'
  | 'create_step3'
  | 'map_demo';

export type TourPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end';

export interface TourStep {
  id: string;
  selector: string;
  title?: string;
  body: string;
  placement?: TourPlacement;
  blockInteraction?: boolean;
  spotlightPadding?: number;
}

export interface TourDefinition {
  id: TourId;
  steps: TourStep[];
}
