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

  // 5. Seed Realistic Catalog Items across Categories
  const catMap = new Map<string, string>();
  const dbCats = await prisma.category.findMany();
  for (const c of dbCats) {
    catMap.set(c.name, c.id);
  }

  const sampleItemsData = [
    // Electrical & Wiring
    {
      sku: 'ELEC-CBL-001',
      name: 'Industrial Heavy Duty Copper Cable 50m',
      description: 'Standard 3-core high-conductivity insulated electrical copper wiring spool for commercial installation.',
      category: 'Electrical & Wiring',
      uom: 'spools',
      reorderLevel: 20,
      initialStock: { [locMain.id]: 45, [locNorth.id]: 15 }, // Total: 60 (Healthy)
    },
    {
      sku: 'ELEC-SWT-002',
      name: 'Double Pole Safety Breaker Switch 32A',
      description: 'Din-rail mountable thermal-magnetic circuit breaker for overload protection.',
      category: 'Electrical & Wiring',
      uom: 'units',
      reorderLevel: 15,
      initialStock: {}, // Total: 0 (Critical Deficit alert!)
    },
    {
      sku: 'ELEC-CON-003',
      name: 'Rigid PVC Conduit Pipe 3m (Pack of 10)',
      description: 'Heavy gauge non-metallic impact-resistant conduit for cable management.',
      category: 'Electrical & Wiring',
      uom: 'bundles',
      reorderLevel: 25,
      initialStock: { [locMain.id]: 12 }, // Total: 12 (Low Stock alert!)
    },

    // Plumbing & Pipework
    {
      sku: 'PLUMB-VLV-101',
      name: 'Lead-Free Brass Ball Valve 1/2"',
      description: 'Full-port quarter-turn forged brass water shutoff valve with vinyl grip handle.',
      category: 'Plumbing & Pipework',
      uom: 'units',
      reorderLevel: 30,
      initialStock: { [locMain.id]: 10, [locStore.id]: 5 }, // Total: 15 (Low Stock alert!)
    },
    {
      sku: 'PLUMB-PIP-102',
      name: 'Copper Compression Elbow Fitting 15mm',
      description: 'Precision machined dezincification-resistant plumbing elbow coupling.',
      category: 'Plumbing & Pipework',
      uom: 'boxes',
      reorderLevel: 35,
      initialStock: { [locMain.id]: 50, [locStore.id]: 20 }, // Total: 70 (Healthy)
    },
    {
      sku: 'PLUMB-DRN-103',
      name: 'Flexible Waste Water Drainage Trap P-Trap',
      description: 'Polypropylene tubular adjustable P-trap with slip-joint connections.',
      category: 'Plumbing & Pipework',
      uom: 'units',
      reorderLevel: 12,
      initialStock: { [locStore.id]: 18 }, // Total: 18 (Healthy)
    },

    // Fasteners & Hardware
    {
      sku: 'FAST-SCR-201',
      name: 'Stainless Steel Deck Screws #8 x 2-1/2" (500ct)',
      description: 'Marine-grade 316 stainless steel torx drive self-tapping wood screws.',
      category: 'Fasteners & Hardware',
      uom: 'boxes',
      reorderLevel: 40,
      initialStock: { [locMain.id]: 85, [locNorth.id]: 25 }, // Total: 110 (Healthy)
    },
    {
      sku: 'FAST-BLT-202',
      name: 'Grade 8 High Tensile Hex Bolts M10 x 50mm (100ct)',
      description: 'Alloy steel zinc-yellow plated heavy structural bolts with matching hex nuts.',
      category: 'Fasteners & Hardware',
      uom: 'boxes',
      reorderLevel: 25,
      initialStock: { [locMain.id]: 8 }, // Total: 8 (Low Stock alert!)
    },
    {
      sku: 'FAST-ANC-203',
      name: 'Heavy Duty Sleeve Anchors 3/8" x 3"',
      description: 'Zinc-plated concrete and masonry expansion anchors for high load applications.',
      category: 'Fasteners & Hardware',
      uom: 'packs',
      reorderLevel: 30,
      initialStock: { [locMain.id]: 30, [locStore.id]: 15 }, // Total: 45 (Healthy)
    },

    // Safety & PPE
    {
      sku: 'SAFE-GLV-301',
      name: 'Heavy Duty Nitrile Chemical Grip Gloves (Box of 100)',
      description: 'Latex-free 6mil textured industrial gloves for chemical and abrasion resistance.',
      category: 'Safety & PPE',
      uom: 'boxes',
      reorderLevel: 50,
      initialStock: { [locMain.id]: 120, [locNorth.id]: 40 }, // Total: 160 (Healthy)
    },
    {
      sku: 'SAFE-HLM-302',
      name: 'Vented Full-Brim Construction Safety Hard Hat',
      description: 'ANSI Z89.1 Type 1 Class C compliant helmet with 6-point ratchet suspension.',
      category: 'Safety & PPE',
      uom: 'units',
      reorderLevel: 20,
      initialStock: { [locMain.id]: 6 }, // Total: 6 (Low Stock alert - Dismissed by Manager demo!)
    },
    {
      sku: 'SAFE-GLS-303',
      name: 'Anti-Fog Scratch-Resistant UV Safety Goggles',
      description: 'Wide-vision wraparound polycarbonate protective eyewear with soft seal gasket.',
      category: 'Safety & PPE',
      uom: 'units',
      reorderLevel: 25,
      initialStock: { [locMain.id]: 40, [locStore.id]: 15 }, // Total: 55 (Healthy)
    },

    // Tools & Accessories
    {
      sku: 'TOOL-DRL-401',
      name: '18V Cordless Brushless Compact Hammer Drill Kit',
      description: 'High torque dual-speed industrial hammer drill with two 4.0Ah Li-ion batteries and charger.',
      category: 'Tools & Accessories',
      uom: 'kits',
      reorderLevel: 10,
      initialStock: { [locMain.id]: 22, [locStore.id]: 8 }, // Total: 30 (Healthy)
    },
    {
      sku: 'TOOL-WRC-402',
      name: 'Metric Combination Ratcheting Wrench Set 12-Piece',
      description: 'Chrome vanadium 72-tooth reversible ratcheting box end wrench set (8mm to 19mm).',
      category: 'Tools & Accessories',
      uom: 'sets',
      reorderLevel: 15,
      initialStock: { [locMain.id]: 5 }, // Total: 5 (Low Stock alert - Re-armed State Machine demo!)
    },
    {
      sku: 'TOOL-TAP-403',
      name: 'Heavy Duty Steel Measuring Tape 8m / 26ft',
      description: 'Impact-absorbing rubber overmold casing with nylon-coated blade and magnetic dual hook.',
      category: 'Tools & Accessories',
      uom: 'units',
      reorderLevel: 30,
      initialStock: { [locMain.id]: 45, [locStore.id]: 25 }, // Total: 70 (Healthy)
    },
    // Archived Item Sample
    {
      sku: 'DISC-OLD-999',
      name: 'Legacy Halogen Floodlight Fixture 500W (Discontinued)',
      description: 'Superseded incandescent outdoor lighting fixture. Replaced by modern LED modules.',
      category: 'Electrical & Wiring',
      uom: 'units',
      reorderLevel: 5,
      isArchived: true,
      initialStock: { [locNorth.id]: 3 }, // Total: 3 (Archived test item)
    },
  ];

  console.log('📦 Seeding sample catalog items and ledger movements...');

  for (const itemDef of sampleItemsData) {
    const catId = catMap.get(itemDef.category);
    if (!catId) continue;

    const item = await prisma.item.upsert({
      where: { sku: itemDef.sku },
      update: {
        name: itemDef.name,
        description: itemDef.description,
        uom: itemDef.uom,
        reorderLevel: itemDef.reorderLevel,
        categoryId: catId,
        isArchived: !!itemDef.isArchived,
      },
      create: {
        sku: itemDef.sku,
        name: itemDef.name,
        description: itemDef.description,
        uom: itemDef.uom,
        reorderLevel: itemDef.reorderLevel,
        categoryId: catId,
        isArchived: !!itemDef.isArchived,
      },
    });

    // Ensure CREATED timeline event
    const existingTimeline = await prisma.itemTimeline.findFirst({
      where: { itemId: item.id, eventType: 'CREATED' },
    });
    if (!existingTimeline) {
      await prisma.itemTimeline.create({
        data: {
          itemId: item.id,
          userId: manager.id,
          eventType: 'CREATED',
          noteText: `Item initialized into ${itemDef.category} with SKU ${item.sku}.`,
        },
      });
    }

    // Seed stock movements if none exist for this item
    const existingMovements = await prisma.stockMovement.count({
      where: { itemId: item.id },
    });

    if (existingMovements === 0 && itemDef.initialStock) {
      for (const [locId, qty] of Object.entries(itemDef.initialStock)) {
        if (qty > 0) {
          await prisma.stockMovement.create({
            data: {
              itemId: item.id,
              type: 'RECEIPT',
              quantity: qty,
              destinationLocationId: locId,
              userId: manager.id,
              reason: 'Initial baseline shipment ingest',
            },
          });
        }
      }
    }

    // Demo Scenario A: Pre-dismissed alert for SAFE-HLM-302 (shows in "Dismissed by Manager" tab)
    if (itemDef.sku === 'SAFE-HLM-302') {
      await prisma.lowStockDismissal.deleteMany({ where: { itemId: item.id } });
      await prisma.lowStockDismissal.create({
        data: {
          itemId: item.id,
          dismissedBy: manager.id,
          quantityAtDismissal: 6,
          dismissedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        },
      });
    }

    // Demo Scenario B: Re-armed alert for TOOL-WRC-402 (shows with RE-ARMED badge!)
    // Dismissed at qty=5 -> later received 20 (balance=25 > 15) -> later issued 20 (balance=5 <= 15)
    if (itemDef.sku === 'TOOL-WRC-402') {
      await prisma.lowStockDismissal.deleteMany({ where: { itemId: item.id } });
      await prisma.lowStockDismissal.create({
        data: {
          itemId: item.id,
          dismissedBy: manager.id,
          quantityAtDismissal: 5,
          dismissedAt: new Date(Date.now() - 3600000 * 4), // 4 hours ago
        },
      });

      // Receipt 2 hours ago: +20
      await prisma.stockMovement.create({
        data: {
          itemId: item.id,
          type: 'RECEIPT',
          quantity: 20,
          destinationLocationId: locMain.id,
          userId: manager.id,
          reason: 'Emergency restock shipment from ToolCorp',
          createdAt: new Date(Date.now() - 3600000 * 2),
        },
      });

      // Issue 1 hour ago: -20
      await prisma.stockMovement.create({
        data: {
          itemId: item.id,
          type: 'ISSUE',
          quantity: 20,
          sourceLocationId: locMain.id,
          userId: manager.id,
          reason: 'Dispatched to industrial contractor order #9021',
          createdAt: new Date(Date.now() - 3600000 * 1),
        },
      });
    }
  }

  console.log(`✅ Seeded ${sampleItemsData.length} catalog items with realistic stock positions and alert states!`);
  console.log('🎉 Baseline & Sample Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
