import context from "../data/context.js";

/**
 * Demographic Outreach & Resource Calculator.
 * Playbooks for the core grassroots blocs + a budget calculator where
 * unit costs are centralised so planners can cost a field plan in seconds.
 */

export const SEGMENTS = [
  {
    id: "mamaMboga",
    label: "Mama Mbogas",
    size: "7,000+ traders county-wide across 40+ open-air markets",
    geography: "Kwanza, Kiminini, Saboti markets; Kitale town",
    engagement: [
      "Market-day circuit: visit stalls with a 3-minute ask, repeat weekly.",
      "Issue cards: affordable credit, clean water, market sheds & security.",
      "Women-focussed micro-SME desks (4K clubs, enterprise funds).",
      "Morning radio slots + market loudspeaker announcements.",
    ],
    organizing: [
      "Form ward market committees with elected trader reps.",
      "1 market captain per market; WhatsApp market groups.",
      "Attendance logging & issue back-calls within 72 hours.",
    ],
    keyMessages: [
      "Siyoi has fast-tracked women's enterprise funding — registration is open.",
      "Market sheds & sanitation delivered in Kwanza & Kiminini markets.",
      "A Woman Representative who shows up weekly, not just at elections.",
    ],
  },
  {
    id: "bodaBoda",
    label: "Boda Boda Associations",
    size: "36 SACCOs/stages across 5 sub-counties, ~8,000 riders",
    geography: "Kitale town, Kwanza stage network, border towns",
    engagement: [
      "SACCO rides & stage visits; free registration days with IEBC kits.",
      "Rider safety & insurance partnerships (helmet drives, bank loans).",
      "Weekend football tournaments: Siyoi Cup (12 wards).",
      "GOTV weekday shifts: riders double as couriers & escorts.",
    ],
    organizing: [
      "County riders' council of SACCO chairs.",
      "Stage captain per stage; night-briefing WhatsApp group.",
      "Free airtime reward for on-time community reporting.",
    ],
    keyMessages: [
      "Our riders are the fastest news network in Trans-Nzoia.",
      "Lower SACCO loan entry for riders — Siyoi pushed the county window.",
      "Ride for the change you want to see on Aug 10.",
    ],
  },
  {
    id: "farmers",
    label: "Farmers & Cooperatives",
    size: "Dairy, maize & coffee belt: 60%+ of county households",
    geography: "Cherangany, Endebess, Saboti highlands",
    engagement: [
      "Field days with cooperative societies (Tanykina, dairy hubs).",
      "Input price round-tables: fertiliser, feeds, credit access.",
      "Farm-level listening tours: 6 wards per month (Apr–Jul).",
      "Youth agripreneurs: greenhouse & poultry starter grants.",
    ],
    organizing: [
      "Cooperative society reps as ward anchors.",
      "Chairman desk at every coffee/dairy society AGM.",
      "Issue tracker: land clinic referrals, KMC payments flow.",
    ],
    keyMessages: [
      "From the farm gate to the payroll: we opened dairy & KMC payment lanes.",
      "Women's dairy groups got first funding window — receipts matter.",
      "A farmer's daughter knows the value of every acre.",
    ],
  },
  {
    id: "marketVendors",
    label: "Market Vendors & Wholesalers",
    size: "~5,000 vendors incl. wholesale & cross-border traders",
    geography: "Kitale municipal markets, border posts",
    engagement: [
      "Morning blitz at cargo & wholesale nodes (06:00–09:00 shifts).",
      "County revenue & licence fee advocacy round-tables.",
      "Vendor welfare: crèches, storage, sanitation at markets.",
      "Digital cashboxes for traders' savings groups.",
    ],
    organizing: ["Market liaison officer per market", "Vendor welfare WhatsApp", "Licence clinic days with county officers"],
    keyMessages: [
      "Lower licence hassles & cleaner trading = more money in the pocket.",
      "We fought for vendor-friendly county budget lines.",
      "Vote for someone who knows the market gate opens at dawn.",
    ],
  },
  {
    id: "womenGroups",
    label: "Women Groups & Chamas",
    size: "1,100+ registered women groups & village savings circles",
    geography: "County-wide; church & school networks",
    engagement: [
      "Group visit schedule: 3 per ward/month (75 total).",
      "Bursary & enterprise application support desks.",
      "Women's rights & safety forums co-hosted with CBOs.",
      "Chama contests: savings challenge with county awards.",
    ],
    organizing: ["Ward women coordinators", "Group census database", "Quarterly women congress"],
    keyMessages: [
      "Her dream is the agenda: women's enterprise fund is not a slogan.",
      "We raised the county voice on gender desks & GBV response.",
      "Mama mboga, mama mkulima, mama kibarua — Siyoi is your voice.",
    ],
  },
];

const UNIT_COSTS = {
  communityBaraza: { amount: 30000, label: "Community Baraza", unit: "per event" },
  marketBlitz: { amount: 12000, label: "Market-Day Blitz", unit: "per blitz" },
  churchBlitz: { amount: 8000, label: "Church Blitz (stewardship)", unit: "per service" },
  houseToHouseDay: { amount: 60000, label: "House-to-House Day (50 mobilizers)", unit: "per day" },
  bodaMeet: { amount: 20000, label: "Boda Boda SACCO Meet", unit: "per meet" },
  farmersFieldDay: { amount: 35000, label: "Farmers Field Day", unit: "per day" },
  womenGroupForum: { amount: 15000, label: "Women Group Forum", unit: "per forum" },
  regDrive: { amount: 18000, label: "IEBC Registration Drive", unit: "per drive" },
  subCountyRally: { amount: 250000, label: "Sub-County Homecoming Rally", unit: "per rally" },
  broadcast: { amount: 80000, label: "Radio / Broadcast Week", unit: "per week" },
  brandingKit: { amount: 50000, label: "Ward Branding Kit", unit: "per kit" },
};

/**
 * Compute a field budget plan.
 * counts: { eventId: numberOfEvents }
 * scope: perWard boolean -> multiply counts across all 25 wards
 */
export function calculateBudget({ counts = {}, perWard = false }) {
  const multiplier = perWard ? context.wards.length : 1;
  const lines = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const unit = UNIT_COSTS[id];
      if (!unit) return null;
      const quantity = n * multiplier;
      return {
        id,
        label: unit.label,
        unitCost: unit.amount,
        quantity,
        lineCost: unit.amount * quantity,
      };
    })
    .filter(Boolean);
  const total = lines.reduce((a, l) => a + l.lineCost, 0);
  return { scope: perWard ? "county-wide (per ward)" : "county-wide", total, lines, units: UNIT_COSTS };
}

export function outreach() {
  return {
    segments: SEGMENTS.map((s) => ({
      id: s.id,
      label: s.label,
      size: s.size,
      geography: s.geography,
      engagement: s.engagement,
      organizing: s.organizing,
      keyMessages: s.keyMessages,
    })),
    unitCosts: UNIT_COSTS,
    budgetDefaults: {
      suggestedMonthly: {
        communityBaraza: 25,
        marketBlitz: 40,
        churchBlitz: 12,
        houseToHouseDay: 8,
        bodaMeet: 10,
        farmersFieldDay: 6,
        womenGroupForum: 12,
        regDrive: 6,
      },
    },
  };
}

export default { outreach, calculateBudget };