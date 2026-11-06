/**
 * Projects, initiatives & achievements — directory seed.
 *
 * The 19 delivery programmes below are the ones the campaign actually runs on
 * the ground. Each carries its own sheet shape (`detailFields`), so a
 * scholarship records an institution + term while a tool-of-trade record
 * records a trade + the tool issued — one table, many sheets. That shape is
 * written as `ProjectField` rows, the same table the console's field builder
 * edits.
 *
 * Seeding is insert-only: programmes and beneficiaries are added only when the
 * directory is empty, so re-running `db:seed` never clobbers genuinely
 * captured delivery data.
 *
 * The beneficiaries are DEMO SAMPLES (every row is flagged in `notes`) that
 * exercise the full sheet — parent/guardian, village, nearby polling centre,
 * an active phone number and the quantity/amount issued. The ward and polling
 * centre on each row are resolved from the LIVE register, so the geography is
 * genuine even though the names are placeholders.
 */

import { fieldRowsFromDefs } from "../src/services/projects.js";

const PROGRAMMES = [
  {
    slug: "tents-chairs",
    name: "Tents & Chairs Support",
    category: "enterprise",
    unit: "group",
    metric: "count",
    summary: "Tents, chairs and event kit issued to community groups and CBOs.",
    description:
      "Mobile tents, plastic chairs and event kit are hired out to community groups for weddings, harambees, funerals and church functions — turning a campaign contact into a small income stream for the group that holds the kit.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Tent", "Chairs", "Event kit", "Funeral kit"] },
      { key: "item", label: "Item issued", type: "text" },
      { key: "group", label: "Group / CBO", type: "text" },
      { key: "parentName", label: "Contact person" },
    ],
    items: [
      { d: { item: "100-seater tent + 100 chairs", group: "Kwanza Youth CBO" }, q: 1 },
      { d: { item: "50-seater tent + 50 chairs", group: "Matisi Widows Group" }, q: 1 },
      { d: { item: "Chairing kit", group: "Saboti Boda Stage" }, q: 60 },
      { d: { item: "Event kit (tent, chairs, PA)", group: "Sikhendu Self-Help Group" }, q: 1 },
      { d: { item: "Funeral kit (tent + 80 chairs)", group: "Sirende Burial Committee" }, q: 1 },
    ],
  },
  {
    slug: "scholarships",
    name: "Scholarships & Bursaries",
    category: "education",
    unit: "student",
    metric: "amount",
    parent: true,
    summary: "School fees and bursary awards for bright students from needy households.",
    description:
      "Termly fee awards and one-off bursaries paid directly to secondary schools, colleges and universities on behalf of students whose households cannot raise the balance.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Bursary", "Full scholarship"] },
      { key: "institution", label: "School", type: "text" },
      { key: "level", label: "Level", type: "select", options: ["Primary", "Secondary", "Tertiary", "University"] },
      { key: "term", label: "Period", type: "text", help: "e.g. 2026 Term 1" },
    ],
    items: [
      { d: { institution: "St. Joseph's Boys High School, Kitale", level: "Secondary", term: "2026 Term 1" }, a: 25000 },
      { d: { institution: "St. Brigid's Girls High School, Kiminini", level: "Secondary", term: "2026 Term 1" }, a: 22000 },
      { d: { institution: "Kitale National Polytechnic", level: "Tertiary", term: "2025/2026" }, a: 45000 },
      { d: { institution: "Trans-Nzoia Boys High School", level: "Secondary", term: "2026 Term 2" }, a: 25000 },
      { d: { institution: "Kwanza Girls Secondary School", level: "Secondary", term: "2026 Term 2" }, a: 20000 },
      { d: { institution: "University of Eldoret", level: "University", term: "2025/2026" }, a: 60000 },
      { d: { institution: "Saboti Technical Training Institute", level: "Tertiary", term: "2026 Term 1" }, a: 38000 },
      { d: { institution: "Endebess Mixed Day Secondary School", level: "Secondary", term: "2026 Term 1" }, a: 18000 },
    ],
  },
  {
    slug: "women-groups",
    name: "Women Groups Economic Empowerment",
    category: "enterprise",
    unit: "group",
    metric: "amount",
    summary: "Revolving funds and startup capital for registered women's groups.",
    description:
      "Working capital released to registered women's groups — table banking, cereals trading, poultry, tailoring and vegetable growing — with a group-named account and a repayment diary.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Group funds", "Tents"] },
      { key: "group", label: "Women's group", type: "text" },
      { key: "activity", label: "Activity of the group", type: "text" },
      { key: "members", label: "No. of group members", type: "number" },
      { key: "period", label: "Period", type: "text" },
      { key: "parentName", label: "Contact person" },
    ],
    items: [
      { d: { group: "Matisi Widows Group", activity: "Cereals trading", members: "24" }, a: 120000 },
      { d: { group: "Kwanza Maendeleo Women", activity: "Table banking", members: "38" }, a: 150000 },
      { d: { group: "Sirende Poultry Keepers", activity: "Poultry & eggs", members: "18" }, a: 90000 },
      { d: { group: "Kiminini Tailoring Circle", activity: "Tailoring", members: "15" }, a: 110000 },
      { d: { group: "Nabiswa Green Growers", activity: "Vegetable farming", members: "22" }, a: 85000 },
      { d: { group: "Hospital Ward Women SACCO", activity: "SACCO top-up", members: "45" }, a: 200000 },
    ],
  },
  {
    slug: "pwd-empowerment",
    name: "PWDs Mobility & Economic Empowerment",
    category: "inclusion",
    unit: "beneficiary",
    metric: "count",
    summary: "Wheelchairs, tricycles, white canes and startup support for persons with disability.",
    description:
      "Mobility aids (wheelchairs, tricycles, crutches, white canes) plus small startup capital and tools so persons with disability can trade, farm or study independently.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Mobility aid", "Economic empowerment"] },
      { key: "item", label: "Mobility / economic item", type: "text" },
      { key: "need", label: "Support category", type: "text" },
    ],
    items: [
      { d: { item: "Wheelchair", need: "Mobility" }, q: 1 },
      { d: { item: "Tricycle (motorised)", need: "Mobility" }, q: 1 },
      { d: { item: "Pair of crutches", need: "Mobility" }, q: 2 },
      { d: { item: "White cane + startup kit", need: "Mobility & Livelihood" }, q: 1 },
      { d: { item: "Kiosk stock grant", need: "Economic" }, a: 40000 },
    ],
  },
  {
    slug: "employment-linkages",
    name: "Employment & Recruitment Linkages",
    category: "employment",
    unit: "recruit",
    metric: "count",
    summary: "Recruitment drives and placements: TSC, KDF, NYS, G4S and private employers.",
    description:
      "Free recruitment clinics and direct placement linkages into TSC (intern teachers), KDF, NYS cohorts, G4S and private employers — application, medical and vetting support included.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Public service", "Uniformed service", "Private sector"] },
      { key: "entity", label: "Entity / Employer", type: "text" },
      { key: "role", label: "Role / Placement", type: "text" },
    ],
    items: [
      { d: { entity: "TSC", role: "Intern teacher (primary)" }, q: 1 },
      { d: { entity: "TSC", role: "Intern teacher (secondary)" }, q: 1 },
      { d: { entity: "Kenya Defence Forces", role: "Recruit intake" }, q: 1 },
      { d: { entity: "NYS", role: "NYS cohort placement" }, q: 1 },
      { d: { entity: "G4S Kenya", role: "Security officer" }, q: 1 },
      { d: { entity: "County Government", role: "Casual / contract staff" }, q: 1 },
      { d: { entity: "Kwanza Dairies", role: "Milk collection clerk" }, q: 1 },
    ],
  },
  {
    slug: "renovations",
    name: "Renovations — Water Springs & Boda Boda Stages",
    category: "infrastructure",
    unit: "project",
    metric: "count",
    summary: "Protected water springs and upgraded boda boda stages.",
    description:
      "Community water springs protected with masonry, piping and a pump house; boda boda stages constructed and upgraded with shelters, seating and night lighting.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Water spring", "Boda boda stage"] },
      { key: "site", label: "Site", type: "text" },
      { key: "scope", label: "Scope of works", type: "textarea" },
      { key: "parentName", label: "Contact person" },
    ],
    items: [
      { d: { site: "Chepchoina Spring", scope: "Spring protection + 2 taps" }, q: 1 },
      { d: { site: "Kaplamai Boda Stage", scope: "Stage shelter + 20 benches" }, q: 1 },
      { d: { site: "Makutano Spring", scope: "Masonry wall + piping" }, q: 1 },
      { d: { site: "Sinyereri Boda Stage", scope: "Grading, shelter, lighting" }, q: 1 },
      { d: { site: "Kinyoro Spring", scope: "Spring protection + soak pit" }, q: 1 },
    ],
  },
  {
    slug: "jenga-nyumba",
    name: "Jenga Nyumba Initiative",
    category: "infrastructure",
    unit: "household",
    metric: "count",
    summary: "Housing support for widows, the elderly and families in extreme need.",
    description:
      "Iron sheets, timber, cement and skilled labour to rebuild or complete a house for widows, the elderly and households living in unsafe structures.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["New build", "Completion", "Repair"] },
      { key: "item", label: "Materials issued", type: "text" },
      { key: "stage", label: "Build stage", type: "text" },
    ],
    items: [
      { d: { item: "30 iron sheets + timber", stage: "Roofing" }, q: 30 },
      { d: { item: "20 bags cement + 24 iron sheets", stage: "Walling & roofing" }, q: 44 },
      { d: { item: "Complete build materials", stage: "Full house" }, q: 1 },
      { d: { item: "Floor slab materials", stage: "Flooring" }, q: 1 },
      { d: { item: "18 iron sheets + nails", stage: "Roofing repair" }, q: 18 },
      { d: { item: "Doors, windows + frames", stage: "Finishing" }, q: 4 },
    ],
  },
  {
    slug: "anti-jigger",
    name: "Anti-Jigger Campaigns",
    category: "inclusion",
    unit: "household",
    metric: "count",
    summary: "Household jigger treatment, fumigation and foot-care outreach.",
    description:
      "Door-to-door jigger campaigns: household fumigation, treatment of affected feet, provision of shoes and soap, and hygiene training for the household.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Household treatment", "School outreach"] },
      { key: "campaign", label: "Campaign / Round", type: "text" },
      { key: "household", label: "Persons treated", type: "number" },
    ],
    items: [
      { d: { campaign: "Chepchoina Round 1", household: "5" }, q: 5 },
      { d: { campaign: "Bidii Round 1", household: "4" }, q: 4 },
      { d: { campaign: "Motosiet Round 2", household: "6" }, q: 6 },
      { d: { campaign: "Matumbei Round 1", household: "3" }, q: 3 },
      { d: { campaign: "Kinyoro Round 2", household: "7" }, q: 7 },
    ],
  },
  {
    slug: "mama-soko",
    name: "Mama Soko Empowerment",
    category: "enterprise",
    unit: "trader",
    metric: "amount",
    summary: "Business boost grants for market traders.",
    description:
      "Business boost grants released to market traders to restock, buy a stall licence or add a second line of goods — issued at the market gate with a stall-by-stall register.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Restock grant", "Stall licence", "Business boost"] },
      { key: "market", label: "Market", type: "text" },
      { key: "purpose", label: "Purpose", type: "text" },
    ],
    items: [
      { d: { market: "Kitale Municipal Market", purpose: "Produce restock" }, a: 15000 },
      { d: { market: "Kwanza Market", purpose: "Stall licence + stock" }, a: 12000 },
      { d: { market: "Kiminini Market", purpose: "Fish business boost" }, a: 18000 },
      { d: { market: "Makutano Market", purpose: "Second line of goods" }, a: 10000 },
      { d: { market: "Endebess Market", purpose: "Grain trading capital" }, a: 20000 },
      { d: { market: "Saboti Market", purpose: "Vegetable restock" }, a: 8000 },
    ],
  },
  {
    slug: "carwash-cherehani",
    name: "Carwash Machines, Cherehani & Other Items",
    category: "enterprise",
    unit: "beneficiary",
    metric: "count",
    summary: "Carwash machines, sewing machines (cherehani) and other income-generating items.",
    description:
      "Income-generating machinery handed over to youth groups and individuals: high-pressure carwash machines, electric and manual sewing machines (cherehani), and other trade equipment.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Carwash machine", "Sewing machine", "Other item"] },
      { key: "item", label: "Item issued", type: "text" },
      { key: "group", label: "Group / individual business", type: "text" },
      { key: "parentName", label: "Contact person" },
    ],
    items: [
      { d: { item: "High-pressure carwash machine", group: "Makutano Youth Carwash" }, q: 1 },
      { d: { item: "Electric sewing machine (cherehani)", group: "Sirende Tailors" }, q: 1 },
      { d: { item: "Manual sewing machine (cherehani)", group: "Bidii Tailoring Group" }, q: 1 },
      { d: { item: "Water pump + hoses", group: "Saboti Wash Bay" }, q: 1 },
      { d: { item: "Barbering kit", group: "Kiminini Youth Salon" }, q: 1 },
    ],
  },
  {
    slug: "tools-of-trade",
    name: "Tools of Trade — Artisans & Technicians",
    category: "enterprise",
    unit: "artisan",
    metric: "count",
    summary: "Artisans, tailors, mechanics and technicians equipped with working tools.",
    description:
      "Working tool kits for trained artisans who had the skill but not the equipment: carpenters, masons, mechanics, welders, electricians, plumbers and tailors.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["New kit", "Replacement"] },
      { key: "trade", label: "Trade", type: "text" },
      { key: "tool", label: "Tool / kit issued", type: "text" },
    ],
    items: [
      { d: { trade: "Carpentry", tool: "Plane, chisels, hand saw set" }, q: 1 },
      { d: { trade: "Welding", tool: "Welding machine + helmet" }, q: 1 },
      { d: { trade: "Motor vehicle mechanics", tool: "Socket + spanner set" }, q: 1 },
      { d: { trade: "Masonry", tool: "Trowels, levels, mixing kit" }, q: 1 },
      { d: { trade: "Electrical", tool: "Multimeter + installation tools" }, q: 1 },
      { d: { trade: "Tailoring", tool: "Sewing machine + cutting kit" }, q: 1 },
    ],
  },
  {
    slug: "market-gear",
    name: "Market Trader Gear — Aprons & Umbrellas",
    category: "enterprise",
    unit: "trader",
    metric: "count",
    summary: "Aprons, market umbrellas and trade gear for market traders.",
    description:
      "Branded aprons, wide market umbrellas and trade gear issued to traders so they work in comfort and shade — issued stall by stall on market days.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Apron", "Umbrella", "Full gear"] },
      { key: "item", label: "Item issued", type: "text" },
      { key: "market", label: "Market", type: "text" },
    ],
    items: [
      { d: { item: "Market umbrella", market: "Kitale Municipal Market" }, q: 1 },
      { d: { item: "Apron + umbrella set", market: "Kwanza Market" }, q: 1 },
      { d: { item: "3 aprons", market: "Kiminini Market" }, q: 3 },
      { d: { item: "Market umbrella", market: "Makutano Market" }, q: 1 },
      { d: { item: "Apron set", market: "Endebess Market" }, q: 2 },
      { d: { item: "Umbrella + gumboots", market: "Saboti Market" }, q: 1 },
    ],
  },
  {
    slug: "individual-empowerment",
    name: "Individual Empowerment — Co-ordinators",
    category: "enterprise",
    unit: "beneficiary",
    metric: "amount",
    summary: "Direct grants to ward and community co-ordinators.",
    description:
      "Direct grants released to ward and community co-ordinators who hold the ground organisation together — transport, airtime and a working float for their mobilisation work.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Ward co-ordinator", "Sub-county co-ordinator", "Youth co-ordinator"] },
      { key: "purpose", label: "Purpose", type: "text" },
      { key: "role", label: "Role", type: "text" },
    ],
    items: [
      { d: { purpose: "Mobilisation float", role: "Ward co-ordinator" }, a: 30000 },
      { d: { purpose: "Transport support", role: "Sub-county co-ordinator" }, a: 45000 },
      { d: { purpose: "Airtime & data", role: "Ward co-ordinator" }, a: 10000 },
      { d: { purpose: "Field logistics", role: "Bloc co-ordinator" }, a: 25000 },
      { d: { purpose: "Youth wing float", role: "Youth co-ordinator" }, a: 20000 },
    ],
  },
  {
    slug: "bedding-support",
    name: "Bedding Support — Schools & Elderly",
    category: "education",
    unit: "beneficiary",
    metric: "count",
    parent: true,
    summary: "Mattresses and blankets for schools and elderly households.",
    description:
      "Mattresses and blankets delivered to boarding schools with pupils who cannot raise bedding, and to elderly households in the ward.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Mattress", "Blanket", "Bedding set"] },
      { key: "item", label: "Item issued", type: "text" },
      { key: "place", label: "School / village", type: "text" },
    ],
    items: [
      { d: { item: "3-inch mattress + blanket", place: "St. Brigid's Girls" }, q: 1 },
      { d: { item: "3-inch mattress + blanket", place: "Kwanza Girls Secondary" }, q: 1 },
      { d: { item: "Mattress + 2 blankets", place: "Elderly household" }, q: 1 },
      { d: { item: "2 mattresses + blankets", place: "Chepchoina Primary Boarding" }, q: 2 },
      { d: { item: "Blanket + bedsheet", place: "Elderly household" }, q: 1 },
      { d: { item: "4 mattresses", place: "Mitoto Special School" }, q: 4 },
    ],
  },
  {
    slug: "zero-barefoot",
    name: "Restoring Dignity — Zero Barefoot Campaign",
    category: "education",
    unit: "pupil",
    metric: "count",
    parent: true,
    summary: "School shoes issued to barefoot pupils.",
    description:
      "Shoe drives in primary and special-needs schools — every barefoot pupil measured and issued a pair of school shoes to restore dignity and cut foot infections.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["School shoes", "Socks"] },
      { key: "school", label: "School", type: "text" },
      { key: "size", label: "Shoe size", type: "text" },
    ],
    items: [
      { d: { school: "Bidii Primary School", size: "30" }, q: 1 },
      { d: { school: "Chepchoina Primary School", size: "32" }, q: 1 },
      { d: { school: "Motosiet Primary School", size: "28" }, q: 1 },
      { d: { school: "Kinyoro Primary School", size: "34" }, q: 1 },
      { d: { school: "Sikhendu Primary School", size: "31" }, q: 1 },
      { d: { school: "Mitoto Special School", size: "29" }, q: 1 },
    ],
  },
  {
    slug: "church-mosque",
    name: "Church & Mosque Support",
    category: "infrastructure",
    unit: "place of worship",
    metric: "count",
    summary: "Iron sheets, cement and building materials for places of worship.",
    description:
      "Iron sheets, cement, timber and building materials delivered to churches and mosques for roofing, flooring and construction — handed over with the congregation present.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Church", "Mosque"] },
      { key: "item", label: "Materials issued", type: "text" },
      { key: "place", label: "Place of worship", type: "text" },
      { key: "parentName", label: "Contact person" },
    ],
    items: [
      { d: { item: "25 iron sheets", place: "ACK Bidii Church" }, q: 25 },
      { d: { item: "40 bags of cement", place: "Kitale Jamia Mosque" }, q: 40 },
      { d: { item: "30 iron sheets + timber", place: "PEFA Sirende Church" }, q: 30 },
      { d: { item: "20 bags cement + sand", place: "Catholic Mission Mutoto" }, q: 20 },
      { d: { item: "Roofing materials", place: "Kwanza AIC Church" }, q: 1 },
    ],
  },
  {
    slug: "pad-a-girl",
    name: "Pad-a-Girl Initiative",
    category: "education",
    unit: "girl",
    metric: "count",
    summary: "Sanitary towel packets distributed to schoolgirls.",
    description:
      "Sanitary towel packets and hygiene kits distributed to schoolgirls across the wards, with a short health talk at each school assembly.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Sanitary packets", "Hygiene kit"] },
      { key: "school", label: "School", type: "text" },
      { key: "packets", label: "Packets", type: "number" },
    ],
    items: [
      { d: { school: "Kwanza Girls Secondary School", packets: "6" }, q: 6 },
      { d: { school: "Matisi Mixed Secondary School", packets: "4" }, q: 4 },
      { d: { school: "Endebess Mixed Day Secondary School", packets: "5" }, q: 5 },
      { d: { school: "Sikhendu Girls Secondary School", packets: "6" }, q: 6 },
      { d: { school: "Nabiswa Secondary School", packets: "4" }, q: 4 },
      { d: { school: "Mitoto Special School", packets: "8" }, q: 8 },
    ],
  },
  {
    slug: "sports-youth",
    name: "Sports & Youth Empowerment",
    category: "sports",
    unit: "team",
    metric: "count",
    summary: "Jerseys, balls and tournament gear — plus sports recruitment linkages.",
    description:
      "Jerseys, footballs, netballs and tournament gear handed to ward teams, alongside scouting linkages into county and national leagues and sports academies.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Jerseys", "Balls", "Full kit"] },
      { key: "sport", label: "Sport", type: "select", options: ["Football", "Netball", "Volleyball", "Athletics"] },
      { key: "item", label: "Item issued", type: "text" },
      { key: "team", label: "Team", type: "text" },
      { key: "parentName", label: "Team contact" },
    ],
    items: [
      { d: { sport: "Football", item: "18 jerseys + 2 balls", team: "Matisi FC" }, q: 20 },
      { d: { sport: "Netball", item: "12 kits + 2 balls", team: "Kwanza Netball Club" }, q: 14 },
      { d: { sport: "Football", item: "16 jerseys + tournament gear", team: "Saboti Stars" }, q: 18 },
      { d: { sport: "Volleyball", item: "Jerseys + 2 balls", team: "Bidii Volleyball Team" }, q: 14 },
      { d: { sport: "Athletics", item: "Training kit + spikes", team: "Endebess Athletics" }, q: 12 },
      { d: { sport: "Football", item: "Tournament gear (2 teams)", team: "Kiminini Ward League" }, q: 36 },
    ],
  },
  {
    slug: "special-schools",
    name: "Special Schools Support",
    category: "education",
    unit: "school",
    metric: "count",
    summary: "Books, food and specialised materials for special-needs schools.",
    description:
      "Learning materials, foodstuff and specialised equipment delivered to special-needs schools — including Mitoto Special School for the deaf and intellectually disabled.",
    detailFields: [
      { key: "category", label: "Category", type: "select", options: ["Learning materials", "Foodstuff", "Equipment"] },
      { key: "school", label: "School", type: "text" },
      { key: "item", label: "Item issued", type: "text" },
    ],
    items: [
      { d: { school: "Mitoto Special School", item: "Books, food & learning aids" }, q: 1 },
      { d: { school: "Mitoto Special School", item: "Maize, beans & cooking oil" }, q: 12 },
      { d: { school: "Kitale School for the Deaf", item: "Braille & sign-language kits" }, q: 1 },
      { d: { school: "Kwanza Special Unit", item: "Books and stationery" }, q: 1 },
      { d: { school: "Saboti Special Unit", item: "Foodstuff and bedding" }, q: 1 },
    ],
  },
];

