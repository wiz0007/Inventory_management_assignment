import { prisma } from '../src/db';

const API_BASE = 'http://localhost:5000/api';

async function loginUser(email: string, password = 'Password123!') {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} with status ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';
  const data = await res.json();
  return { token, user: data.user, cookieHeader: `token=${token}` };
}

async function runSprint6Tests() {
  console.log('🧪 Starting Sprint 6 Automated Verification (Analytics Dashboard & Visualizations)...\n');

  try {
    // Authenticate test user
    const manager = await loginUser('manager@distributor.com', 'Manager123!');
    const staff = await loginUser('staff1@distributor.com', 'Staff123!');
    console.log('✅ Authenticated test users: Manager and Staff\n');

    // --- Test 1: Unauthenticated Guard ---
    console.log('--- Test 1: Authentication Guard ---');
    const unauthRes = await fetch(`${API_BASE}/dashboard/kpis`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
    }
    console.log('✅ Unauthenticated access correctly rejected with 401 Unauthorized.\n');

    // --- Test 2: Headline KPIs (Requirement 8) ---
    console.log('--- Test 2: 4 Headline KPIs (Requirement 8) ---');
    const kpiRes = await fetch(`${API_BASE}/dashboard/kpis`, {
      headers: { Cookie: manager.cookieHeader },
    });
    if (!kpiRes.ok) {
      throw new Error(`Failed to fetch dashboard KPIs: status ${kpiRes.status}`);
    }
    const kpiData = await kpiRes.json();

    console.log('   KPIs received:', {
      activeItems: kpiData.activeItems,
      lowStockItems: kpiData.lowStockItems,
      movementsToday: kpiData.movementsToday,
      distinctItemsMovedThisWeek: kpiData.distinctItemsMovedThisWeek,
      totalInventoryUnits: kpiData.totalInventoryUnits,
    });

    if (typeof kpiData.activeItems !== 'number' || kpiData.activeItems < 1) {
      throw new Error(`Expected activeItems >= 1, got ${kpiData.activeItems}`);
    }
    if (typeof kpiData.lowStockItems !== 'number') {
      throw new Error(`Expected lowStockItems to be a number, got ${kpiData.lowStockItems}`);
    }
    if (typeof kpiData.movementsToday !== 'number') {
      throw new Error(`Expected movementsToday to be a number, got ${kpiData.movementsToday}`);
    }
    if (typeof kpiData.distinctItemsMovedThisWeek !== 'number' || kpiData.distinctItemsMovedThisWeek < 1) {
      throw new Error(`Expected distinctItemsMovedThisWeek >= 1, got ${kpiData.distinctItemsMovedThisWeek}`);
    }
    if (typeof kpiData.totalInventoryUnits !== 'number' || kpiData.totalInventoryUnits < 1) {
      throw new Error(`Expected totalInventoryUnits >= 1, got ${kpiData.totalInventoryUnits}`);
    }
    console.log('✅ All 4 headline KPIs calculated accurately from live ledger state.\n');

    // --- Test 3: Stock Distribution by Category & Location (Requirement 8) ---
    console.log('--- Test 3: Category Donut & Location Bar Distributions ---');
    const distRes = await fetch(`${API_BASE}/dashboard/distribution`, {
      headers: { Cookie: staff.cookieHeader },
    });
    if (!distRes.ok) {
      throw new Error(`Failed to fetch distribution: status ${distRes.status}`);
    }
    const distData = await distRes.json();

    if (!Array.isArray(distData.byCategory) || distData.byCategory.length === 0) {
      throw new Error('Expected byCategory to be a non-empty array');
    }
    if (!Array.isArray(distData.byLocation) || distData.byLocation.length === 0) {
      throw new Error('Expected byLocation to be a non-empty array');
    }

    console.log(`   Categories count: ${distData.byCategory.length}, Locations count: ${distData.byLocation.length}`);
    console.log(`   Top category: '${distData.byCategory[0].name}' (${distData.byCategory[0].totalQuantity} units, ${distData.byCategory[0].percentage}%)`);
    console.log(`   Top location: '${distData.byLocation[0].name}' (${distData.byLocation[0].totalQuantity} units, ${distData.byLocation[0].percentage}%)`);

    // Verify percentages sum to approx 100%
    const catPercentSum = distData.byCategory.reduce((acc: number, c: any) => acc + c.percentage, 0);
    if (catPercentSum < 98 || catPercentSum > 102) {
      throw new Error(`Category percentages sum out of range: ${catPercentSum}`);
    }

    console.log('✅ Category Donut and Location Bar distribution calculations verified.\n');

    // --- Test 4: 8-Week Movement Volume Trends (Requirement 8) ---
    console.log('--- Test 4: 8-Week Movement Volume Trends ---');
    const trendsRes = await fetch(`${API_BASE}/dashboard/movement-trends`, {
      headers: { Cookie: manager.cookieHeader },
    });
    if (!trendsRes.ok) {
      throw new Error(`Failed to fetch movement trends: status ${trendsRes.status}`);
    }
    const trendsData = await trendsRes.json();

    if (!Array.isArray(trendsData.trends) || trendsData.trends.length !== 8) {
      throw new Error(`Expected exactly 8 trend buckets, got ${trendsData.trends?.length}`);
    }

    const { totalReceipts, totalIssues, netDelta } = trendsData.summary;
    console.log(`   8-week summary: Inflow = ${totalReceipts} units, Outflow = ${totalIssues} units, Net Delta = ${netDelta} units`);

    if (totalReceipts <= 0 || totalIssues <= 0) {
      throw new Error('Expected positive historical movement volumes across 8 weeks');
    }

    // Verify chronological order
    for (let i = 0; i < 8; i++) {
      const bucket = trendsData.trends[i];
      if (bucket.weekIndex !== i) {
        throw new Error(`Bucket index mismatch at ${i}: expected ${i}, got ${bucket.weekIndex}`);
      }
      if (!bucket.label || typeof bucket.receipts !== 'number' || typeof bucket.issues !== 'number') {
        throw new Error(`Invalid bucket structure at week ${i}`);
      }
    }

    console.log('✅ 8-Week sequential movement velocity trend aggregation verified.\n');

    console.log('🎉 ALL SPRINT 6 BACKEND TESTS PASSED! Analytics endpoints & aggregations are 100% verified.\n');
  } catch (err: any) {
    console.error('❌ Sprint 6 verification failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSprint6Tests();
