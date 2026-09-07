import { PrismaClient, MovementType, Role, Prisma } from '@prisma/client';

const prisma = new PrismaClient({ log: [] });

// Helper query function that mirrors the GET /api/items query logic for automated DB-level testing
async function queryItemsTest(params: {
  categoryId?: string;
  locationId?: string;
  search?: string;
  archived?: 'active' | 'archived' | 'all';
  lowStockOnly?: boolean;
  sortBy?: 'name' | 'sku' | 'reorderLevel' | 'onHand' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const targetLocationId = params.locationId && params.locationId !== 'all' ? params.locationId.trim() : null;

  let balanceCte: Prisma.Sql;
  if (targetLocationId) {
    balanceCte = Prisma.sql`
      WITH stock_balances AS (
        SELECT 
          sm."itemId",
          COALESCE(SUM(CASE WHEN sm."destinationLocationId" = ${targetLocationId} THEN sm.quantity ELSE 0 END), 0) - 
          COALESCE(SUM(CASE WHEN sm."sourceLocationId" = ${targetLocationId} THEN sm.quantity ELSE 0 END), 0) AS "onHand"
        FROM stock_movements sm
        WHERE sm."destinationLocationId" = ${targetLocationId} OR sm."sourceLocationId" = ${targetLocationId}
        GROUP BY sm."itemId"
      )
    `;
  } else {
    balanceCte = Prisma.sql`
      WITH stock_balances AS (
        SELECT 
          sm."itemId",
          COALESCE(SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END), 0) - 
          COALESCE(SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END), 0) AS "onHand"
        FROM stock_movements sm
        GROUP BY sm."itemId"
      )
    `;
  }

  const whereConditions: Prisma.Sql[] = [];

  const resolvedArchived = params.archived || 'active';
  if (resolvedArchived === 'active') {
    whereConditions.push(Prisma.sql`i."isArchived" = false`);
  } else if (resolvedArchived === 'archived') {
    whereConditions.push(Prisma.sql`i."isArchived" = true`);
  }

  if (params.categoryId && params.categoryId !== 'all') {
    whereConditions.push(Prisma.sql`i."categoryId" = ${params.categoryId}`);
  }

  if (params.search && params.search.trim() !== '') {
    const q = `%${params.search.trim()}%`;
    whereConditions.push(Prisma.sql`(i.name ILIKE ${q} OR i.sku ILIKE ${q} OR COALESCE(i.description, '') ILIKE ${q})`);
  }

  if (params.lowStockOnly) {
    whereConditions.push(Prisma.sql`COALESCE(sb."onHand", 0) <= i."reorderLevel"`);
  }

  const whereClause =
    whereConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
      : Prisma.empty;

  const validSortColumns: Record<string, string> = {
    name: 'LOWER(i.name)',
    sku: 'LOWER(i.sku)',
    reorderLevel: 'i."reorderLevel"',
    onHand: 'COALESCE(sb."onHand", 0)',
    createdAt: 'i."createdAt"',
  };

  const sortCol = validSortColumns[params.sortBy || 'name'] || 'LOWER(i.name)';
  const dir = params.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const orderByClause = Prisma.raw(`ORDER BY ${sortCol} ${dir}, i.id ASC`);

  const pageNum = Math.max(1, params.page || 1);
  const limitNum = Math.max(1, params.limit || 12);
  const offset = (pageNum - 1) * limitNum;

  const [items, countResult] = await Promise.all([
    prisma.$queryRaw<any[]>(Prisma.sql`
      ${balanceCte}
      SELECT 
        i.id,
        i.sku,
        i.name,
        i.description,
        i.uom,
        i."reorderLevel",
        i."categoryId",
        i."isArchived",
        i."createdAt",
        i."updatedAt",
        json_build_object('id', c.id, 'name', c.name) AS category,
        COALESCE(sb."onHand", 0)::int AS "totalOnHand",
        (COALESCE(sb."onHand", 0) <= i."reorderLevel") AS "isLowStock"
      FROM items i
      JOIN categories c ON c.id = i."categoryId"
      LEFT JOIN stock_balances sb ON sb."itemId" = i.id
      ${whereClause}
      ${orderByClause}
      LIMIT ${limitNum} OFFSET ${offset}
    `),
    prisma.$queryRaw<[{ total: number }]>(Prisma.sql`
      ${balanceCte}
      SELECT COUNT(*)::int AS total
      FROM items i
      JOIN categories c ON c.id = i."categoryId"
      LEFT JOIN stock_balances sb ON sb."itemId" = i.id
      ${whereClause}
    `),
  ]);

  const total = countResult[0]?.total ? Number(countResult[0].total) : 0;
  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasPrevPage: pageNum > 1,
      hasNextPage: pageNum < totalPages,
    },
  };
}

