/**
 * Field Ops — sample polling-agent roster.
 *
 * 20 recruits spread across the three tiers so the Field Ops dashboard has real
 * rows to read on a fresh install. Seeding is insert-only: agents are added
 * only when the roster is empty, so re-running `db:seed` never clobbers
 * genuinely recruited agents.
 *
 * Each agent is posted to a real polling station resolved from the database and
 * spread evenly across the register, so the ward, station name and IEBC code on
 * the roster are always genuine 2022 baseline values rather than hardcoded ones.
 */

// 12 primary (1 per polling station), 5 backup, 3 supervisor — a cross-section
// of the 757 / 76 / 31 staffing plan defined in src/services/agents.js.
const SAMPLE_AGENTS = [
  { fullName: "Peter Kiprono Chebet", idNumber: "32145678", gender: "male", phone: "254712340001", altPhone: "254722340001", role: "primary" },
  { fullName: "Grace Nasimiyu Wekesa", idNumber: "32145679", gender: "female", phone: "254712340002", altPhone: "254722340002", role: "primary" },
  { fullName: "John Wafula Barasa", idNumber: "32145680", gender: "male", phone: "254712340003", altPhone: "254722340003", role: "primary" },
  { fullName: "Mary Chebet Kemboi", idNumber: "32145681", gender: "female", phone: "254712340004", altPhone: "254722340004", role: "primary" },
  { fullName: "Samuel Wekesa Khaemba", idNumber: "32145682", gender: "male", phone: "254712340005", altPhone: "254722340005", role: "primary" },
  { fullName: "Esther Nekesa Simiyu", idNumber: "32145683", gender: "female", phone: "254712340006", altPhone: "254722340006", role: "primary" },
  { fullName: "Daniel Kipchumba Rono", idNumber: "32145684", gender: "male", phone: "254712340007", altPhone: "254722340007", role: "primary" },
  { fullName: "Alice Wanjala Mukhwana", idNumber: "32145685", gender: "female", phone: "254712340008", altPhone: "254722340008", role: "primary" },
  { fullName: "Joseph Simiyu Wasike", idNumber: "32145686", gender: "male", phone: "254712340009", altPhone: "254722340009", role: "primary" },
  { fullName: "Faith Chepkoech Rotich", idNumber: "32145687", gender: "female", phone: "254712340010", altPhone: "254722340010", role: "primary" },
  { fullName: "Patrick Khaemba Wekesa", idNumber: "32145688", gender: "male", phone: "254712340011", altPhone: "254722340011", role: "primary" },
  { fullName: "Ruth Nabwire Juma", idNumber: "32145689", gender: "female", phone: "254712340012", altPhone: "254722340012", role: "primary" },
  { fullName: "Michael Barasa Wanyonyi", idNumber: "32145690", gender: "male", phone: "254712340013", altPhone: "254722340013", role: "backup" },
  { fullName: "Sarah Chebet Mutai", idNumber: "32145691", gender: "female", phone: "254712340014", altPhone: "254722340014", role: "backup" },
  // No alternative line on file — exercises the nullable column.
  { fullName: "Anthony Wafula Kisiangani", idNumber: "32145692", gender: "male", phone: "254712340015", altPhone: null, role: "backup" },
  { fullName: "Beatrice Nasambu Khakame", idNumber: "32145693", gender: "female", phone: "254712340016", altPhone: "254722340016", role: "backup" },
  { fullName: "Elijah Kipngetich Sang", idNumber: "32145694", gender: "male", phone: "254712340017", altPhone: "254722340017", role: "backup" },
  { fullName: "Janet Nekesa Wamalwa", idNumber: "32145695", gender: "female", phone: "254712340018", altPhone: "254722340018", role: "supervisor" },
  { fullName: "Kevin Omondi Ojwang", idNumber: "32145696", gender: "male", phone: "254712340019", altPhone: null, role: "supervisor" },
  { fullName: "Mercy Chebet Kirui", idNumber: "32145697", gender: "female", phone: "254712340020", altPhone: "254722340020", role: "supervisor" },
];

export async function seedAgents(prisma) {
  // Stations are ordered by sortOrder (the seed JSON order), so striding across
  // them posts the roster evenly across every ward and sub-county.
  const stations = await prisma.station.findMany({
    select: { code: true, name: true, wardId: true },
    orderBy: { sortOrder: "asc" },
  });

  const existing = await prisma.agent.count();
  if (existing > 0) {
    // Agents recruited before the polling-station columns existed have no
    // station on file, which would leave a blank column in the roster. Post
    // only those rows, so real assignments are never overwritten.
    const unassigned = await prisma.agent.findMany({
      where: { stationCode: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    let backfilled = 0;
    if (stations.length && unassigned.length) {
      for (let i = 0; i < unassigned.length; i++) {
        const station = stations[Math.floor((i * stations.length) / unassigned.length)];
        await prisma.agent.update({
          where: { id: unassigned[i].id },
          data: { wardId: station.wardId, stationCode: station.code, stationName: station.name },
        });
        backfilled += 1;
      }
    }

    return { created: 0, existing, backfilled };
  }

  const rows = SAMPLE_AGENTS.map((a, i) => {
    const station = stations.length
      ? stations[Math.floor((i * stations.length) / SAMPLE_AGENTS.length)]
      : null;
    return {
      ...a,
      wardId: station?.wardId ?? null,
      stationCode: station?.code ?? null,
      stationName: station?.name ?? null,
    };
  });

  await prisma.agent.createMany({ data: rows });
  return { created: rows.length, existing: 0, backfilled: 0 };
}

export { SAMPLE_AGENTS };
export default seedAgents;