// Deterministic placeholder name pools — clearly demo-only.
const FIRST = [
  "Brian", "Mercy", "Kevin", "Faith", "Dennis", "Grace", "Samuel", "Esther", "Patrick", "Ruth",
  "Isaac", "Beatrice", "Wycliffe", "Janet", "Nicholas", "Alice", "Joseph", "Hellen", "Elijah", "Rose",
  "Anthony", "Nancy", "Simon", "Gladys", "Michael", "Florence", "Charles", "Mary", "Peter", "Sarah",
  "Daniel", "Jane", "Erick", "Lucy", "William", "Agnes",
];
const LAST = [
  "Barasa", "Wanyonyi", "Simiyu", "Wekesa", "Masika", "Nekesa", "Wafula", "Khaemba", "Kisiangani",
  "Mukhwana", "Wasike", "Khakame", "Kemboi", "Mutai", "Rono", "Sang", "Kirui", "Chebet", "Kipruto",
  "Rotich", "Towett", "Ochieng", "Omondi", "Juma", "Wanjala", "Nato", "Munyes", "Lokwang", "Chepkwony",
];

const DEMO_NOTE =
  "Demo sample record for the directory UI — replace with verified beneficiary data.";

const personName = (n) => `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + 3) % LAST.length]}`;
const parentName = (n) => `${FIRST[(n * 5 + 11) % FIRST.length]} ${LAST[(n * 3 + 5) % LAST.length]}`;
const demoPhone = (n) => `2547${String(10000000 + n * 137).slice(-8)}`;