async function runSprint4Tests() {
  console.log('🧪 Starting Sprint 4 Automated Verification (Server-Side Querying, Filtering & Pagination)...');

  const now = Date.now();
  let testCatId = '';
  const createdItemIds: string[] = [];

  try {
    // 1. Locate test users and locations
    const manager = await prisma.user.findUnique({ where: { email: 'manager@distributor.com' } });
    const whMain = await prisma.location.findUnique({ where: { code: 'WH-MAIN' } });
    const whNorth = await prisma.location.findUnique({ where: { code: 'WH-NORTH' } });

    if (!manager || !whMain || !whNorth) {
      throw new Error('Required test users or locations not found. Database seeding required.');
    }
    console.log('✅ Found manager user and test warehouse locations (WH-MAIN, WH-NORTH).');

    // 2. Create isolated test category
    const category = await prisma.category.create({
      data: { name: `Sprint4-Cat-${now}` },
    });
    testCatId = category.id;
    console.log(`✅ Test Category created: "${category.name}"`);

    // 3. Create 5 test items with varied stock and attributes
    // Item A: Low Stock (0 onHand, reorder 10)
    const itemA = await prisma.item.create({
      data: {
        sku: `S4-A-SKU-${now}`,
        name: `Alpha Gizmo ${now}`,
        uom: 'box',
        reorderLevel: 10,
        categoryId: category.id,
      },
    });
    createdItemIds.push(itemA.id);

    // Item B: Normal Stock (50 onHand at WH-MAIN, reorder 10)
    const itemB = await prisma.item.create({
      data: {
        sku: `S4-B-SKU-${now}`,
        name: `Beta Bracket ${now}`,
        uom: 'pieces',
        reorderLevel: 10,
        categoryId: category.id,
      },
    });
    createdItemIds.push(itemB.id);

    // Item C: Low Stock (15 onHand at WH-NORTH, reorder 20)
    const itemC = await prisma.item.create({
      data: {
        sku: `S4-C-SKU-${now}`,
        name: `Gamma Gear ${now}`,
        uom: 'pack',
        reorderLevel: 20,
        categoryId: category.id,
      },
    });
    createdItemIds.push(itemC.id);

    // Item D: High Stock (100 onHand at WH-MAIN, reorder 5)
    const itemD = await prisma.item.create({
      data: {
        sku: `S4-D-SKU-${now}`,
        name: `Delta Drive ${now}`,
        uom: 'box',
        reorderLevel: 5,
        categoryId: category.id,
      },
    });
    createdItemIds.push(itemD.id);

    // Item E: Archived Item (50 onHand, archived)
    const itemE = await prisma.item.create({
      data: {
        sku: `S4-E-SKU-${now}`,
        name: `Epsilon Engine ${now}`,
        uom: 'unit',
        reorderLevel: 10,
        categoryId: category.id,
        isArchived: true,
      },
    });
    createdItemIds.push(itemE.id);

    console.log('✅ Created 5 test catalog items with distinct SKUs, names, reorder levels, and archive states.');

    // 4. Record stock receipts to establish derived balances
    await prisma.stockMovement.createMany({
      data: [
        {
          itemId: itemB.id,
          type: MovementType.RECEIPT,
          quantity: 50,
          destinationLocationId: whMain.id,
          userId: manager.id,
        },
        {
          itemId: itemC.id,
          type: MovementType.RECEIPT,
          quantity: 15,
          destinationLocationId: whNorth.id,
          userId: manager.id,
        },
        {
          itemId: itemD.id,
          type: MovementType.RECEIPT,
          quantity: 100,
          destinationLocationId: whMain.id,
          userId: manager.id,
        },
        {
          itemId: itemE.id,
          type: MovementType.RECEIPT,
          quantity: 50,
          destinationLocationId: whMain.id,
          userId: manager.id,
        },
      ],
    });
    console.log('✅ Recorded stock receipts into WH-MAIN and WH-NORTH to establish ledger balances.');

    // -------------------------------------------------------------
    // TEST 1: Category Filter & Active Status Default
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Category Filtering & Active Status ---');
    const catResult = await queryItemsTest({ categoryId: testCatId, archived: 'active' });
    if (catResult.pagination.total !== 4) {
      throw new Error(`Expected 4 active items in test category, got ${catResult.pagination.total}`);
    }
    const hasArchived = catResult.items.some((i) => i.isArchived);
    if (hasArchived) {
      throw new Error('Archived item unexpectedly returned under archived=active');
    }
    console.log(`✅ Category filter verified: Exactly 4 active items returned (Item E excluded).`);

    // -------------------------------------------------------------
    // TEST 2: Archived Status Filter
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Archived Status Filter ---');
    const archivedResult = await queryItemsTest({ categoryId: testCatId, archived: 'archived' });
    if (archivedResult.pagination.total !== 1 || archivedResult.items[0].sku !== itemE.sku) {
      throw new Error(`Expected exactly 1 archived item (Item E), got ${archivedResult.pagination.total}`);
    }

    const allResult = await queryItemsTest({ categoryId: testCatId, archived: 'all' });
    if (allResult.pagination.total !== 5) {
      throw new Error(`Expected 5 total items under archived=all, got ${allResult.pagination.total}`);
    }
    console.log('✅ Archive filter verified: Active (4), Archived (1), All (5) exact matches.');

    // -------------------------------------------------------------
    // TEST 3: Text Search (SKU & Name case-insensitive)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Text Search over SKU and Name ---');
    // Search by partial SKU (lowercase)
    const skuSearch = await queryItemsTest({ categoryId: testCatId, search: `s4-b-sku` });
    if (skuSearch.pagination.total !== 1 || skuSearch.items[0].sku !== itemB.sku) {
      throw new Error(`Search by SKU failed: expected Item B, got ${skuSearch.pagination.total} results`);
    }

    // Search by partial Name
    const nameSearch = await queryItemsTest({ categoryId: testCatId, search: 'bracket' });
    if (nameSearch.pagination.total !== 1 || nameSearch.items[0].sku !== itemB.sku) {
      throw new Error(`Search by Name failed: expected Item B, got ${nameSearch.pagination.total} results`);
    }
    console.log('✅ Server-side text search verified: Partial case-insensitive matches on SKU and Name work accurately.');

    // -------------------------------------------------------------
    // TEST 4: Location-Scoped Stock Derivation
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Location-Scoped Stock Derivation ---');
    // Query scoped to WH-MAIN
    const whMainQuery = await queryItemsTest({ categoryId: testCatId, locationId: whMain.id });
    const bInMain = whMainQuery.items.find((i) => i.id === itemB.id);
    const cInMain = whMainQuery.items.find((i) => i.id === itemC.id);
    if (!bInMain || bInMain.totalOnHand !== 50) {
      throw new Error(`Expected Item B to have 50 on-hand at WH-MAIN, got ${bInMain?.totalOnHand}`);
    }
    if (!cInMain || cInMain.totalOnHand !== 0) {
      throw new Error(`Expected Item C to have 0 on-hand at WH-MAIN, got ${cInMain?.totalOnHand}`);
    }

    // Query scoped to WH-NORTH
    const whNorthQuery = await queryItemsTest({ categoryId: testCatId, locationId: whNorth.id });
    const cInNorth = whNorthQuery.items.find((i) => i.id === itemC.id);
    const bInNorth = whNorthQuery.items.find((i) => i.id === itemB.id);
    if (!cInNorth || cInNorth.totalOnHand !== 15) {
      throw new Error(`Expected Item C to have 15 on-hand at WH-NORTH, got ${cInNorth?.totalOnHand}`);
    }
    if (!bInNorth || bInNorth.totalOnHand !== 0) {
      throw new Error(`Expected Item B to have 0 on-hand at WH-NORTH, got ${bInNorth?.totalOnHand}`);
    }
    console.log('✅ Location filter verified: On-hand balances dynamically scoped to WH-MAIN and WH-NORTH accurately.');

    // -------------------------------------------------------------
    // TEST 5: Low-Stock Filter (onHand <= reorderLevel)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Low-Stock Filter ---');
    // Item A: onHand=0, reorder=10 -> LOW STOCK (0 <= 10)
    // Item B: onHand=50, reorder=10 -> OK (50 > 10)
    // Item C: onHand=15, reorder=20 -> LOW STOCK (15 <= 20)
    // Item D: onHand=100, reorder=5 -> OK (100 > 5)
    const lowStockQuery = await queryItemsTest({ categoryId: testCatId, lowStockOnly: true });
    if (lowStockQuery.pagination.total !== 2) {
      throw new Error(`Expected 2 low-stock items (Item A and Item C), got ${lowStockQuery.pagination.total}`);
    }
    const lowStockSkus = lowStockQuery.items.map((i) => i.sku).sort();
    const expectedSkus = [itemA.sku, itemC.sku].sort();
    if (JSON.stringify(lowStockSkus) !== JSON.stringify(expectedSkus)) {
      throw new Error(`Low-stock SKUs mismatch: expected ${expectedSkus.join(',')}, got ${lowStockSkus.join(',')}`);
    }
    console.log(`✅ Low-stock filter verified: Exactly Item A (0/10) and Item C (15/20) flagged as low stock.`);

    // -------------------------------------------------------------
    // TEST 6: Server-Side Sorting by Derived onHand
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Server-Side Sorting by Derived On-Hand Stock ---');
    // Sort onHand ASC (0 -> 15 -> 50 -> 100)
    const sortAsc = await queryItemsTest({ categoryId: testCatId, sortBy: 'onHand', sortOrder: 'asc' });
    const ascOnHand = sortAsc.items.map((i) => i.totalOnHand);
    if (JSON.stringify(ascOnHand) !== JSON.stringify([0, 15, 50, 100])) {
      throw new Error(`Expected onHand ASC [0, 15, 50, 100], got [${ascOnHand.join(', ')}]`);
    }

    // Sort onHand DESC (100 -> 50 -> 15 -> 0)
    const sortDesc = await queryItemsTest({ categoryId: testCatId, sortBy: 'onHand', sortOrder: 'desc' });
    const descOnHand = sortDesc.items.map((i) => i.totalOnHand);
    if (JSON.stringify(descOnHand) !== JSON.stringify([100, 50, 15, 0])) {
      throw new Error(`Expected onHand DESC [100, 50, 15, 0], got [${descOnHand.join(', ')}]`);
    }
    console.log('✅ Server-side derived on-hand sorting verified: ASC and DESC order perfectly respected.');

    // -------------------------------------------------------------
    // TEST 7: Server-Side Pagination
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Server-Side Pagination Limits and Offsets ---');
    // 4 active items with limit=2
    const page1 = await queryItemsTest({ categoryId: testCatId, sortBy: 'name', sortOrder: 'asc', page: 1, limit: 2 });
    if (page1.items.length !== 2 || page1.pagination.total !== 4 || page1.pagination.totalPages !== 2) {
      throw new Error(`Page 1 pagination metadata incorrect: ${JSON.stringify(page1.pagination)}`);
    }
    if (!page1.pagination.hasNextPage || page1.pagination.hasPrevPage) {
      throw new Error(`Page 1 flags incorrect: hasNext=${page1.pagination.hasNextPage}, hasPrev=${page1.pagination.hasPrevPage}`);
    }

    const page2 = await queryItemsTest({ categoryId: testCatId, sortBy: 'name', sortOrder: 'asc', page: 2, limit: 2 });
    if (page2.items.length !== 2 || page2.pagination.page !== 2) {
      throw new Error(`Page 2 pagination metadata incorrect: ${JSON.stringify(page2.pagination)}`);
    }
    if (page2.pagination.hasNextPage || !page2.pagination.hasPrevPage) {
      throw new Error(`Page 2 flags incorrect: hasNext=${page2.pagination.hasNextPage}, hasPrev=${page2.pagination.hasPrevPage}`);
    }

    // Ensure Page 1 and Page 2 contain mutually disjoint items
    const page1Ids = new Set(page1.items.map((i) => i.id));
    const page2Ids = new Set(page2.items.map((i) => i.id));
    const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
    if (intersection.length > 0) {
      throw new Error(`Pagination overlap detected between Page 1 and Page 2: ${intersection.join(', ')}`);
    }
    console.log('✅ Server-side pagination verified: Page 1 and 2 return exact disjoint sets with accurate metadata.');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Cleanup ---');
    await prisma.stockMovement.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: createdItemIds } },
    });
    await prisma.category.delete({
      where: { id: testCatId },
    });
    console.log('✅ Test movements, items, and category cleanly dismantled.');

    console.log('\n🎉 ALL SPRINT 4 TESTS PASSED! Server-side search, multi-criteria filtering, derived on-hand sorting, and pagination are 100% verified.');
  } catch (err) {
    console.error('❌ SPRINT 4 TEST FAILED:', err);
    // Cleanup if possible
    try {
      if (createdItemIds.length > 0) {
        await prisma.stockMovement.deleteMany({ where: { itemId: { in: createdItemIds } } });
        await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
      }
      if (testCatId) {
        await prisma.category.delete({ where: { id: testCatId } });
      }
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSprint4Tests();
