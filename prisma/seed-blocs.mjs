/**
 * Outreach — sample bloc register.
 *
 * The eight blocs below are the ones the campaign actually organises around:
 * three farms and five business-community groups. Each bloc carries its
 * population, its official (chairman), the polling centre where the majority
 * of its members vote, its captured members and the key messages it hears.
 *
 * Seeding is insert-only: blocs are added only when the register is empty, so
 * re-running `db:seed` never clobbers genuinely recruited blocs or members.
 *
 * The polling centre is resolved from the LIVE register rather than hardcoded.
 * Where the bloc name matches a real centre (`Koross Farm` -> `KOROSS PRI SCH`)
 * that centre is used, so the geography is genuine; anything unmatched falls
 * back to striding evenly across the 757 stations.
 */

const SAMPLE_BLOCS = [
  {
    name: "Koross Farm",
    category: "farm",
    population: 640,
    officialName: "Joseph Kipchumba Rotich",
    officialPhone: "254712350001",
    officialId: "43210001",
    centreHint: "KOROSS PRI SCH",
    keyMessages: [
      "Input prices and KMC payment lanes: we opened the dairy and maize windows.",
      "A farmer's daughter knows the value of every acre — land clinics every month.",
      "Youth agripreneurs: greenhouse and poultry starter grants are open.",
    ],
    members: [
      { fullName: "Daniel Kipruto Sang", gender: "male", phone: "254713360001", idNumber: "33220001" },
      { fullName: "Mercy Chebet Rono", gender: "female", phone: "254713360002", idNumber: "33220002" },
      { fullName: "William Kiprotich Barasa", gender: "male", phone: "254713360003", idNumber: "33220003" },
      { fullName: "Gladys Jepkoech Mutai", gender: "female", phone: "254713360004", idNumber: "33220004" },
      { fullName: "Simon Kipkemboi Towett", gender: "male", phone: "254713360005", idNumber: "33220005" },
    ],
  },
  {
    name: "Nakwanga Farm",
    category: "farm",
    population: 380,
    officialName: "Anne Nasimiyu Wanyonyi",
    officialPhone: "254712350002",
    officialId: "43210002",
    keyMessages: [
      "Fertiliser and feed round-tables — the county subsidy queue is moving again.",
      "Women's dairy groups got the first funding window. Receipts matter.",
      "Every acre under a title deed is an acre that can borrow.",
    ],
    members: [
      { fullName: "Peter Wafula Masika", gender: "male", phone: "254713360006", idNumber: "33220006" },
      { fullName: "Ruth Nekesa Barasa", gender: "female", phone: "254713360007", idNumber: "33220007" },
      { fullName: "Charles Wekesa Simiyu", gender: "male", phone: "254713360008", idNumber: "33220008" },
      { fullName: "Beatrice Nabwire Juma", gender: "female", phone: "254713360009", idNumber: "33220009" },
    ],
  },
  {
    name: "Sarura Farm",
    category: "farm",
    population: 275,
    officialName: "Erick Kipngetich Kirui",
    officialPhone: "254712350003",
    officialId: "43210003",
    centreHint: "SARURA PRI SCH",
    keyMessages: [
      "Water and feeder roads to the farm gate, not just to the market.",
      "Coffee and dairy cooperative AGMs get a Siyoi desk this season.",
      "Nobody should lose a harvest for want of a road.",
    ],
    members: [
      { fullName: "David Kipchirchir Sang", gender: "male", phone: "254713360010", idNumber: "33220010" },
      { fullName: "Esther Chepkoech Kirui", gender: "female", phone: "254713360011", idNumber: "33220011" },
      { fullName: "Michael Kiprono Chebet", gender: "male", phone: "254713360012", idNumber: "33220012" },
      { fullName: "Alice Jesang Towett", gender: "female", phone: "254713360013", idNumber: "33220013" },
    ],
  },
  {
    name: "Kinyozi Association",
    category: "business",
    population: 210,
    officialName: "Samuel Ochieng Odhiambo",
    officialPhone: "254712350004",
    officialId: "43210004",
    keyMessages: [
      "Lower licence hassles and cleaner trading — more money in the pocket.",
      "Shops on every street: the county SME desk now takes walk-ins.",
      "A camera and a chair is a business. We count it as one.",
    ],
    members: [
      { fullName: "Brian Wekesa Wanyonyi", gender: "male", phone: "254713360014", idNumber: "33220014" },
      { fullName: "Dennis Omondi Otieno", gender: "male", phone: "254713360015", idNumber: "33220015" },
      { fullName: "Kelvin Wafula Nato", gender: "male", phone: "254713360016", idNumber: "33220016" },
      { fullName: "Ibrahim Kipchoge Barasa", gender: "male", phone: "254713360017", idNumber: "33220017" },
    ],
  },
  {
    name: "Mama Mboga Group",
    category: "business",
    population: 1450,
    officialName: "Margaret Nekesa Wafula",
    officialPhone: "254712350005",
    officialId: "43210005",
    keyMessages: [
      "Siyoi has fast-tracked women's enterprise funding — registration is open.",
      "Market sheds and sanitation delivered in Kwanza and Kiminini markets.",
      "A Woman Representative who shows up weekly, not just at elections.",
    ],
    members: [
      { fullName: "Grace Nasambu Khakame", gender: "female", phone: "254713360018", idNumber: "33220018" },
      { fullName: "Jane Chebet Kemboi", gender: "female", phone: "254713360019", idNumber: "33220019" },
      { fullName: "Sarah Wanjala Mukhwana", gender: "female", phone: "254713360020", idNumber: "33220020" },
      { fullName: "Mary Nekesa Simiyu", gender: "female", phone: "254713360021", idNumber: "33220021" },
      { fullName: "Florence Chepkoech Mutai", gender: "female", phone: "254713360022", idNumber: "33220022" },
      { fullName: "Hellen Nabwire Wasike", gender: "female", phone: "254713360023", idNumber: "33220023" },
    ],
  },
  {
    name: "Bodaboda Sacco",
    category: "business",
    population: 320,
    officialName: "Patrick Wafula Khaemba",
    officialPhone: "254712350006",
    officialId: "43210006",
    keyMessages: [
      "Our riders are the fastest news network in Trans-Nzoia.",
      "Lower SACCO loan entry for riders — Siyoi pushed the county window.",
      "Ride for the change you want to see on August 10.",
    ],
    members: [
      { fullName: "Kevin Omondi Ojwang", gender: "male", phone: "254713360024", idNumber: "33220024" },
      { fullName: "Anthony Wafula Kisiangani", gender: "male", phone: "254713360025", idNumber: "33220025" },
      { fullName: "Elijah Kipngetich Sang", gender: "male", phone: "254713360026", idNumber: "33220026" },
      { fullName: "Nicholas Barasa Wekesa", gender: "male", phone: "254713360027", idNumber: "33220027" },
      { fullName: "Joseph Simiyu Wasike", gender: "male", phone: "254713360028", idNumber: "33220028" },
    ],
  },
  {
    name: "Mama Samaki Group",
    category: "business",
    population: 480,
    officialName: "Grace Akinyi Ouma",
    officialPhone: "254712350007",
    officialId: "43210007",
    keyMessages: [
      "Cold storage at the landing site — fish should not spoil before market.",
      "Trading licences and crèches at the market gate, not across town.",
      "From the boat to the table: a clean chain earns more.",
    ],
    members: [
      { fullName: "Rose Atieno Ochieng", gender: "female", phone: "254713360029", idNumber: "33220029" },
      { fullName: "Lucy Nekesa Wamalwa", gender: "female", phone: "254713360030", idNumber: "33220030" },
      { fullName: "Agnes Nasimiyu Simiyu", gender: "female", phone: "254713360031", idNumber: "33220031" },
      { fullName: "Janet Akello Munyasa", gender: "female", phone: "254713360032", idNumber: "33220032" },
    ],
  },
  {
    name: "Stage 20",
    category: "business",
    population: 165,
    officialName: "Titus Kipkemboi Rono",
    officialPhone: "254712350008",
    officialId: "43210008",
    keyMessages: [
      "Every stage gets a captain and a night-briefing group.",
      "Bursary and enterprise desks come to the stage, not the other way round.",
      "The stage is where the county's news travels first.",
    ],
    members: [
      { fullName: "Isaac Wekesa Barasa", gender: "male", phone: "254713360033", idNumber: "33220033" },
      { fullName: "Wycliffe Omondi Otieno", gender: "male", phone: "254713360034", idNumber: "33220034" },
      { fullName: "Faith Chepkoech Rotich", gender: "female", phone: "254713360035", idNumber: "33220035" },
      { fullName: "Stephen Kipruto Mutai", gender: "male", phone: "254713360036", idNumber: "33220036" },
    ],
  },
];

