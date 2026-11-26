// NHR: front, middle and back distance to a green polygon
import { haversine, rayHits, type LatLng } from "./hazards";

export interface GreenDistances {
  front: number;
  middle: number;
  back: number;
}

export function centroidOf(polygon: LatLng[]): LatLng {
  const n = polygon.length;
  return { lat: polygon.reduce((a, p) => a + p.lat, 0) / n, lng: polygon.reduce((a, p) => a + p.lng, 0) / n };
}

export function greenDistances(player: LatLng, green: LatLng[]): GreenDistances | null {
  if (green.length < 3) return null;
  const centre = centroidOf(green);
  const hit = rayHits(player, centre, green);
  const middle = haversine(player, centre);
  if (!hit) return { front: middle, middle, back: middle };
  return { front: hit.near, middle, back: hit.far };
}