const isoDate = (days) => {
  const base = Date.UTC(2026, 0, 15);
  return new Date(base + days * 86400000);
};

export async function seedProjects(prisma) {
  const existing = await prisma.project.count();
  if (existing > 0) return { created: 0, existing, beneficiaries: 0 };

  const stations = await prisma.station.findMany({
    select: { code: true, name: true, wardId: true, ward: { select: { name: true } } },
    orderBy: { sortOrder: "asc" },
  });

  let beneficiaries = 0;
  let seedIndex = 0;

  for (let pi = 0; pi < PROGRAMMES.length; pi++) {
    const p = PROGRAMMES[pi];
    const project = await prisma.project.create({
      data: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        summary: p.summary,
        description: p.description,
        unit: p.unit,
        metric: p.metric,
        // The sheet shape lives in ProjectField rows — the same table the
        // console's field builder edits.
        fields: { create: fieldRowsFromDefs(p.detailFields) },
        status: "active",
        startDate: isoDate(0),
        order: pi + 1,
      },
    });

    if (!stations.length) continue;

    const count = p.items.length + 2;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const tpl = p.items[i % p.items.length];
      const station = stations[(pi * 11 + i * 29) % stations.length];
      const villageBase = (station.ward?.name ?? "").replace(/\s*Ward$/i, "").trim();
      rows.push({
        projectId: project.id,
        name: personName(seedIndex),
        parentName: p.parent ? parentName(seedIndex) : null,
        phone: demoPhone(seedIndex),
        wardId: station.wardId,
        village: villageBase ? `${villageBase} Village` : null,
        stationCode: station.code,
        stationName: station.name,
        quantity: tpl.q ?? null,
        amount: tpl.a ?? null,
        dateIssued: isoDate((pi * 13 + i * 7) % 300),
        status: i % 5 === 4 ? "pending" : "issued",
        details: JSON.stringify(tpl.d ?? {}),
        notes: DEMO_NOTE,
      });
      seedIndex += 1;
    }

    await prisma.projectBeneficiary.createMany({ data: rows });
    beneficiaries += rows.length;
  }

  return { created: PROGRAMMES.length, existing: 0, beneficiaries };
}

export { PROGRAMMES };
export default seedProjects;
