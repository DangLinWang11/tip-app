/**
 * Custom Google Maps OverlayView that displays country labels with restaurant counts.
 * Shown at zoom levels 1-5, hidden at zoom 6+.
 */

export interface CountryStat {
  code: string;
  name: string;
  flag: string;
  count: number;
  lat: number;
  lng: number;
  /** Bounds of all restaurants in this country (for fitBounds on click) */
  bounds?: google.maps.LatLngBounds;
}


export interface CountryOverlayLike {
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

export const createCountryOverlay = (
  stat: CountryStat,
  map: google.maps.Map,
  onClick?: (stat: CountryStat) => void
): CountryOverlayLike | null => {
  const googleMaps = (globalThis as any).google?.maps;
  if (!googleMaps?.OverlayView || !googleMaps?.LatLng) return null;

  class CountryOverlayImpl extends googleMaps.OverlayView {
    private position: google.maps.LatLng;
    private div: HTMLDivElement | null = null;
    private stat: CountryStat;
    private onClick?: (stat: CountryStat) => void;

    constructor(
      overlayStat: CountryStat,
      overlayMap: google.maps.Map,
      overlayClick?: (overlayStat: CountryStat) => void
    ) {
      super();
      this.stat = overlayStat;
      this.position = new googleMaps.LatLng(overlayStat.lat, overlayStat.lng);
      this.onClick = overlayClick;
      this.setMap(overlayMap);
    }

    onAdd(): void {
      // Wrapper holds both the pill and the pointer triangle
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

      // Pill/chip container
      const pill = document.createElement('div');
      pill.style.background = 'rgba(0, 0, 0, 0.78)';
      pill.style.color = '#FFFFFF';
      pill.style.fontFamily = "'Montserrat', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      pill.style.fontWeight = '700';
      pill.style.fontSize = '13px';
      pill.style.padding = '8px 14px';
      pill.style.borderRadius = '10px';
      pill.style.backdropFilter = 'blur(4px)';

      const restaurantText = this.stat.count === 1 ? 'restaurant' : 'restaurants';
      const flagImg = document.createElement('img');
      const countryCode = (this.stat.code || '').toLowerCase();
      flagImg.src = `https://flagcdn.com/w40/${countryCode}.png`;
      flagImg.alt = this.stat.code || '';
      flagImg.style.width = '20px';
      flagImg.style.height = '15px';
      flagImg.style.objectFit = 'cover';
      flagImg.style.borderRadius = '2px';
      flagImg.style.marginRight = '6px';
      flagImg.style.verticalAlign = 'middle';
      flagImg.style.display = 'inline-block';
      const textSpan = document.createElement('span');
      textSpan.textContent = `${this.stat.name}: ${this.stat.count} ${restaurantText}`;
      pill.appendChild(flagImg);
      pill.appendChild(textSpan);

      // Pointer triangle (arrow pointing down)
      const pointer = document.createElement('div');
      pointer.style.width = '0';
      pointer.style.height = '0';
      pointer.style.borderLeft = '7px solid transparent';
      pointer.style.borderRight = '7px solid transparent';
      pointer.style.borderTop = '7px solid rgba(0, 0, 0, 0.78)';
      pointer.style.marginTop = '-1px';

      this.div.appendChild(pill);
      this.div.appendChild(pointer);

      // Hover effect
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

      // Click handler
      this.div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClick?.(this.stat);
      });

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

    /** Show or hide the overlay */
    setVisible(visible: boolean): void {
      if (this.div) {
        this.div.style.display = visible ? 'block' : 'none';
      }
    }

    /** Remove from map */
    destroy(): void {
      this.setMap(null);
    }
  }

  return new CountryOverlayImpl(stat, map, onClick);
}
