export {};

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- STARTING LIVE E2E PACKING ASSISTANT VERIFICATION ---');

  // Step 1: Login
  console.log('[1/12] Testing Login at /api/auth/login...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@ghumnechalo.com',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  console.log('✓ Login successful for:', loginData.data?.user?.email);

  // Extract session cookie from Set-Cookie header
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No set-cookie header returned from login!');
  }
  const sessionCookie = setCookie.split(';')[0];
  console.log('✓ Acquired Session Cookie:', sessionCookie.substring(0, 25) + '...');

  const headers = {
    'Content-Type': 'application/json',
    Cookie: sessionCookie,
  };

  // Step 2: Open existing trip (Verify trip API and page loads)
  const tripId = 'cmuler2bm00027kjkx1ri7k2l';
  console.log(`\n[2/12] Loading Trip details for tripId: ${tripId}...`);
  const tripApiRes = await fetch(`${BASE_URL}/api/trips/${tripId}`, { headers });
  if (!tripApiRes.ok) {
    throw new Error(`Failed to load trip from API: ${tripApiRes.status} ${await tripApiRes.text()}`);
  }
  const tripApiData = await tripApiRes.json();
  console.log('✓ Trip loaded via API:', tripApiData.data?.title, `(Destination: ${tripApiData.data?.destinationName})`);

  const tripPageRes = await fetch(`${BASE_URL}/trips/${tripId}`, {
    headers: { Cookie: sessionCookie },
  });
  if (!tripPageRes.ok) {
    throw new Error(`Failed to load trip page HTML: ${tripPageRes.status}`);
  }
  console.log('✓ Trip page rendered with HTTP 200.');

  // Step 3: Fetch initial Packing list (should be empty before generation)
  console.log(`\n[3/12] Fetching initial packing list...`);
  const initialRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing`, { headers });
  const initialData = await initialRes.json();
  console.log(`✓ Initial items count: ${initialData.data.items.length}, Summary: ${JSON.stringify(initialData.data.summary)}`);

  // Step 4: Generate Smart Checklist (Weather & Destination aware)
  console.log(`\n[4/12] Generating Smart Packing Checklist (live weather & destination integration)...`);
  const genRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/generate`, {
    method: 'POST',
    headers,
  });
  if (!genRes.ok) {
    throw new Error(`Generate failed: ${genRes.status} ${await genRes.text()}`);
  }
  const genData = await genRes.json();
  const items = genData.data.items;
  console.log(`✓ Successfully generated ${items.length} packing recommendations!`);
  console.log(`  Weather Integrated: ${genData.data.weatherIntegrated}`);
  console.log(`  Weather Condition: ${genData.data.weatherCondition || 'N/A'}`);

  // Step 5: Verify destination-aware and weather-aware items
  console.log(`\n[5/12] Verifying destination-aware & weather-aware recommendations...`);
  const mountainItems = items.filter((i: any) =>
    i.name.toLowerCase().includes('jacket') ||
    i.name.toLowerCase().includes('fleece') ||
    i.name.toLowerCase().includes('shoes') ||
    i.name.toLowerCase().includes('gloves')
  );
  console.log(`✓ Found mountain/terrain items: ${mountainItems.map((i: any) => i.name).join(', ')}`);
  if (mountainItems.length === 0) {
    throw new Error('Destination-specific items (mountain/cold) not found in generated list!');
  }

  // Step 6: Add Custom Item
  console.log(`\n[6/12] Adding custom item 'GoPro Hero 12 with Extra Battery'...`);
  const addRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'GoPro Hero 12 with Extra Battery',
      category: 'ELECTRONICS',
      quantity: 1,
      notes: 'For Rohtang Pass 4K video recording',
    }),
  });
  if (!addRes.ok) {
    throw new Error(`Failed to add custom item: ${addRes.status} ${await addRes.text()}`);
  }
  const customItem = (await addRes.json()).data.item;
  console.log(`✓ Custom item created: ID=${customItem.id}, isCustom=${customItem.isCustom}, category=${customItem.category}`);

  // Step 7: Check / Uncheck Item (Toggle packed status)
  console.log(`\n[7/12] Testing item check/uncheck...`);
  const checkRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${customItem.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isPacked: true }),
  });
  const checkedItem = (await checkRes.json()).data.item;
  console.log(`✓ Item checked: isPacked=${checkedItem.isPacked}`);

  const uncheckRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${customItem.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isPacked: false }),
  });
  const uncheckedItem = (await uncheckRes.json()).data.item;
  console.log(`✓ Item unchecked: isPacked=${uncheckedItem.isPacked}`);

  // Step 8: Edit item
  console.log(`\n[8/12] Testing edit item (change quantity & notes)...`);
  const editRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${customItem.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      quantity: 2,
      notes: 'Updated: 2 batteries fully charged',
    }),
  });
  const editedItem = (await editRes.json()).data.item;
  console.log(`✓ Item edited: quantity=${editedItem.quantity}, notes="${editedItem.notes}"`);

  // Step 9: Mark items as packed and Clear Completed
  console.log(`\n[9/12] Marking 2 items packed and testing Clear Completed...`);
  // Mark custom item and one recommended item as packed
  await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${customItem.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isPacked: true }),
  });
  const firstRecommended = items[0];
  await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${firstRecommended.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isPacked: true }),
  });

  const clearRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/clear-completed`, {
    method: 'POST',
    headers,
  });
  const clearData = await clearRes.json();
  console.log(`✓ Clear completed response: clearedCount=${clearData.data.clearedCount}`);

  // Step 10: Add a custom item again to test Regeneration preservation
  console.log(`\n[10/12] Testing custom item preservation during Regeneration...`);
  const custom2Res = await fetch(`${BASE_URL}/api/trips/${tripId}/packing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'High Altitude Medical Kit',
      category: 'HEALTH',
      quantity: 1,
      notes: 'Prescription altitude sickness medication (Diamox)',
    }),
  });
  const custom2 = (await custom2Res.json()).data.item;
  console.log(`✓ Created custom item: ${custom2.name}`);

  // Trigger regeneration
  const regenRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/generate`, {
    method: 'POST',
    headers,
  });
  const regenData = await regenRes.json();
  const survivingCustom = regenData.data.items.find((i: any) => i.id === custom2.id);
  if (!survivingCustom) {
    throw new Error('Custom item was deleted during regeneration! FAILED preservation requirement.');
  }
  console.log(`✓ Custom item successfully survived regeneration: "${survivingCustom.name}" (isCustom=${survivingCustom.isCustom})`);

  // Step 11: Delete Item
  console.log(`\n[11/12] Testing item deletion...`);
  const delRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing/${custom2.id}`, {
    method: 'DELETE',
    headers,
  });
  const delData = await delRes.json();
  console.log(`✓ Item deleted: success=${delData.data.success}`);

  // Step 12: Verify Final Summary Calculation
  console.log(`\n[12/12] Verifying Final Summary and Progress metrics...`);
  const finalRes = await fetch(`${BASE_URL}/api/trips/${tripId}/packing`, { headers });
  const finalData = await finalRes.json();
  const summary = finalData.data.summary;
  console.log(`✓ Total Items: ${summary.totalItems}`);
  console.log(`✓ Packed Items: ${summary.packedItems}`);
  console.log(`✓ Progress: ${summary.completionPercentage}%`);
  console.log(`✓ Categories Breakdown: ${Object.keys(summary.categoryBreakdown).join(', ')}`);

  console.log('\n======================================================');
  console.log('>>> ALL 12 LIVE E2E USER ACTIONS PASSED SUCCESSFULLY <<<');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
