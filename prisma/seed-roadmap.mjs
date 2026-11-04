/**
 * Roadmap — dated campaign activities.
 *
 * Turns the campaign's standing rhythm into a real, dated calendar that the
 * dashboard reads live from MySQL:
 *
 *   - Mashamba meetings (indoor, ethnic-group) in the former settler-farm
 *     subdivisions — 100 in total, 20 per sub-county.
 *   - Ward Tours — one ward a day across all 25 wards.
 *   - Team Tours — selected teams visiting special groups.
 *   - Harambees — weekly.
 *   - Burials — weekly, with a team dispatched.
 *   - Party & coalition activities.
 *   - Church blitzes — weekly, on Sundays.
 *   - Key events — Christmas, Easter, Eid and the fixed national calendar.
 *
 * Geography is resolved from the LIVE register (sub-counties, wards, stations
 * and blocs) rather than hardcoded, so every activity lands in a real ward and
 * links back to it. Seeding is insert-only: if any activity is already on file
 * the run is a no-op, so re-running `db:seed` never clobbers a planner's edits.
 */

const DAY = 86400000;
const at = (iso) => new Date(`${iso}T09:00:00.000Z`);
const addDays = (date, n) => new Date(date.getTime() + n * DAY);

/** Every 7 days from `startISO` (inclusive) to `endISO` (inclusive). */
function weekly(startISO, endISO) {
  const out = [];
  const end = at(endISO).getTime();
  for (let t = at(startISO).getTime(); t <= end; t += 7 * DAY) out.push(new Date(t));
  return out;
}

// Fixed, non-negotiable calendar anchors the plan bends around. Islamic dates
// are lunar and confirmed by sighting — marked "(approx)".
const KEY_EVENTS = [
  { date: "2026-12-12", title: "Jamhuri Day", description: "National day — county-wide presence and messaging." },
  { date: "2026-12-25", title: "Christmas Day", description: "Christmas homecoming blitz opens across all 25 wards." },
  { date: "2026-12-26", title: "Boxing Day", description: "Family and community visits; church circuit continues." },
  { date: "2027-01-01", title: "New Year's Day", description: "New-year greetings; registration-drive messaging peaks." },
  { date: "2027-03-20", title: "Eid al-Fitr (approx)", description: "Muslim community outreach and greetings." },
  { date: "2027-04-02", title: "Good Friday", description: "Easter church blitz opens." },
  { date: "2027-04-04", title: "Easter Sunday", description: "Peak church attendance — blitz all major congregations." },
  { date: "2027-04-05", title: "Easter Monday", description: "Women's guild and fellowship engagements." },
  { date: "2027-05-01", title: "Labour Day", description: "Workers' and traders' messaging." },
  { date: "2027-05-27", title: "Eid al-Adha (approx)", description: "Muslim community outreach and greetings." },
  { date: "2027-06-01", title: "Madaraka Day", description: "National day — county-wide presence." },
];

// Party & coalition milestones.
const PARTY_ACTIVITIES = [
  { date: "2026-11-25", title: "Party membership & structure audit" },
  { date: "2026-12-18", title: "UDA ward branch meetings" },
  { date: "2027-01-30", title: "Coalition partners forum" },
  { date: "2027-03-15", title: "Delegate reps mapping" },
  { date: "2027-05-15", title: "Party primaries preparation" },
  { date: "2027-06-14", title: "UDA party primaries" },
  { date: "2027-06-25", title: "Coalition endorsement sitting" },
  { date: "2027-07-10", title: "Party agents accreditation" },
  { date: "2027-07-25", title: "Coalition final-rally coordination" },
  { date: "2027-08-05", title: "Party polling-day coordination" },
];

