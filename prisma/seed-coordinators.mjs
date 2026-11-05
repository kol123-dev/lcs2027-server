/**
 * Field Ops — the first area co-ordinator on file.
 *
 * The plan calls for 5 sub-county + 25 ward = 30 co-ordinators (see
 * src/services/coordinators.js). This seeder puts the first one in place so a
 * fresh install shows the roster, the post board and the dashboard tile with
 * real data instead of an empty register.
 *
 * Seeding is insert-only: the row is added only when the register is empty, so
 * re-running `db:seed` never clobbers genuinely appointed co-ordinators. The
 * ward is resolved from the LIVE register (Kwanza Ward) rather than hardcoded,
 * so the ward and sub-county links are always genuine.
 */

const SAMPLE_COORDINATOR = {
  fullName: "Nancy Chebet Kones",
  idNumber: "32145698",
  gender: "female",
  phone: "254712340021",
  altPhone: "254722340021",
  areaType: "ward",
  wardId: "kwanza-ward",
  wardName: "Kwanza Ward",
};

export async function seedCoordinators(prisma) {
  const existing = await prisma.coordinator.count();
  if (existing > 0) return { created: 0, existing };

  const ward = await prisma.ward.findFirst({
    where: { OR: [{ id: SAMPLE_COORDINATOR.wardId }, { name: SAMPLE_COORDINATOR.wardName }] },
    select: { id: true, subCountyId: true },
  });
  if (!ward) return { created: 0, existing: 0, skipped: true };

  await prisma.coordinator.create({
    data: {
      fullName: SAMPLE_COORDINATOR.fullName,
      idNumber: SAMPLE_COORDINATOR.idNumber,
      gender: SAMPLE_COORDINATOR.gender,
      phone: SAMPLE_COORDINATOR.phone,
      altPhone: SAMPLE_COORDINATOR.altPhone,
      areaType: SAMPLE_COORDINATOR.areaType,
      wardId: ward.id,
      subCountyId: ward.subCountyId,
    },
  });

  return { created: 1, existing: 0 };
}

export { SAMPLE_COORDINATOR };
export default seedCoordinators;
