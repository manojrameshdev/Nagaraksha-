// NagRaksha domain helpers — geo, dispatch simulation, hospital ranking.

export type ResponderCategory = "TRAINED" | "RESCUE" | "AMBULANCE";
export type StockStatus = "CONFIRMED" | "LOW" | "UNKNOWN" | "STALE" | "OUT";

export const RADIUS_EARTH_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIUS_EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Rough road-distance factor for India (roads rarely straight). */
export function roadKm(straightKm: number) {
  return Math.round(straightKm * 1.32 * 10) / 10;
}

/** ETA in minutes assuming mixed urban/rural average speed. */
export function etaMin(roadKm: number) {
  const speedKmh = roadKm > 25 ? 42 : 26; // rural faster on open roads, urban slower
  return Math.max(2, Math.round((roadKm / speedKmh) * 60));
}

export function minsAgo(iso: string | Date, now = Date.now()) {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.max(0, Math.round((now - t) / 60000));
}

export function stockFreshness(status: StockStatus, verifiedAt: string | Date) {
  const mins = minsAgo(verifiedAt);
  if (status === "OUT") return { label: "Out of stock", stale: true, tone: "red" as const };
  if (status === "CONFIRMED" && mins <= 30)
    return { label: `Confirmed · verified ${mins} min ago`, stale: false, tone: "green" as const };
  if (status === "CONFIRMED" && mins <= 120)
    return { label: `Confirmed · verified ${mins} min ago`, stale: false, tone: "green" as const };
  if (status === "LOW")
    return { label: `Low stock · verified ${mins} min ago`, stale: false, tone: "gold" as const };
  // UNKNOWN or stale CONFIRMED
  return { label: `Stale · last verified ${mins} min ago`, stale: true, tone: "gold" as const };
}

export interface RankedHospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  contact: string | null;
  distanceKm: number;
  etaMin: number;
  stock: { product: string; status: StockStatus; quantityBand: string | null; verifiedAt: string; verifiedBy: string | null };
  freshness: ReturnType<typeof stockFreshness>;
  score: number;
  rank: number;
  recommended: boolean;
}

/**
 * NagRaksha ranking (per SRS FR-4.2): confirmed-stock hospitals first, then
 * travel time. Stale/unknown/out hospitals are penalised heavily but still
 * listed so the ambulance can fall back if nothing better exists.
 */
export function rankHospitals(
  origin: { lat: number; lng: number },
  hospitals: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    contact: string | null;
    stock: { product: string; status: StockStatus; quantityBand: string | null; verifiedAt: string; verifiedBy: string | null };
  }>
): RankedHospital[] {
  const scored = hospitals.map((h) => {
    const straight = haversineKm(origin.lat, origin.lng, h.lat, h.lng);
    const dist = roadKm(straight);
    const eta = etaMin(dist);
    const freshness = stockFreshness(h.stock.status, h.stock.verifiedAt);
    let score = 100;
    switch (h.stock.status) {
      case "CONFIRMED": score = 100 - eta * 0.6; break;
      case "LOW": score = 55 - eta * 0.6; break;
      case "UNKNOWN": score = 30 - eta * 0.5; break;
      case "STALE": score = 28 - eta * 0.5; break;
      case "OUT": score = 5 - eta * 0.2; break;
    }
    if (freshness.stale && h.stock.status === "CONFIRMED") score -= 35; // confirmed but stale
    return { ...h, distanceKm: dist, etaMin: eta, freshness, score: Math.round(score) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((h, i) => ({
    ...h,
    rank: i + 1,
    recommended: i === 0,
  }));
}

/** Parallel fan-out simulation for a fresh SOS. Deterministic + realistic. */
export function simulateDispatch(origin: { lat: number; lng: number }) {
  const base = Date.now();
  const trained = [
    { name: "Anjali M.", role: "Trained first responder · Anekal", distanceKm: 2.4, etaMin: 4, acceptAt: base + 6_000, accept: true },
    { name: "Ravi K.", role: "Trained first responder · Sarjapur", distanceKm: 6.1, etaMin: 11, acceptAt: base + 9_000, accept: true },
  ];
  const rescue = [
    { name: "Bannerghatta Rescue Cell", role: "Snake rescue team · certified", distanceKm: 3.0, etaMin: 6, acceptAt: base + 12_000, accept: true },
    { name: "Urban Wildlife Rescue", role: "Snake rescue team · certified", distanceKm: 8.2, etaMin: 14, acceptAt: base + 15_000, accept: true },
  ];
  const ambulance = [
    { name: "Ambulance 108 · BLR-South", role: "State ambulance · ALS", distanceKm: 4.6, etaMin: 9, acceptAt: base + 8_000, accept: true },
    { name: "Ambulance 108 · BLR-Rural", role: "State ambulance · BLS", distanceKm: 9.9, etaMin: 18, acceptAt: base + 11_000, accept: true },
  ];
  return { trained, rescue, ambulance };
}

export const INCIDENT_STATES = [
  "PENDING",
  "DISPATCHING",
  "ACCEPTED",
  "TRANSPORTING",
  "HANDED_OFF",
  "CLOSED",
] as const;

export function genIncidentRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `NR-${n}`;
}