export async function seedRoadmap(prisma) {
  const existing = await prisma.campaignActivity.count();
  if (existing > 0) return { created: 0, existing };

  const [subCounties, wards, stations, blocs] = await Promise.all([
    prisma.subCounty.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ward.findMany({ select: { id: true, name: true, subCountyId: true }, orderBy: { name: "asc" } }),
    prisma.station.findMany({ select: { code: true, name: true, wardId: true, registered: true } }),
    prisma.bloc.findMany({ select: { id: true, wardId: true } }),
  ]);
  if (!wards.length || !subCounties.length) return { created: 0, existing: 0, skipped: true };

  // Representative (largest) polling station per ward — the venue an activity
  // is anchored to, stored denormalised (code + name) like Bloc/Agent.
  const topStation = new Map();
  for (const s of stations) {
    if (!s.wardId) continue;
    const cur = topStation.get(s.wardId);
    if (!cur || s.registered > cur.registered) topStation.set(s.wardId, s);
  }
  // First bloc per ward, so a Mashamba meeting links to the bloc it serves.
  const blocByWard = new Map();
  for (const b of blocs) if (b.wardId && !blocByWard.has(b.wardId)) blocByWard.set(b.wardId, b.id);

  const venue = (wardId) => {
    const s = topStation.get(wardId);
    return { stationCode: s?.code ?? null, stationName: s?.name ?? null };
  };

  const wardsBySubCounty = new Map();
  for (const w of wards) {
    if (!wardsBySubCounty.has(w.subCountyId)) wardsBySubCounty.set(w.subCountyId, []);
    wardsBySubCounty.get(w.subCountyId).push(w);
  }

  const rows = [];

  // ---- Key events (fixed calendar) ----
  for (const e of KEY_EVENTS) {
    rows.push({
      title: e.title,
      type: "key-event",
      category: "key-event",
      description: e.description,
      cadence: "once",
      date: at(e.date),
      owner: "War-room",
    });
  }

  // ---- Mashamba meetings: 100 total, 20 per sub-county, indoors ----
  const scList = subCounties.filter((sc) => wardsBySubCounty.has(sc.id));
  const mashambaStart = at("2026-11-11");
  for (let i = 0; i < scList.length * 20; i++) {
    const sc = scList[i % scList.length];
    const scWards = wardsBySubCounty.get(sc.id);
    const ward = scWards[Math.floor(i / scList.length) % scWards.length];
    rows.push({
      title: `Mashamba Meeting — ${ward.name}`,
      type: "mashamba",
      category: "activity",
      description:
        "Indoor community meeting in the former settler-farm subdivision, organised along ethnic/lineage lines — listen, log issues and register supporters.",
      cadence: "once",
      date: addDays(mashambaStart, Math.round(i * 2.4)),
      location: `${ward.name} Settler Farm Subdivision`,
      subCountyId: sc.id,
      wardId: ward.id,
      blocId: blocByWard.get(ward.id) ?? null,
      ...venue(ward.id),
      owner: "Sub-county Lead",
    });
  }

  // ---- Ward Tours: one ward per day, all 25 wards ----
  wards.forEach((ward, i) => {
    rows.push({
      title: `Ward Tour — ${ward.name}`,
      type: "ward-tour",
      category: "activity",
      description: "Full-day ward tour: market meet, bloc visits, leaders' baraza and a community address.",
      cadence: "once",
      date: addDays(at("2027-02-01"), i),
      location: ward.name,
      subCountyId: ward.subCountyId,
      wardId: ward.id,
      ...venue(ward.id),
      owner: "County Team",
    });
  });

  // ---- Team Tours: selected teams visit special groups ----
  for (let i = 0; i < 12; i++) {
    const ward = wards[Math.floor((i * wards.length) / 12) % wards.length];
    rows.push({
      title: `Team Tour — ${ward.name}`,
      type: "team-tour",
      category: "activity",
      description:
        "A selected team visits special groups in the ward (e.g. Mr. Cheren's circle, elders, professional bodies) for targeted engagement.",
      cadence: "once",
      date: addDays(at("2027-03-05"), i * 9),
      location: ward.name,
      subCountyId: ward.subCountyId,
      wardId: ward.id,
      ...venue(ward.id),
      owner: `Team ${String.fromCharCode(65 + (i % 5))}`,
    });
  }

  // ---- Harambees: weekly (Saturdays) ----
  weekly("2026-11-14", "2027-07-31").forEach((date, i) => {
    const ward = wards[i % wards.length];
    rows.push({
      title: `Harambee — ${ward.name}`,
      type: "harambee",
      category: "activity",
      description: "Weekly harambee: mobilise the community and represent the campaign at the collection.",
      cadence: "weekly",
      date,
      location: ward.name,
      subCountyId: ward.subCountyId,
      wardId: ward.id,
      owner: "Fundraising Team",
    });
  });

  // ---- Burials: weekly dispatch (team attends) ----
  weekly("2026-11-14", "2027-07-31").forEach((date, i) => {
    const ward = wards[(i + 7) % wards.length];
    rows.push({
      title: `Burial Support — ${ward.name}`,
      type: "burial",
      category: "activity",
      description: "Weekly standing dispatch: a team attends burials in the ward to condole, organise and be present.",
      cadence: "weekly",
      date,
      location: ward.name,
      subCountyId: ward.subCountyId,
      wardId: ward.id,
      owner: "Ward Team",
    });
  });

  // ---- Church blitzes: weekly (Sundays) ----
  weekly("2026-11-15", "2027-08-01").forEach((date, i) => {
    const ward = wards[i % wards.length];
    rows.push({
      title: `Church Blitz — ${ward.name}`,
      type: "church-blitz",
      category: "activity",
      description: "Attend Sunday services, greet congregations and lock in the church calendar for the ward.",
      cadence: "weekly",
      date,
      location: ward.name,
      subCountyId: ward.subCountyId,
      wardId: ward.id,
      owner: "Faith Liaison Team",
    });
  });

  // ---- Party & coalition activities ----
  for (const p of PARTY_ACTIVITIES) {
    rows.push({
      title: p.title,
      type: "party",
      category: "activity",
      description: "Party / coalition activity — secure the ticket and keep the coalition aligned.",
      cadence: "once",
      date: at(p.date),
      owner: "Party Liaison",
    });
  }

  const { count } = await prisma.campaignActivity.createMany({ data: rows });
  return { created: count, existing: 0 };
}

export default seedRoadmap;
