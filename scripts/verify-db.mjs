#!/usr/bin/env node
/** Quick sanity check against the seeded SQLite database. */
import prisma from "../src/db.js";

const [sc, wards, stations, centres, statuses, readiness] = await Promise.all([
  prisma.subCounty.count(),
  prisma.ward.count(),
  prisma.station.count(),
  prisma.centre.count(),
  prisma.centre.groupBy({ by: ["status"], _count: true }),
  prisma.wardReadiness.count(),
]);
const agg = await prisma.station.aggregate({ _sum: { registered: true, siyoi: true } });
const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { username: true, role: true } });
const totals = await prisma.user.count();

console.log(JSON.stringify(
  {
    subCounties: sc,
    wards,
    stations,
    centres,
    statuses: statuses.map((s) => `${s.status}:${s._count}`),
    readinessWards: readiness,
    registered: agg._sum.registered,
    siyoi: agg._sum.siyoi,
    adminAccount: admin ? { username: admin.username, role: admin.role } : null,
    users: totals,
  },
  null,
  2
));

await prisma.$disconnect();