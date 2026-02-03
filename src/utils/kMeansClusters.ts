/**
 * Simple k-means geographic clustering for grouping restaurants by proximity.
 * Used to create cluster pins on the journey map at global zoom levels.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  id: string;
}

export interface GeoCluster {
  centroid: { lat: number; lng: number };
  members: GeoPoint[];
}

function distSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
}

/** K-means++ initialisation: pick k spread-out centroids */
function initCentroids(points: GeoPoint[], k: number): Array<{ lat: number; lng: number }> {
  const centroids: Array<{ lat: number; lng: number }> = [];
  // Pick first centroid randomly
  const first = points[Math.floor(Math.random() * points.length)];
  centroids.push({ lat: first.lat, lng: first.lng });

  for (let c = 1; c < k; c++) {
    // Compute distance from each point to nearest existing centroid
    const dists = points.map(p => {
      let minD = Infinity;
      for (const cent of centroids) {
        const d = distSq(p, cent);
        if (d < minD) minD = d;
      }
      return minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    // Weighted random pick
    let r = Math.random() * total;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push({ lat: points[i].lat, lng: points[i].lng });
        break;
      }
    }
    // Edge case: if we didn't push (floating point), push last point
    if (centroids.length <= c) {
      centroids.push({ lat: points[points.length - 1].lat, lng: points[points.length - 1].lng });
    }
  }
  return centroids;
}

/**
 * Run k-means clustering on geographic points.
 * @param points Array of {lat, lng, id}
 * @param k Number of clusters (clamped to points.length)
 * @param maxIterations Maximum iterations before stopping
 */
export function kMeansGeo(points: GeoPoint[], k: number, maxIterations = 20): GeoCluster[] {
  if (points.length === 0) return [];
  const effectiveK = Math.min(k, points.length);
  if (effectiveK <= 1) {
    const centroid = {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    };
    return [{ centroid, members: [...points] }];
  }

  let centroids = initCentroids(points, effectiveK);
  let assignments = new Array<number>(points.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assign each point to nearest centroid
    for (let i = 0; i < points.length; i++) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = distSq(points[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        changed = true;
      }
    }

    if (!changed) break;

    // Recompute centroids
    const sums = centroids.map(() => ({ lat: 0, lng: 0, count: 0 }));
    for (let i = 0; i < points.length; i++) {
      const ci = assignments[i];
      sums[ci].lat += points[i].lat;
      sums[ci].lng += points[i].lng;
      sums[ci].count++;
    }
    centroids = sums.map((s, idx) =>
      s.count > 0
        ? { lat: s.lat / s.count, lng: s.lng / s.count }
        : centroids[idx]
    );
  }

  // Build result clusters
  const clusters: GeoCluster[] = centroids.map(c => ({ centroid: c, members: [] }));
  for (let i = 0; i < points.length; i++) {
    clusters[assignments[i]].members.push(points[i]);
  }

  // Remove empty clusters
  return clusters.filter(c => c.members.length > 0);
}

/** Compute a reasonable k for the given number of restaurants (targets 5-10 clusters) */
export function computeClusterK(restaurantCount: number): number {
  return Math.min(Math.max(Math.ceil(restaurantCount / 3), 2), 10);
}
