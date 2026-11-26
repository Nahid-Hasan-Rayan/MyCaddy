// NHR: virtual demo course around marked points, hazards labelled as simulated
import { fromMeters, type LatLng } from "../../engine/src/hazards";
import type { CoursePack } from "../../contracts/src";

export interface VirtualHazard {
  type: "water" | "bunker" | "ob";
  along: number;
  across: number;
  depth: number;
  width: number;
}
export interface VirtualHole {
  par: number;
  tee: LatLng;
  bearing: number;
  length: number;
  greenRadius?: number;
  hazards: VirtualHazard[];
}

const rad = (d: number) => (d * Math.PI) / 180;

function place(tee: LatLng, bearing: number, along: number, across: number): LatLng {
  const b = rad(bearing);
  const east = along * Math.sin(b) + across * Math.cos(b);
  const north = along * Math.cos(b) - across * Math.sin(b);
  return fromMeters(tee, east, north);
}

export function buildVirtualPack(id: string, name: string, holes: VirtualHole[]): CoursePack {
  return {
    id,
    name,
    version: 1,
    simulatedHazards: true,
    holes: holes.map((h, i) => {
      const r = h.greenRadius ?? 12;
      const green = Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4;
        return place(h.tee, h.bearing, h.length + r * Math.cos(a), r * Math.sin(a));
      });
      return {
        n: i + 1,
        par: h.par,
        green,
        tee: h.tee,
        source: "virtual" as const,
        hazards: h.hazards.map((z, k) => ({
          id: `h${i + 1}-${z.type[0]}${k + 1}`,
          type: z.type,
          polygon: [
            place(h.tee, h.bearing, z.along - z.depth / 2, z.across - z.width / 2),
            place(h.tee, h.bearing, z.along - z.depth / 2, z.across + z.width / 2),
            place(h.tee, h.bearing, z.along + z.depth / 2, z.across + z.width / 2),
            place(h.tee, h.bearing, z.along + z.depth / 2, z.across - z.width / 2),
          ],
        })),
      };
    }),
  };
}

export function campusDemo(origin: LatLng): CoursePack {
  const t2 = fromMeters(origin, 60, 0);
  const t3 = fromMeters(origin, 120, 0);
  return buildVirtualPack("campus-demo", "Campus demo field (simulated hazards)", [
    { par: 3, tee: origin, bearing: 0, length: 130, hazards: [{ type: "water", along: 100, across: 0, depth: 20, width: 40 }, { type: "bunker", along: 128, across: 18, depth: 10, width: 8 }] },
    { par: 3, tee: t2, bearing: 0, length: 150, hazards: [{ type: "bunker", along: 140, across: -16, depth: 12, width: 8 }, { type: "ob", along: 100, across: 30, depth: 80, width: 6 }] },
    { par: 4, tee: t3, bearing: 0, length: 220, hazards: [{ type: "water", along: 190, across: 0, depth: 14, width: 50 }] },
  ]);
}
