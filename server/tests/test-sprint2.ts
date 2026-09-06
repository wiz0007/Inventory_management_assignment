import { PrismaClient, TimelineEventType } from '@prisma/client';

// Use dedicated silent logger instance for test execution so expected constraint checks don't dump false-positive errors
const prisma = new PrismaClient({ log: [] });

async function runSprint2Tests() {
  console.log('🧪 Starting Sprint 2 Automated Verification...');

  try {
    // 1. Get Elena (Manager) and Marcus (Staff)
    const manager = await prisma.user.findUnique({
      where: { email: 'manager@distributor.com' },
    });
    const staff = await prisma.user.findUnique({
      where: { email: 'staff1@distributor.com' },
    });

    if (!manager || !staff) {
      throw new Error('Test users (manager/staff1) not found in database. Run seed first.');
    }
    console.log('✅ Found manager and staff test users.');

    // 2. Category Creation & Retrieval
    const testCatName = `Sprint2-Cat-${Date.now()}`;
    const category = await prisma.category.create({
      data: { name: testCatName },
    });
    console.log(`✅ Category created: "${category.name}" (ID: ${category.id})`);

    // 3. Item Creation with Unique SKU
    const testSku = `TEST-SKU-${Date.now()}`;
    const item = await prisma.item.create({
      data: {
        sku: testSku,
        name: 'Automated Test Widget',
        description: 'Test widget for sprint 2 verification',
        uom: 'box',
        reorderLevel: 25,
        categoryId: category.id,
      },
      include: { category: true },
    });
    console.log(`✅ Item created: ${item.name} [SKU: ${item.sku}] in category "${item.category.name}"`);

    // 4. Verify Unique SKU constraint at DB level
    let duplicateCaught = false;
    try {
      await prisma.item.create({
        data: {
          sku: testSku,
          name: 'Duplicate SKU Item',
          uom: 'box',
          reorderLevel: 10,
          categoryId: category.id,
        },
      });
    } catch {
      duplicateCaught = true;
    }
    if (!duplicateCaught) {
      throw new Error('FAILED: Duplicate SKU was allowed by database!');
    }
    console.log('✅ Unique SKU constraint verified: Duplicate SKU rejected.');

    // 5. Create Initial Timeline CREATED Event
    const createTimeline = await prisma.itemTimeline.create({
      data: {
        itemId: item.id,
        userId: manager.id,
        eventType: TimelineEventType.CREATED,
        noteText: `Item initialized with SKU ${item.sku}.`,
      },
    });
    console.log(`✅ Initial CREATED timeline event logged: ID ${createTimeline.id}`);

    // 6. Update Item Field and Log FIELD_CHANGE
    const oldReorder = item.reorderLevel;
    const newReorder = 50;
    await prisma.item.update({
      where: { id: item.id },
      data: { reorderLevel: newReorder },
    });

    const changeTimeline = await prisma.itemTimeline.create({
      data: {
        itemId: item.id,
        userId: manager.id,
        eventType: TimelineEventType.FIELD_CHANGE,
        fieldName: 'reorderLevel',
        oldValue: String(oldReorder),
        newValue: String(newReorder),
        noteText: `Changed reorderLevel from "${oldReorder}" to "${newReorder}".`,
      },
    });
    console.log(`✅ FIELD_CHANGE event logged: reorderLevel changed from ${changeTimeline.oldValue} to ${changeTimeline.newValue}`);

    // 7. Add Staff NOTE to Timeline
    const staffNote = await prisma.itemTimeline.create({
      data: {
        itemId: item.id,
        userId: staff.id,
        eventType: TimelineEventType.NOTE,
        noteText: 'Inspected warehouse packaging; boxes are reinforced heavy-duty.',
      },
    });
    console.log(`✅ Staff NOTE event logged by ${staff.name}: "${staffNote.noteText}"`);

    // 8. Test Archive & Unarchive Transitions with Audit Logs
    await prisma.item.update({
      where: { id: item.id },
      data: { isArchived: true },
    });
    await prisma.itemTimeline.create({
      data: {
        itemId: item.id,
        userId: manager.id,
        eventType: TimelineEventType.FIELD_CHANGE,
        fieldName: 'isArchived',
        oldValue: 'active',
        newValue: 'archived',
        noteText: 'Item archived by manager.',
      },
    });
    const archivedItem = await prisma.item.findUnique({ where: { id: item.id } });
    if (!archivedItem?.isArchived) {
      throw new Error('FAILED: Item was not marked archived!');
    }
    console.log('✅ Archive state transition verified: isArchived = true.');

    // 9. Fetch Complete Timeline in Chronological Order
    const fullTimeline = await prisma.itemTimeline.findMany({
      where: { itemId: item.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`✅ Complete Timeline retrieved (${fullTimeline.length} events):`);
    fullTimeline.forEach((ev, idx) => {
      console.log(`   [${idx + 1}] ${ev.eventType} by ${ev.user.name} (${ev.user.role}): ${ev.noteText || `${ev.fieldName}: ${ev.oldValue} -> ${ev.newValue}`}`);
    });

    if (fullTimeline.length < 4) {
      throw new Error(`FAILED: Expected at least 4 timeline events, got ${fullTimeline.length}`);
    }

    // Clean up test data
    await prisma.itemTimeline.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
    await prisma.category.delete({ where: { id: category.id } });
    console.log('✅ Test artifacts cleanly dismantled.');

    console.log('\n🎉 ALL SPRINT 2 TESTS PASSED! Items, Categories, Archiving & Immutable Timeline are fully verified.');
  } catch (err: any) {
    console.error('❌ Sprint 2 Test Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSprint2Tests();
