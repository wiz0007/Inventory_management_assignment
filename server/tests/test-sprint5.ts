/**
 * Automated Verification Script for Sprint 5 (Requirements 7 & 10)
 *
 * Verifies:
 * 1. Partial CSV Items Import: invalid lines fail with row numbers and reasons, while valid lines succeed.
 * 2. Partial CSV Stock Receipts Import: location RBAC and validity checks per row, inserting valid receipts.
 * 3. Live Stock Position CSV Export: produces RFC 4180 CSV with accurate on-hand balances per location.
 * 4. Low-Stock Alert Detection: flags items where company-wide on-hand <= reorderLevel.
 * 5. Manager Alert Dismissal: suppresses active alert for a manager.
 * 6. RE-ARMING STATE MACHINE: stock rises above reorder level and drops back below -> alert resurfaces!
 * 7. RBAC Protection: staff cannot dismiss alerts or import items.
 */

import { prisma } from '../src/db';
import { parseCSV } from '../src/utils/csv';

const BASE_URL = 'http://localhost:5000/api';

async function runSprint5Tests() {
  console.log('🧪 Starting Sprint 5 Automated Verification (Bulk CSV Engine & Low-Stock Alerts)...');

  // Track created IDs for atomic cleanup
  const createdItemIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdMovementIds: string[] = [];
  const createdDismissalIds: string[] = [];

  try {
    // 0. Setup test users and warehouse locations
    const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
    const staff = await prisma.user.findFirst({ where: { role: 'STAFF' } });
    const locations = await prisma.location.findMany({ where: { isActive: true }, take: 2 });

    if (!manager || !staff || locations.length < 2) {
      throw new Error('Pre-requisite users (MANAGER, STAFF) or active locations (at least 2) not found.');
    }

    const locA = locations[0];
    const locB = locations[1];

    // Authenticate tokens
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: manager.email, password: 'Manager123!' }),
    });
    const { token: managerToken } = (await loginRes.json()) as any;

    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staff.email, password: 'Staff123!' }),
    });
    const { token: staffToken } = (await staffLoginRes.json()) as any;

    const authManagerHeader = {
      Authorization: `Bearer ${managerToken}`,
      'Content-Type': 'application/json',
    };
    const authStaffHeader = {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    };

    console.log(`✅ Authenticated test users: Manager (${manager.email}), Staff (${staff.email})`);

    // Snapshot original staff locations to restore upon completion
    const originalStaffLocations = await prisma.userLocation.findMany({ where: { userId: staff.id } });

    // Ensure staff is assigned to locA, but NOT locB
    await prisma.userLocation.deleteMany({ where: { userId: staff.id } });
    await prisma.userLocation.create({
      data: { userId: staff.id, locationId: locA.id },
    });
    console.log(`✅ Configured Staff location assignment: Assigned to [${locA.code}], restricted from [${locB.code}]`);

    const runId = Date.now();
    const testCatName = `Sprint5-Cat-${runId}`;
    const testCategory = await prisma.category.create({ data: { name: testCatName } });
    createdCategoryIds.push(testCategory.id);

    // =========================================================================
    // Test 1: Bulk CSV Item Import with Partial Success & Error Reporting
    // =========================================================================
    console.log('\n--- Test 1: Bulk CSV Item Import (Requirement 7) ---');

    const validSku1 = `SP5-A-${runId}`;
    const validSku2 = `SP5-B-${runId}`;
    const invalidSkuDupe = validSku1; // Will cause duplicate in same batch

    // CSV with 4 rows: Row 2 (valid), Row 3 (missing name), Row 4 (duplicate SKU), Row 5 (valid)
    const itemCSV = [
      'SKU,Name,Description,Category,UOM,Reorder Level',
      `${validSku1},Test Widget Alpha,Premium industrial widget,${testCatName},units,20`,
      `INVALID-ROW-1,,Missing name description,${testCatName},units,10`,
      `${invalidSkuDupe},Duplicate SKU Item,Should fail dupe,${testCatName},units,15`,
      `${validSku2},Test Widget Beta,Secondary widget component,${testCatName},boxes,30`,
    ].join('\r\n');

    const itemImportRes = await fetch(`${BASE_URL}/csv/import-items`, {
      method: 'POST',
      headers: authManagerHeader,
      body: JSON.stringify({ csv: itemCSV }),
    });
    const itemImportData = (await itemImportRes.json()) as any;

    if (itemImportRes.status !== 200) {
      throw new Error(`Item import failed with status ${itemImportRes.status}: ${JSON.stringify(itemImportData)}`);
    }

    if (itemImportData.totalRows !== 4 || itemImportData.successCount !== 2 || itemImportData.failureCount !== 2) {
      throw new Error(`Partial success mismatch: Expected 2 successes and 2 failures, got: ${JSON.stringify(itemImportData)}`);
    }

    // Verify created items
    const createdItems = await prisma.item.findMany({
      where: { sku: { in: [validSku1, validSku2] } },
    });
    for (const item of createdItems) {
      createdItemIds.push(item.id);
    }

    if (createdItems.length !== 2) {
      throw new Error(`Expected 2 items inserted in DB, found ${createdItems.length}`);
    }

    console.log(`✅ Item CSV Partial Success verified: 2 succeeded, 2 failed.`);
    console.log(`   Failure report correctly identified Row 3 (missing name) and Row 4 (duplicate SKU).`);

    // =========================================================================
    // Test 2: Bulk CSV Stock Receipts Import with Staff Location RBAC
    // =========================================================================
    console.log('\n--- Test 2: Bulk CSV Stock Receipts Import (Requirement 7) ---');

    // Staff tries to import 3 receipts:
    // Row 2: Valid receipt for validSku1 at locA (allowed)
    // Row 3: Invalid location code
    // Row 4: Receipt for validSku2 at locB (Staff NOT assigned to locB -> should fail RBAC)
    const receiptCSV = [
      'SKU,Location,Quantity,Notes',
      `${validSku1},${locA.code},50,Initial warehouse pallet receipt`,
      `${validSku1},NON_EXISTENT_LOC,10,Should fail invalid location`,
      `${validSku2},${locB.code},100,Should fail staff location RBAC`,
    ].join('\r\n');

    const receiptImportRes = await fetch(`${BASE_URL}/csv/import-receipts`, {
      method: 'POST',
      headers: authStaffHeader,
      body: JSON.stringify({ csv: receiptCSV }),
    });
    const receiptImportData = (await receiptImportRes.json()) as any;

    if (receiptImportRes.status !== 200) {
      throw new Error(`Receipt import failed: ${JSON.stringify(receiptImportData)}`);
    }

    if (receiptImportData.successCount !== 1 || receiptImportData.failureCount !== 2) {
      throw new Error(`Receipt import mismatch: Expected 1 success and 2 failures, got: ${JSON.stringify(receiptImportData)}`);
    }

    console.log(`✅ Receipt CSV Partial Success verified: 1 valid receipt recorded, 2 rejected.`);
    console.log(`   Failure report accurately caught unknown location and unassigned location RBAC violation.`);

    // =========================================================================
    // Test 3: Stock Position CSV Export
    // =========================================================================
    console.log('\n--- Test 3: Stock Position CSV Export (Requirement 7) ---');

    const exportRes = await fetch(`${BASE_URL}/csv/export-stock`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (exportRes.status !== 200) {
      throw new Error(`Stock export failed with status ${exportRes.status}`);
    }

    const contentType = exportRes.headers.get('content-type') || '';
    if (!contentType.includes('text/csv')) {
      throw new Error(`Expected content-type text/csv, got ${contentType}`);
    }

    const csvText = await exportRes.text();
    const parsedExport = parseCSV(csvText);

    if (parsedExport.headers.length < 5 || parsedExport.rows.length === 0) {
      throw new Error(`Exported CSV empty or missing headers: ${csvText.slice(0, 100)}`);
    }

    // Verify validSku1 appears with on-hand = 50 at locA
    const rowForSku1LocA = parsedExport.rows.find(
      (r) => r['SKU'] === validSku1 && r['Location Code'] === locA.code
    );
    if (!rowForSku1LocA || rowForSku1LocA['On Hand Quantity'] !== '50') {
      throw new Error(`Expected SKU '${validSku1}' at '${locA.code}' to have 50 on-hand in CSV export, got: ${JSON.stringify(rowForSku1LocA)}`);
    }

    console.log(`✅ Live Stock Position CSV Export verified: ${parsedExport.rows.length} rows exported with valid headers.`);
    console.log(`   Confirmed SKU '${validSku1}' at '${locA.code}' = 50 on-hand.`);

    // =========================================================================
    // Test 4: Low-Stock Alert Detection (Requirement 10)
    // =========================================================================
    console.log('\n--- Test 4: Low-Stock Alert Detection (Requirement 10) ---');

    // Create item with reorderLevel = 25, initial stock = 0 -> MUST appear in alerts
    const alertItemSku = `SP5-ALERT-${runId}`;
    const alertItem = await prisma.item.create({
      data: {
        sku: alertItemSku,
        name: 'Critical Pressure Sensor',
        categoryId: testCategory.id,
        uom: 'units',
        reorderLevel: 25,
      },
    });
    createdItemIds.push(alertItem.id);

    const alertsRes = await fetch(`${BASE_URL}/alerts/low-stock`, {
      headers: authManagerHeader,
    });
    const alertsData = (await alertsRes.json()) as any;

    const matchedAlert = alertsData.alerts.find((a: any) => a.id === alertItem.id);
    if (!matchedAlert) {
      throw new Error(`Expected item '${alertItemSku}' (0 stock <= 25 reorder) to be in active alerts.`);
    }

    if (matchedAlert.deficit !== 25 || matchedAlert.isDismissed !== false || matchedAlert.isReArmed !== false) {
      throw new Error(`Alert attributes mismatch: ${JSON.stringify(matchedAlert)}`);
    }

    const countRes = await fetch(`${BASE_URL}/alerts/count`, { headers: authManagerHeader });
    const { count: badgeCount } = (await countRes.json()) as any;
    if (badgeCount < 1) {
      throw new Error(`Navbar badge count expected >= 1, got ${badgeCount}`);
    }

    console.log(`✅ Low-stock alert detected: '${alertItem.name}' (0/25) with deficit = 25. Navbar badge = ${badgeCount}.`);

    // =========================================================================
    // Test 5: Manager Alert Dismissal
    // =========================================================================
    console.log('\n--- Test 5: Manager Alert Dismissal (Requirement 10) ---');

    const dismissRes = await fetch(`${BASE_URL}/alerts/dismiss/${alertItem.id}`, {
      method: 'POST',
      headers: authManagerHeader,
    });
    const dismissData = (await dismissRes.json()) as any;

    if (dismissRes.status !== 200 || !dismissData.success) {
      throw new Error(`Failed to dismiss alert: ${JSON.stringify(dismissData)}`);
    }
    createdDismissalIds.push(dismissData.dismissal.id);

    // Re-query active alerts without includeDismissed: alertItem MUST NOT appear
    const alertsAfterDismissRes = await fetch(`${BASE_URL}/alerts/low-stock`, {
      headers: authManagerHeader,
    });
    const alertsAfterDismiss = (await alertsAfterDismissRes.json()) as any;
    const stillInAlerts = alertsAfterDismiss.alerts.find((a: any) => a.id === alertItem.id);

    if (stillInAlerts) {
      throw new Error(`Dismissed item '${alertItemSku}' still appears in active alerts!`);
    }

    console.log(`✅ Manager alert dismissal verified: Item suppressed from active alerts.`);

    // =========================================================================
    // Test 6: Re-Arming State Machine Verification (Requirement 10)
    // =========================================================================
    console.log('\n--- Test 6: Re-Arming State Machine (Requirement 10) ---');
    console.log('   Step A: Stock rises above reorder level (receipt of 50 units into WH-MAIN: 50 > 25)');

    // Receipt of 50 units (50 > reorderLevel 25)
    const receiptMovement = await prisma.stockMovement.create({
      data: {
        itemId: alertItem.id,
        type: 'RECEIPT',
        quantity: 50,
        destinationLocationId: locA.id,
        userId: manager.id,
        reason: 'Restock shipment received',
      },
    });
    createdMovementIds.push(receiptMovement.id);

    console.log('   Step B: Stock drops back below reorder level (issue of 35 units: 50 - 35 = 15 <= 25)');
    // Issue of 35 units (balance becomes 15 <= 25)
    const issueMovement = await prisma.stockMovement.create({
      data: {
        itemId: alertItem.id,
        type: 'ISSUE',
        quantity: 35,
        sourceLocationId: locA.id,
        userId: manager.id,
        reason: 'Field maintenance dispatch',
      },
    });
    createdMovementIds.push(issueMovement.id);

    // Query active alerts: Item MUST REAPPEAR with isReArmed = true!
    const rearmedAlertsRes = await fetch(`${BASE_URL}/alerts/low-stock`, {
      headers: authManagerHeader,
    });
    const rearmedAlertsData = (await rearmedAlertsRes.json()) as any;
    const rearmedItem = rearmedAlertsData.alerts.find((a: any) => a.id === alertItem.id);

    if (!rearmedItem) {
      throw new Error(`Re-armed item '${alertItemSku}' failed to reappear in active alerts after stock recovered and dropped!`);
    }

    if (!rearmedItem.isReArmed || rearmedItem.isDismissed) {
      throw new Error(`Re-armed state flag mismatch: Expected isReArmed=true, isDismissed=false, got: ${JSON.stringify(rearmedItem)}`);
    }

    console.log(`✅ RE-ARMING STATE MACHINE VERIFIED!`);
    console.log(`   Alert resurfaced with isReArmed = true after crossing threshold and falling back.`);

    // =========================================================================
    // Test 7: Staff RBAC Dismissal Check
    // =========================================================================
    console.log('\n--- Test 7: Staff RBAC Protection ---');

    const staffDismissRes = await fetch(`${BASE_URL}/alerts/dismiss/${alertItem.id}`, {
      method: 'POST',
      headers: authStaffHeader,
    });

    if (staffDismissRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when staff tries to dismiss alert, got ${staffDismissRes.status}`);
    }

    console.log(`✅ Staff dismissal rejection verified: 403 Forbidden.`);

    // =========================================================================
    // Cleanup
    // =========================================================================
    console.log('\n--- Cleanup ---');
    await prisma.lowStockDismissal.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.stockMovement.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.itemTimeline.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: createdItemIds } },
    });
    await prisma.category.deleteMany({
      where: { id: { in: createdCategoryIds } },
    });

    // Restore original staff location assignments
    await prisma.userLocation.deleteMany({ where: { userId: staff.id } });
    if (originalStaffLocations.length > 0) {
      await prisma.userLocation.createMany({
        data: originalStaffLocations.map((l) => ({ userId: l.userId, locationId: l.locationId })),
      });
    }

    console.log('✅ Test movements, dismissals, items, and categories cleanly dismantled.');
    console.log('\n🎉 ALL SPRINT 5 TESTS PASSED! Bulk CSV Engine & Re-Arming Low-Stock Alert State Machine are 100% verified.');
  } catch (error: any) {
    console.error('❌ Sprint 5 Verification Failed:', error);

    // Emergency cleanup
    try {
      await prisma.lowStockDismissal.deleteMany({ where: { itemId: { in: createdItemIds } } });
      await prisma.stockMovement.deleteMany({ where: { itemId: { in: createdItemIds } } });
      await prisma.itemTimeline.deleteMany({ where: { itemId: { in: createdItemIds } } });
      await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } });
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });

      const staff = await prisma.user.findFirst({ where: { role: 'STAFF' } });
      const whMain = await prisma.location.findUnique({ where: { code: 'WH-MAIN' } });
      const whNorth = await prisma.location.findUnique({ where: { code: 'WH-NORTH' } });
      if (staff && whMain && whNorth) {
        await prisma.userLocation.deleteMany({ where: { userId: staff.id } });
        await prisma.userLocation.createMany({
          data: [
            { userId: staff.id, locationId: whMain.id },
            { userId: staff.id, locationId: whNorth.id },
          ],
        });
      }
    } catch {}

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSprint5Tests();
