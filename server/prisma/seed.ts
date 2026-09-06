import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Locations
  const locMain = await prisma.location.upsert({
    where: { code: 'WH-MAIN' },
    update: {},
    create: {
      name: 'Main Distribution Warehouse',
      code: 'WH-MAIN',
      isActive: true,
    },
  });

  const locStore = await prisma.location.upsert({
    where: { code: 'STORE-01' },
    update: {},
    create: {
      name: 'Downtown Retail Floor',
      code: 'STORE-01',
      isActive: true,
    },
  });

  const locNorth = await prisma.location.upsert({
    where: { code: 'WH-NORTH' },
    update: {},
    create: {
      name: 'Northside Transit Depot',
      code: 'WH-NORTH',
      isActive: true,
    },
  });

  console.log('✅ Locations seeded:', [locMain.name, locStore.name, locNorth.name]);

  // 2. Create Users
  const salt = await bcrypt.genSalt(10);
  const managerPasswordHash = await bcrypt.hash('Manager123!', salt);
  const staffPasswordHash = await bcrypt.hash('Staff123!', salt);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@distributor.com' },
    update: {},
    create: {
      email: 'manager@distributor.com',
      passwordHash: managerPasswordHash,
      name: 'Elena Rostova (Inventory Manager)',
      role: Role.MANAGER,
    },
  });

  const staff1 = await prisma.user.upsert({
    where: { email: 'staff1@distributor.com' },
    update: {},
    create: {
      email: 'staff1@distributor.com',
      passwordHash: staffPasswordHash,
      name: 'Marcus Vance (Warehouse Lead)',
      role: Role.STAFF,
    },
  });

  const staff2 = await prisma.user.upsert({
    where: { email: 'staff2@distributor.com' },
    update: {},
    create: {
      email: 'staff2@distributor.com',
      passwordHash: staffPasswordHash,
      name: 'Sarah Chen (Store Staff)',
      role: Role.STAFF,
    },
  });

  console.log('✅ Users seeded:', [manager.email, staff1.email, staff2.email]);

  // 3. Location Assignments
  // Staff 1 assigned to Main Warehouse and Northside
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: { userId: staff1.id, locationId: locMain.id },
    },
    update: {},
    create: {
      userId: staff1.id,
      locationId: locMain.id,
    },
  });

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: { userId: staff1.id, locationId: locNorth.id },
    },
    update: {},
    create: {
      userId: staff1.id,
      locationId: locNorth.id,
    },
  });

  // Staff 2 assigned to Downtown Retail Floor
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: { userId: staff2.id, locationId: locStore.id },
    },
    update: {},
    create: {
      userId: staff2.id,
      locationId: locStore.id,
    },
  });

  console.log('✅ Location assignments seeded');

  // 4. Create Initial Categories
  const categories = [
    'Electrical & Wiring',
    'Plumbing & Pipework',
    'Fasteners & Hardware',
    'Safety & PPE',
    'Tools & Accessories',
  ];

  for (const catName of categories) {
    await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName },
    });
  }

  console.log('✅ Categories seeded:', categories);
  console.log('🎉 Baseline Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
