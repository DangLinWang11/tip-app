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
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.div.style.whiteSpace = 'nowrap';
      this.div.style.transform = 'translate(-50%, -50%)';
      this.div.style.zIndex = '100';

      // Pill/chip style
      this.div.style.background = 'rgba(0, 0, 0, 0.75)';
      this.div.style.color = '#FFFFFF';
      this.div.style.fontFamily = "'Montserrat', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      this.div.style.fontWeight = '700';
      this.div.style.fontSize = '13px';
      this.div.style.padding = '8px 14px';
      this.div.style.borderRadius = '8px';
      this.div.style.backdropFilter = 'blur(4px)';
      this.div.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

      const restaurantText = this.stat.count === 1 ? 'restaurant' : 'restaurants';
      this.div.textContent = '';
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
      this.div.appendChild(flagImg);
      this.div.appendChild(textSpan);

      // Hover effect
      this.div.addEventListener('mouseenter', () => {
        if (this.div) {
          this.div.style.transform = 'translate(-50%, -50%) scale(1.05)';
          this.div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        }
      });
      this.div.addEventListener('mouseleave', () => {
        if (this.div) {
          this.div.style.transform = 'translate(-50%, -50%)';
          this.div.style.boxShadow = 'none';
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
