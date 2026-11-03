import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Seeds the SQLite database from the verified IEBC 2022 baseline
 * (`data/2022-results.json`). Idempotent: sub-counties, wards, stations and
 * candidates are upserted by their natural keys; centres are re-created on
 * every seed run so the dataset stays byte-for-byte in sync with the JSON.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = process.env.SEED_FILE || path.join(__dirname, "..", "..", "data", "2022-results.json");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const flt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function seedCampaign(prisma) {
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8"));
  if (!raw.subCounties || !raw.wards || !raw.meta) {
    throw new Error(`Unexpected seed file shape: ${SEED_FILE}`);
  }

  const wardsById = {};

  for (const c of raw.meta.candidates || []) {
    await prisma.candidate.upsert({
      where: { key: c.key },
      create: { key: c.key, name: c.name, short: c.short, votes: num(c.votes), share: flt(c.share), rank: num(c.rank) },
      update: { name: c.name, short: c.short, votes: num(c.votes), share: flt(c.share), rank: num(c.rank) },
    });
  }
  await prisma.metaRow.upsert({
    where: { key: "meta" },
    create: { key: "meta", value: JSON.stringify(raw.meta) },
    update: { value: JSON.stringify(raw.meta) },
  });

  // Sub-counties + wards (upsert by slug). Stations are flattened while
  // walking the wards and re-created as a block afterwards (see below).
  const stationRows = [];
  for (const sc of raw.subCounties) {
    await prisma.subCounty.upsert({
      where: { id: sc.id },
      create: {
        id: sc.id,
        name: sc.name,
        registered: num(sc.registered),
        cast: num(sc.cast),
        rejected: num(sc.rejected),
        valid: num(sc.valid),
        siyoi: num(sc.siyoi),
        khatundi: num(sc.khatundi),
        nakhumicha: num(sc.nakhumicha),
        margin: num(sc.margin),
        opponent: sc.opponent ?? null,
        turnoutPct: flt(sc.turnoutPct),
        siyoiShare: flt(sc.siyoiShare),
        candidates: JSON.stringify(sc.candidates || {}),
      },
      update: {
        name: sc.name,
        registered: num(sc.registered),
        cast: num(sc.cast),
        rejected: num(sc.rejected),
        valid: num(sc.valid),
        siyoi: num(sc.siyoi),
        khatundi: num(sc.khatundi),
        nakhumicha: num(sc.nakhumicha),
        margin: num(sc.margin),
        opponent: sc.opponent ?? null,
        turnoutPct: flt(sc.turnoutPct),
        siyoiShare: flt(sc.siyoiShare),
        candidates: JSON.stringify(sc.candidates || {}),
      },
    });

    for (const w of raw.wards.filter((x) => x.constituency === sc.name)) {
      wardsById[w.id] = true;
      await prisma.ward.upsert({
        where: { id: w.id },
        create: {
          id: w.id,
          name: w.name,
          constituency: w.constituency,
          wardCode: String(w.wardCode),
          registered: num(w.registered),
          cast: num(w.cast),
          rejected: num(w.rejected),
          valid: num(w.valid),
          siyoi: num(w.siyoi),
          khatundi: num(w.khatundi),
          nakhumicha: num(w.nakhumicha),
          leader: w.leader ?? null,
          margin: num(w.margin),
          siyoiShare: flt(w.siyoiShare),
          status: w.status ?? null,
          candidates: JSON.stringify(w.candidates || {}),
          subCountyId: sc.id,
        },
        update: {
          name: w.name,
          constituency: w.constituency,
          wardCode: String(w.wardCode),
          registered: num(w.registered),
          cast: num(w.cast),
          rejected: num(w.rejected),
          valid: num(w.valid),
          siyoi: num(w.siyoi),
          khatundi: num(w.khatundi),
          nakhumicha: num(w.nakhumicha),
          leader: w.leader ?? null,
          margin: num(w.margin),
          siyoiShare: flt(w.siyoiShare),
          status: w.status ?? null,
          candidates: JSON.stringify(w.candidates || {}),
          subCountyId: sc.id,
        },
      });

      for (const s of w.stations || []) {
        stationRows.push({
          code: String(s.code),
          name: s.name,
          constituency: s.constituency,
          registered: num(s.registered),
          cast: num(s.cast),
          rejected: num(s.rejected),
          valid: num(s.valid),
          siyoi: num(s.siyoi),
          khatundi: num(s.khatundi),
          nakhumicha: num(s.nakhumicha),
          verification: s.verification ?? null,
          candidates: JSON.stringify(s.candidates || {}),
          wardId: w.id,
        });
      }
    }
  }

  // Stations: authoritative re-create (like centres) so all 757 rows survive,
  // including the six IEBC codes that legitimately appear as two rows each in
  // the seed file. Deterministic autoincrement id + sortOrder = JSON order.
  if (stationRows.length) {
    await prisma.station.deleteMany();
    await prisma.station.createMany({
      data: stationRows.map((r, i) => ({ ...r, sortOrder: i })),
    });
  }

  // Centres: authoritative re-create (keeps rows in exact JSON order).
  // Staff-edited content (`keyAchievements`, `campaignMessage`) is preserved
  // by name so a re-seed never wipes the campaign content ledger.
  if (raw.centres && raw.centres.length) {
    const existing = await prisma.centre.findMany({
      select: { name: true, keyAchievements: true, campaignMessage: true },
    });
    const contentByName = new Map();
    for (const c of existing) {
      if (c.keyAchievements !== "[]" || c.campaignMessage) {
        contentByName.set(c.name, { keyAchievements: c.keyAchievements, campaignMessage: c.campaignMessage });
      }
    }

    await prisma.centre.deleteMany();
    const rows = raw.centres.map((c, i) => ({
      name: c.name,
      constituency: c.constituency,
      ward: c.ward,
      wardCode: String(c.wardCode),
      registered: num(c.registered),
      cast: num(c.cast),
      rejected: num(c.rejected),
      valid: num(c.valid),
      status: c.status,
      statusOfficial: !!c.statusOfficial,
      candidates: JSON.stringify(c.candidates || {}),
      wardId: c.wardId,
      sortOrder: i,
      keyAchievements: contentByName.get(c.name)?.keyAchievements ?? "[]",
      campaignMessage: contentByName.get(c.name)?.campaignMessage ?? "",
    }));
    await prisma.centre.createMany({ data: rows });
  }

  return {
    subCounties: raw.subCounties.length,
    wards: raw.wards.length,
    stations: raw.wards.reduce((a, w) => a + (w.stations?.length || 0), 0),
    centres: raw.centres?.length || 0,
    candidates: raw.meta.candidates?.length || 0,
  };
}

export default seedCampaign;