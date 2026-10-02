import { GeneratedPackingSuggestion } from './types';
import { NormalizedTripWeather } from '../weather/types';

export interface PackingGeneratorContext {
  destinationName: string;
  startDate: Date | string;
  endDate: Date | string;
  weather?: NormalizedTripWeather | null;
  itineraryCount?: number;
  transportationTypes?: string[];
}

export function generatePackingRecommendations(
  context: PackingGeneratorContext
): { items: GeneratedPackingSuggestion[]; weatherIntegrated: boolean; weatherCondition: string | null; temperatureRange: string | null } {
  const start = new Date(context.startDate);
  const end = new Date(context.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const destLower = (context.destinationName || '').toLowerCase();
  const suggestions: GeneratedPackingSuggestion[] = [];

  // Helper to prevent exact duplicates in recommendations
  const addedNames = new Set<string>();
  const add = (item: GeneratedPackingSuggestion) => {
    const key = item.name.trim().toLowerCase();
    if (!addedNames.has(key)) {
      addedNames.add(key);
      suggestions.push(item);
    }
  };

  // ==========================================
  // 1. DOCUMENTS (Crucial for all trips)
  // ==========================================
  add({ name: 'Government ID / Passport', category: 'DOCUMENTS', quantity: 1, notes: 'Physical ID plus digital copy on phone' });
  add({ name: 'Flight / Train / Bus Tickets & Hotel Vouchers', category: 'DOCUMENTS', quantity: 1, notes: 'Saved offline on device' });
  add({ name: 'Travel Insurance & Health Cards', category: 'DOCUMENTS', quantity: 1 });
  add({ name: 'Emergency Contacts & Cash / Cards', category: 'DOCUMENTS', quantity: 1, notes: 'Keep in secondary wallet' });

  // ==========================================
  // 2. ELECTRONICS
  // ==========================================
  add({ name: 'Smartphone & Fast Charger', category: 'ELECTRONICS', quantity: 1 });
  add({ name: 'Power Bank (10,000mAh+)', category: 'ELECTRONICS', quantity: 1, notes: 'Keep in cabin/hand luggage' });
  add({ name: 'Universal Travel Adapter', category: 'ELECTRONICS', quantity: 1 });
  add({ name: 'Earphones / Noise Cancelling Headphones', category: 'ELECTRONICS', quantity: 1 });
  if (durationDays > 3) {
    add({ name: 'Multi-Port USB Hub / Cable Organizer', category: 'ELECTRONICS', quantity: 1 });
  }

  // ==========================================
  // 3. TOILETRIES & PERSONAL CARE
  // ==========================================
  add({ name: 'Toothbrush & Travel Toothpaste', category: 'TOILETRIES', quantity: 1 });
  add({ name: 'Shampoo & Body Wash', category: 'TOILETRIES', quantity: 1, notes: 'Travel-size leak-proof bottles' });
  add({ name: 'Deodorant & Perfume', category: 'TOILETRIES', quantity: 1 });
  add({ name: 'Quick-dry Microfiber Towel', category: 'TOILETRIES', quantity: 1 });
  add({ name: 'Lip Balm & Face Moisturizer', category: 'TOILETRIES', quantity: 1 });
  add({ name: 'Hair Comb / Brush & Razor', category: 'TOILETRIES', quantity: 1 });

  // ==========================================
  // 4. HEALTH & ESSENTIALS
  // ==========================================
  add({ name: 'Personal Prescription Medications', category: 'HEALTH', quantity: 1, notes: 'Full duration supply + 2 buffer days' });
  add({ name: 'First Aid Kit (Band-aids, Antiseptic cream)', category: 'HEALTH', quantity: 1 });
  add({ name: 'Pain Relief & Fever Tablets (Paracetamol/Ibuprofen)', category: 'HEALTH', quantity: 1 });
  add({ name: 'Motion Sickness & Antacid Tablets', category: 'HEALTH', quantity: 1 });
  add({ name: 'Hand Sanitizer & Disinfectant Wipes', category: 'HEALTH', quantity: 2 });
  add({ name: 'Reusable Insulated Water Bottle', category: 'ESSENTIALS', quantity: 1 });
  add({ name: 'Daypack / Crossbody Sling Bag', category: 'ESSENTIALS', quantity: 1 });
  add({ name: 'Travel Laundry Bag / Ziploc Pouches', category: 'ESSENTIALS', quantity: 2 });

  // ==========================================
  // 5. CLOTHING (Duration-aware scaling)
  // ==========================================
  const tshirtsCount = Math.min(durationDays + 1, 10);
  const pantsCount = Math.min(Math.ceil(durationDays / 2) + 1, 6);
  const underwearCount = Math.min(durationDays + 2, 12);
  const sleepwearCount = Math.min(Math.ceil(durationDays / 3), 3);

  add({ name: 'T-Shirts / Casual Tops', category: 'CLOTHING', quantity: tshirtsCount });
  add({ name: 'Pants / Jeans / Bottoms', category: 'CLOTHING', quantity: pantsCount });
  add({ name: 'Undergarments & Daily Socks', category: 'CLOTHING', quantity: underwearCount });
  add({ name: 'Sleepwear / Loungewear', category: 'CLOTHING', quantity: sleepwearCount });
  add({ name: 'Comfortable Walking Shoes / Sneakers', category: 'CLOTHING', quantity: 1 });

  // ==========================================
  // 6. WEATHER-AWARE RECOMMENDATIONS
  // ==========================================
  let weatherIntegrated = false;
  let weatherCondition: string | null = null;
  let temperatureRange: string | null = null;

  if (context.weather && context.weather.summary) {
    weatherIntegrated = true;
    weatherCondition = context.weather.summary.predominantCondition || null;
    temperatureRange = context.weather.summary.tempRange || null;

    // Check Rain / Wet conditions
    const hasRain =
      context.weather.summary.hasRainExpected ||
      (context.weather.summary.maxRainChance ?? 0) >= 30 ||
      context.weather.days?.some((d) => (d.precipitationProbability ?? 0) >= 30);

    if (hasRain) {
      add({
        name: 'Compact Windproof Umbrella',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'RAIN',
        notes: `Recommended: Rain forecast (${context.weather.summary.maxRainChance ?? 40}% chance)`,
      });
      add({
        name: 'Lightweight Raincoat / Waterproof Poncho',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'RAIN',
        notes: 'Keeps clothing and daypack dry during downpours',
      });
      add({
        name: 'Waterproof Phone Pouch & Backpack Cover',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'RAIN',
      });
      add({
        name: 'Quick-dry / Water-Resistant Footwear',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'RAIN',
      });
    }

    // Check Cold conditions (Min temp < 18°C or predominant category)
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    if (context.weather.days && context.weather.days.length > 0) {
      for (const d of context.weather.days) {
        if (typeof d.temperatureMin === 'number' && d.temperatureMin < minTemp) {
          minTemp = d.temperatureMin;
        }
        if (typeof d.temperatureMax === 'number' && d.temperatureMax > maxTemp) {
          maxTemp = d.temperatureMax;
        }
      }
    }

    const isCold = minTemp !== Infinity && minTemp < 18;
    if (isCold) {
      const thermalQty = Math.min(Math.ceil(durationDays / 3), 3);
      const warmSocksQty = Math.min(Math.ceil(durationDays / 2), 4);

      add({
        name: 'Thermal Inners (Top & Bottom)',
        category: 'WEATHER',
        quantity: thermalQty,
        weatherRelevance: 'COLD',
        notes: `Forecast drops to ${minTemp}°C`,
      });
      add({
        name: 'Warm Fleece Jacket / Puffer Coat',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'COLD',
        notes: 'Outer protective layer for cold evenings',
      });
      add({
        name: 'Woolen Beanie & Gloves',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'COLD',
      });
      add({
        name: 'Heavy Woolen Socks',
        category: 'WEATHER',
        quantity: warmSocksQty,
        weatherRelevance: 'COLD',
      });
    }

    // Check Hot / Sunny conditions (Max temp >= 28°C or clear sunny)
    const isHot = maxTemp !== -Infinity && maxTemp >= 28;
    if (isHot) {
      add({
        name: 'Broad-Spectrum Sunscreen SPF 50+',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'HOT',
        notes: `High sun exposure (High: ${maxTemp}°C)`,
      });
      add({
        name: 'UV Protection Sunglasses',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'HOT',
      });
      add({
        name: 'Sun Hat / Wide-Brimmed Cap',
        category: 'WEATHER',
        quantity: 1,
        weatherRelevance: 'HOT',
      });
      add({
        name: 'Breathable Cotton / Linen Clothes',
        category: 'WEATHER',
        quantity: Math.min(durationDays, 4),
        weatherRelevance: 'HOT',
        notes: 'Helps stay cool in hot weather',
      });
      add({
        name: 'Electrolyte Powder / ORS Sachets',
        category: 'WEATHER',
        quantity: Math.min(durationDays * 2, 6),
        weatherRelevance: 'HOT',
        notes: 'Essential for staying hydrated',
      });
    }
  } else {
    // Weather unavailable fallback: Provide generic essentials with explicit fallback notes
    add({
      name: 'Light Layer / Travel Cardigan',
      category: 'WEATHER',
      quantity: 1,
      weatherRelevance: 'GENERAL',
      notes: 'Versatile layer for transit, air-conditioned rooms, or breezy evenings',
    });
    add({
      name: 'UV Sunglasses & Cap',
      category: 'WEATHER',
      quantity: 1,
      weatherRelevance: 'GENERAL',
      notes: 'All-weather eye and sun protection',
    });
  }

  // ==========================================
  // 7. DESTINATION & ACTIVITY AWARENESS
  // ==========================================
  const isBeach =
    destLower.includes('beach') ||
    destLower.includes('goa') ||
    destLower.includes('andaman') ||
    destLower.includes('kerala') ||
    destLower.includes('bali') ||
    destLower.includes('phuket') ||
    destLower.includes('maldives') ||
    destLower.includes('coastal') ||
    destLower.includes('island');

  const isMountains =
    destLower.includes('hill') ||
    destLower.includes('mountain') ||
    destLower.includes('himachal') ||
    destLower.includes('manali') ||
    destLower.includes('shimla') ||
    destLower.includes('leh') ||
    destLower.includes('ladakh') ||
    destLower.includes('uttarakhand') ||
    destLower.includes('rishikesh') ||
    destLower.includes('darjeeling') ||
    destLower.includes('trek') ||
    destLower.includes('hiking') ||
    destLower.includes('kashmir');

  const isHeritageOrCity =
    destLower.includes('delhi') ||
    destLower.includes('jaipur') ||
    destLower.includes('agra') ||
    destLower.includes('varanasi') ||
    destLower.includes('udaipur') ||
    destLower.includes('mumbai') ||
    destLower.includes('bangalore') ||
    destLower.includes('temple') ||
    destLower.includes('heritage');

  if (isBeach) {
    add({
      name: 'Swimwear / Swim Shorts',
      category: 'ACTIVITIES',
      quantity: 2,
      notes: 'Beach & swimming activities',
    });
    add({
      name: 'Flip-Flops / Waterproof Beach Sandals',
      category: 'ACTIVITIES',
      quantity: 1,
    });
    add({
      name: 'Aloe Vera After-Sun Gel',
      category: 'ACTIVITIES',
      quantity: 1,
    });
    add({
      name: 'Waterproof Dry Bag',
      category: 'ACTIVITIES',
      quantity: 1,
      notes: 'Keeps valuables safe around water',
    });
  }

  if (isMountains) {
    add({
      name: 'Sturdy Hiking Shoes / Grip Boots',
      category: 'ACTIVITIES',
      quantity: 1,
      notes: 'Ankle support for mountain terrain',
    });
    add({
      name: 'Trekking Pole / Walking Stick',
      category: 'ACTIVITIES',
      quantity: 1,
    });
    add({
      name: 'High-Energy Trail Mix / Protein Snacks',
      category: 'ACTIVITIES',
      quantity: 3,
    });
    add({
      name: 'Flashlight / Headlamp with extra batteries',
      category: 'ACTIVITIES',
      quantity: 1,
    });
  }

  if (isHeritageOrCity) {
    add({
      name: 'Modest Scarf / Shawl for Monuments & Temples',
      category: 'ACTIVITIES',
      quantity: 1,
      notes: 'Required for temple entry & sun protection',
    });
    add({
      name: 'Slip-on Shoes / Easy-to-remove Footwear',
      category: 'ACTIVITIES',
      quantity: 1,
      notes: 'Convenient for entering places of worship',
    });
  }

  return {
    items: suggestions,
    weatherIntegrated,
    weatherCondition,
    temperatureRange,
  };
}
