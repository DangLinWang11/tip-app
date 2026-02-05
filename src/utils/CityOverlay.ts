import { OVERLAY_PILL_STYLES } from './mapShared';

export interface CityStat {
  city: string;
  state: string;
  count: number;
  lat: number;
  lng: number;
}

export interface CityOverlayLike {
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

export interface CityOverlayOptions {
  icon?: string;
  unitLabel?: string;
}

const applyStyles = (el: HTMLElement, styles: Record<string, string>) => {
  Object.entries(styles).forEach(([key, value]) => {
    (el.style as any)[key] = value;
  });
};

export const createCityOverlay = (
  cityStat: CityStat,
  map: google.maps.Map,
  onClick: (cityStat: CityStat) => void,
  options: CityOverlayOptions = {}
): CityOverlayLike | null => {
  const googleMaps = (globalThis as any).google?.maps;
  if (!googleMaps?.OverlayView || !googleMaps?.LatLng) return null;

  const icon = options.icon ?? '📍';
  const unitLabel = options.unitLabel ?? 'restaurants';

  class CityOverlayImpl extends googleMaps.OverlayView {
    private position: google.maps.LatLng;
    private div: HTMLDivElement | null = null;
    private stat: CityStat;
    private onClick?: (stat: CityStat) => void;
    private _pendingVisible: boolean = true;

    constructor(
      overlayStat: CityStat,
      overlayMap: google.maps.Map,
      overlayClick?: (overlayStat: CityStat) => void
    ) {
      super();
      this.stat = overlayStat;
      this.position = new googleMaps.LatLng(overlayStat.lat, overlayStat.lng);
      this.onClick = overlayClick;
      this.setMap(overlayMap);
    }

    onAdd(): void {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.div.style.whiteSpace = 'nowrap';
      this.div.style.transform = 'translate(-50%, -100%)';
      this.div.style.zIndex = '100';
      this.div.style.display = 'flex';
      this.div.style.flexDirection = 'column';
      this.div.style.alignItems = 'center';
      this.div.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))';
      this.div.style.transition = 'transform 0.15s ease, filter 0.15s ease';

      const pill = document.createElement('div');
      applyStyles(pill, OVERLAY_PILL_STYLES as Record<string, string>);

      const singularUnit = unitLabel.endsWith('s') ? unitLabel.slice(0, -1) : unitLabel;
      const unitText = this.stat.count === 1 ? singularUnit : unitLabel;
      const textSpan = document.createElement('span');
      textSpan.textContent = `${icon} ${this.stat.city}: ${this.stat.count} ${unitText}`;
      pill.appendChild(textSpan);

      const pointer = document.createElement('div');
      pointer.style.width = '0';
      pointer.style.height = '0';
      pointer.style.borderLeft = '7px solid transparent';
      pointer.style.borderRight = '7px solid transparent';
      pointer.style.borderTop = '7px solid rgba(0, 0, 0, 0.78)';
      pointer.style.marginTop = '-1px';

      this.div.appendChild(pill);
      this.div.appendChild(pointer);

      this.div.addEventListener('mouseenter', () => {
        if (this.div) {
          this.div.style.transform = 'translate(-50%, -100%) scale(1.05)';
          this.div.style.filter = 'drop-shadow(0 8px 20px rgba(0,0,0,0.35))';
        }
      });
      this.div.addEventListener('mouseleave', () => {
        if (this.div) {
          this.div.style.transform = 'translate(-50%, -100%)';
          this.div.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))';
        }
      });

      this.div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClick?.(this.stat);
      });

      if (!this._pendingVisible) {
        this.div.style.display = 'none';
      }

      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.div);
    }

    draw(): void {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;

      const point = projection.fromLatLngToDivPixel(this.position);
      if (point) {
        this.div.style.left = point.x + 'px';
        this.div.style.top = point.y + 'px';
      }
    }

    onRemove(): void {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      this.div = null;
    }

    setVisible(visible: boolean): void {
      this._pendingVisible = visible;
      if (this.div) {
        this.div.style.display = visible ? 'flex' : 'none';
      }
    }

    destroy(): void {
      this.setMap(null);
    }
  }

  return new CityOverlayImpl(cityStat, map, onClick);
};