export async function seedBlocs(prisma) {
  const existing = await prisma.bloc.count();
  if (existing > 0) return { created: 0, existing, members: 0 };

  // Stations are ordered by sortOrder (the seed JSON order), so striding across
  // them spreads the blocs evenly over every ward and sub-county.
  const stations = await prisma.station.findMany({
    select: { code: true, name: true, wardId: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!stations.length) return { created: 0, existing: 0, members: 0 };

  let members = 0;
  let created = 0;
  for (let i = 0; i < SAMPLE_BLOCS.length; i++) {
    const b = SAMPLE_BLOCS[i];
    const hint = b.centreHint?.toUpperCase();
    const station =
      (hint && stations.find((s) => s.name.toUpperCase().includes(hint))) ||
      stations[Math.floor((i * stations.length) / SAMPLE_BLOCS.length)];

    try {
      await prisma.bloc.create({
        data: {
          name: b.name,
          category: b.category,
          population: b.population,
          officialName: b.officialName,
          officialPhone: b.officialPhone,
          officialId: b.officialId,
          stationCode: station.code,
          stationName: station.name,
          wardId: station.wardId,
          keyMessages: JSON.stringify(b.keyMessages),
          members: { create: b.members },
        },
      });
      created += 1;
      members += b.members.length;
    } catch (err) {
      // A parallel process (the test runner boots the app once per file) or a
      // boot racing `db:seed` may have inserted this bloc first. The unique
      // name makes that collision harmless — skip it rather than crash.
      if (err?.code !== "P2002") throw err;
    }
  }

  return { created, existing: SAMPLE_BLOCS.length - created, members };
}

export { SAMPLE_BLOCS };
export default seedBlocs;
