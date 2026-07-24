// Seed NagRaksha demo data: hospitals + antivenom stock + risk reports.
// Run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000);
}
function minsAgo(m: number) {
  return new Date(Date.now() - m * 60_000);
}

async function main() {
  console.log("Seeding NagRaksha demo data...");

  // Hospitals — Bengaluru region demo coordinates
  const hospitals = [
    {
      name: "District Hospital A — Bannerghatta",
      lat: 12.8003,
      lng: 77.5954,
      address: "Bannerghatta Main Rd, Bengaluru 560076",
      contact: "+91 80 2655 0100",
      product: "Polyvalent ASV",
      status: "CONFIRMED",
      quantityBand: "40-80 vials",
      verifiedAt: minsAgo(8),
      verifiedBy: "Pharmacy · Dr. Rao",
    },
    {
      name: "Hospital B — Jayanagar General",
      lat: 12.9250,
      lng: 77.5938,
      address: "Jayanagar 4th Block, Bengaluru 560011",
      contact: "+91 80 2655 0200",
      product: "Polyvalent ASV",
      status: "UNKNOWN",
      quantityBand: "unknown",
      verifiedAt: hoursAgo(26),
      verifiedBy: null,
    },
    {
      name: "Hospital C — Rural Tumkur",
      lat: 13.3409,
      lng: 77.1000,
      address: "Tumkur Main, Tumakuru 572101",
      contact: "+91 816 220 1100",
      product: "Polyvalent ASV",
      status: "LOW",
      quantityBand: "5-10 vials",
      verifiedAt: minsAgo(42),
      verifiedBy: "Pharmacy",
    },
    {
      name: "Hospital D — Kengeri Satellite",
      lat: 12.9172,
      lng: 77.4865,
      address: "Kengeri Satellite Town, Bengaluru 560060",
      contact: "+91 80 2655 0300",
      product: "Polyvalent ASV",
      status: "OUT",
      quantityBand: "0 vials",
      verifiedAt: hoursAgo(3),
      verifiedBy: "Pharmacy",
    },
  ];

  for (const h of hospitals) {
    const hosp = await db.hospital.create({
      data: {
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        address: h.address,
        contact: h.contact,
        active: true,
        antivenomStock: {
          create: {
            product: h.product,
            status: h.status,
            quantityBand: h.quantityBand,
            verifiedAt: h.verifiedAt,
            verifiedBy: h.verifiedBy,
          },
        },
      },
    });
    console.log("  hospital:", hosp.name);
  }

  // Risk reports
  const risks = [
    {
      area: "Bannerghatta Forest Edge",
      lat: 12.8003,
      lng: 77.5954,
      level: "HIGH",
      score: 78,
      weather: "Monsoon · 28°C · 86% humidity · post-rain",
      season: "Monsoon",
      likelySnakes: "Russell's viper, Saw-scaled viper, Indian cobra, Common krait",
    },
    {
      area: "Bengaluru Urban Core",
      lat: 12.9719,
      lng: 77.5937,
      level: "MODERATE",
      score: 46,
      weather: "Pre-monsoon · 31°C · 64% humidity",
      season: "Pre-monsoon",
      likelySnakes: "Indian cobra, Rat snake, Wolf snake",
    },
    {
      area: "Tumakuru Rural Belt",
      lat: 13.3409,
      lng: 77.1000,
      level: "SEVERE",
      score: 88,
      weather: "Monsoon · 26°C · 92% humidity · heavy rain last 24h",
      season: "Monsoon",
      likelySnakes: "Russell's viper, Saw-scaled viper, Common krait, Hump-nosed pit viper",
    },
  ];
  for (const r of risks) {
    await db.riskReport.create({ data: r });
  }
  console.log(`Seeded ${hospitals.length} hospitals + ${risks.length} risk reports.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
