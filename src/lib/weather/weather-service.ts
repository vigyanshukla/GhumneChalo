import { prisma } from '../prisma';
import { NotFoundError, ValidationError } from '../api-error';
import { fetchOpenMeteoForecast, OpenMeteoError } from './open-meteo';
import { mapWmoCode, formatCelsius, formatCelsiusRange, formatWindSpeed, formatPrecipitation } from './wmo-codes';
import {
  NormalizedTripWeather,
  NormalizedWeatherDay,
  CurrentWeatherInfo,
  WeatherConditionCategory,
  OpenMeteoRawResponse,
} from './types';
import { searchPlaces, getPlaceDetails } from '../maps/places';

import { ServerLRUCache } from '../cache/server-lru-cache';

// 15-minute in-memory LRU cache for ultra-fast hot responses
const MEMORY_CACHE_TTL_MS = 15 * 60 * 1000;
// 3-hour DB snapshot freshness threshold
const DB_SNAPSHOT_FRESHNESS_MS = 3 * 60 * 60 * 1000;

/** Max 100 trip weather results cached; ~4 KB each ≈ 400 KB max */
const memoryCache = new ServerLRUCache<string, NormalizedTripWeather>({
  maxSize: 100,
  ttlMs: MEMORY_CACHE_TTL_MS,
  label: 'weather:trips',
});

/** Max 100 coordinate weather results cached; ~3 KB each ≈ 300 KB max */
const coordWeatherCache = new ServerLRUCache<string, NormalizedTripWeather>({
  maxSize: 100,
  ttlMs: MEMORY_CACHE_TTL_MS,
  label: 'weather:coords',
});

export function _clearWeatherCache(): void {
  memoryCache.clear();
  coordWeatherCache.clear();
}

export function _getWeatherCacheStats() {
  return {
    trips: memoryCache.stats(),
    coords: coordWeatherCache.stats(),
  };
}

/**
 * Generates an array of ISO date strings (YYYY-MM-DD) between start and end inclusive.
 */
export function generateDateRange(start: Date | string, end: Date | string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const finish = new Date(end);

  // Normalize to UTC midnight for consistent daily boundary comparisons
  cur.setUTCHours(0, 0, 0, 0);
  finish.setUTCHours(0, 0, 0, 0);

  // Safety guard against runaway ranges (max 60 days)
  let count = 0;
  while (cur <= finish && count < 60) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
    count++;
  }

  return dates;
}

/**
 * Normalizes Open-Meteo raw response into the GhumneChalo application contract.
 */
export function normalizeOpenMeteoResponse(
  raw: OpenMeteoRawResponse,
  tripDays: { date: string; dayNumber?: number }[],
  meta: {
    tripId: string;
    destinationName: string;
    latitude: number;
    longitude: number;
    isCached: boolean;
    isStale: boolean;
    warning?: string;
  }
): NormalizedTripWeather {
  const dailyRaw = raw.daily || { time: [] };
  const dailyMap = new Map<string, {
    tempMax?: number;
    tempMin?: number;
    apparentMax?: number;
    apparentMin?: number;
    precipProb?: number;
    precipSum?: number;
    windMax?: number;
    weatherCode?: number;
  }>();

  for (let i = 0; i < (dailyRaw.time?.length || 0); i++) {
    const t = dailyRaw.time[i];
    dailyMap.set(t, {
      tempMax: dailyRaw.temperature_2m_max?.[i],
      tempMin: dailyRaw.temperature_2m_min?.[i],
      apparentMax: dailyRaw.apparent_temperature_max?.[i],
      apparentMin: dailyRaw.apparent_temperature_min?.[i],
      precipProb: dailyRaw.precipitation_probability_max?.[i],
      precipSum: dailyRaw.precipitation_sum?.[i],
      windMax: dailyRaw.wind_speed_10m_max?.[i],
      weatherCode: dailyRaw.weather_code?.[i],
    });
  }

  // Current weather
  let current: CurrentWeatherInfo | null = null;
  if (raw.current && typeof raw.current.temperature_2m === 'number') {
    const code = raw.current.weather_code;
    const { condition, category } = mapWmoCode(code);
    current = {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature ?? null,
      weatherCode: code ?? null,
      condition,
      conditionCategory: category,
      windSpeed: raw.current.wind_speed_10m ?? null,
      precipitation: raw.current.precipitation ?? null,
      formattedTemp: formatCelsius(raw.current.temperature_2m),
    };
  }

  const categoryCounts: Record<string, number> = {};
  let overallMinTemp = Infinity;
  let overallMaxTemp = -Infinity;
  let maxRainChance = 0;
  let hasRainExpected = false;

  const todayStr = new Date().toISOString().split('T')[0];
  const maxForecastDate = new Date();
  maxForecastDate.setUTCDate(maxForecastDate.getUTCDate() + 16);
  const maxForecastStr = maxForecastDate.toISOString().split('T')[0];

  const days: NormalizedWeatherDay[] = tripDays.map(({ date, dayNumber }) => {
    const rawDay = dailyMap.get(date);

    // Honest handling of out-of-range dates
    if (date < todayStr) {
      return {
        date,
        dayNumber,
        status: 'past_unavailable',
        statusMessage: 'Historical weather data unavailable',
        temperatureMax: null,
        temperatureMin: null,
        temperatureMean: null,
        apparentTemperatureMax: null,
        apparentTemperatureMin: null,
        precipitationProbability: null,
        precipitationSum: null,
        windSpeedMax: null,
        weatherCode: null,
        condition: 'Historical',
        conditionCategory: 'unknown',
        formattedTemp: '--°C',
        formattedTempRange: '--°C',
        formattedWind: '-- km/h',
        formattedPrecipitation: '--',
      };
    }

    if (date > maxForecastStr || !rawDay) {
      return {
        date,
        dayNumber,
        status: 'future_unavailable',
        statusMessage: 'Forecast not available yet for this date',
        temperatureMax: null,
        temperatureMin: null,
        temperatureMean: null,
        apparentTemperatureMax: null,
        apparentTemperatureMin: null,
        precipitationProbability: null,
        precipitationSum: null,
        windSpeedMax: null,
        weatherCode: null,
        condition: 'Forecast Unavailable',
        conditionCategory: 'unknown',
        formattedTemp: '--°C',
        formattedTempRange: '--°C',
        formattedWind: '-- km/h',
        formattedPrecipitation: '--',
      };
    }

    const tempMax = typeof rawDay.tempMax === 'number' ? Math.round(rawDay.tempMax * 10) / 10 : null;
    const tempMin = typeof rawDay.tempMin === 'number' ? Math.round(rawDay.tempMin * 10) / 10 : null;
    const tempMean =
      tempMax !== null && tempMin !== null
        ? Math.round(((tempMax + tempMin) / 2) * 10) / 10
        : tempMax ?? tempMin;

    if (tempMin !== null && tempMin < overallMinTemp) overallMinTemp = tempMin;
    if (tempMax !== null && tempMax > overallMaxTemp) overallMaxTemp = tempMax;

    const prob = typeof rawDay.precipProb === 'number' ? rawDay.precipProb : null;
    if (prob !== null && prob > maxRainChance) maxRainChance = prob;
    if ((prob !== null && prob >= 30) || (typeof rawDay.precipSum === 'number' && rawDay.precipSum > 0.5)) {
      hasRainExpected = true;
    }

    const { condition, category } = mapWmoCode(rawDay.weatherCode);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    return {
      date,
      dayNumber,
      status: 'available',
      temperatureMax: tempMax,
      temperatureMin: tempMin,
      temperatureMean: tempMean,
      apparentTemperatureMax: typeof rawDay.apparentMax === 'number' ? rawDay.apparentMax : null,
      apparentTemperatureMin: typeof rawDay.apparentMin === 'number' ? rawDay.apparentMin : null,
      precipitationProbability: prob,
      precipitationSum: typeof rawDay.precipSum === 'number' ? rawDay.precipSum : null,
      windSpeedMax: typeof rawDay.windMax === 'number' ? rawDay.windMax : null,
      weatherCode: typeof rawDay.weatherCode === 'number' ? rawDay.weatherCode : null,
      condition,
      conditionCategory: category,
      formattedTemp: formatCelsius(tempMean ?? tempMax),
      formattedTempRange: formatCelsiusRange(tempMin, tempMax),
      formattedWind: formatWindSpeed(rawDay.windMax),
      formattedPrecipitation: formatPrecipitation(prob, rawDay.precipSum),
    };
  });

  // Calculate predominant condition
  let predominantCategory: WeatherConditionCategory = 'clear';
  let highestCount = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > highestCount && cat !== 'unknown') {
      highestCount = count;
      predominantCategory = cat as WeatherConditionCategory;
    }
  }

  const { condition: predominantCondition } = mapWmoCode(
    predominantCategory === 'clear'
      ? 0
      : predominantCategory === 'partly_cloudy'
      ? 2
      : predominantCategory === 'cloudy'
      ? 3
      : predominantCategory === 'rain'
      ? 61
      : predominantCategory === 'thunderstorm'
      ? 95
      : 1
  );

  return {
    tripId: meta.tripId,
    destinationName: meta.destinationName,
    latitude: meta.latitude,
    longitude: meta.longitude,
    timezone: raw.timezone || 'auto',
    elevation: raw.elevation,
    current,
    days,
    summary: {
      tempRange:
        overallMinTemp !== Infinity && overallMaxTemp !== -Infinity
          ? formatCelsiusRange(overallMinTemp, overallMaxTemp)
          : '--°C',
      predominantCondition,
      hasRainExpected,
      maxRainChance,
    },
    fetchedAt: new Date().toISOString(),
    isCached: meta.isCached,
    isStale: meta.isStale,
    warning: meta.warning,
  };
}

/**
 * Reconstitutes normalized weather from stored database snapshots.
 */
function buildFromSnapshots(
  tripId: string,
  destinationName: string,
  latitude: number,
  longitude: number,
  tripDays: { date: string; dayNumber?: number }[],
  snapshots: {
    date: Date;
    temperature: number | null;
    precipitationProbability: number | null;
    weatherCode: number | null;
    fetchedAt: Date;
  }[],
  isStale: boolean,
  warning?: string
): NormalizedTripWeather {
  const snapshotMap = new Map<string, typeof snapshots[0]>();
  for (const s of snapshots) {
    const dStr = s.date.toISOString().split('T')[0];
    snapshotMap.set(dStr, s);
  }

  const categoryCounts: Record<string, number> = {};
  let overallMinTemp = Infinity;
  let overallMaxTemp = -Infinity;
  let maxRainChance = 0;
  let hasRainExpected = false;

  const days: NormalizedWeatherDay[] = tripDays.map(({ date, dayNumber }) => {
    const s = snapshotMap.get(date);
    if (!s) {
      return {
        date,
        dayNumber,
        status: 'future_unavailable',
        statusMessage: 'Forecast not available for this date',
        temperatureMax: null,
        temperatureMin: null,
        temperatureMean: null,
        apparentTemperatureMax: null,
        apparentTemperatureMin: null,
        precipitationProbability: null,
        precipitationSum: null,
        windSpeedMax: null,
        weatherCode: null,
        condition: 'Forecast Unavailable',
        conditionCategory: 'unknown',
        formattedTemp: '--°C',
        formattedTempRange: '--°C',
        formattedWind: '-- km/h',
        formattedPrecipitation: '--',
      };
    }

    const temp = s.temperature;
    if (temp !== null && temp < overallMinTemp) overallMinTemp = temp;
    if (temp !== null && temp > overallMaxTemp) overallMaxTemp = temp;

    const prob = s.precipitationProbability;
    if (prob !== null && prob > maxRainChance) maxRainChance = prob;
    if (prob !== null && prob >= 30) hasRainExpected = true;

    const { condition, category } = mapWmoCode(s.weatherCode);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    return {
      date,
      dayNumber,
      status: 'available',
      temperatureMax: temp,
      temperatureMin: temp,
      temperatureMean: temp,
      apparentTemperatureMax: null,
      apparentTemperatureMin: null,
      precipitationProbability: prob,
      precipitationSum: null,
      windSpeedMax: null,
      weatherCode: s.weatherCode,
      condition,
      conditionCategory: category,
      formattedTemp: formatCelsius(temp),
      formattedTempRange: formatCelsius(temp),
      formattedWind: '-- km/h',
      formattedPrecipitation: formatPrecipitation(prob),
    };
  });

  return {
    tripId,
    destinationName,
    latitude,
    longitude,
    timezone: 'auto',
    current: null,
    days,
    summary: {
      tempRange:
        overallMinTemp !== Infinity && overallMaxTemp !== -Infinity
          ? formatCelsiusRange(overallMinTemp, overallMaxTemp)
          : '--°C',
      predominantCondition: 'Clear Sky',
      hasRainExpected,
      maxRainChance,
    },
    fetchedAt: snapshots[0]?.fetchedAt.toISOString() || new Date().toISOString(),
    isCached: true,
    isStale,
    warning,
  };
}

/**
 * Retrieves trip weather with multi-tier caching (memory + DB snapshots) and graceful provider fallback.
 */
export async function getTripWeather(
  tripId: string,
  userId: string,
  options?: { forceRefresh?: boolean }
): Promise<NormalizedTripWeather> {
  // 1. Fetch trip and verify ownership
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryDays: {
        orderBy: { dayNumber: 'asc' },
        select: { id: true, dayNumber: true, date: true },
      },
    },
  });

  if (!trip) {
    throw new NotFoundError('Trip not found.');
  }

  if (trip.userId !== userId) {
    // Return 404 to avoid resource enumeration (IDOR protection)
    throw new NotFoundError('Trip not found.');
  }

  // 2. Resolve destination coordinates
  let lat = trip.latitude;
  let lng = trip.longitude;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    // Attempt resolution using place ID or destination name without duplicating geocode logic
    if (trip.destinationPlaceId) {
      const details = await getPlaceDetails(trip.destinationPlaceId);
      if (details) {
        lat = details.latitude;
        lng = details.longitude;
      }
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      const places = await searchPlaces(trip.destinationName);
      if (places.length > 0 && typeof places[0].latitude === 'number') {
        lat = places[0].latitude;
        lng = places[0].longitude;
      }
    }

    // Persist discovered coordinates so subsequent queries never re-geocode
    if (typeof lat === 'number' && typeof lng === 'number') {
      await prisma.trip.update({
        where: { id: tripId },
        data: { latitude: lat, longitude: lng },
      });
    } else {
      throw new ValidationError(
        `Unable to resolve geographic coordinates for "${trip.destinationName}". Please edit destination.`
      );
    }
  }

  const memoryKey = `trip:${tripId}`;
  const now = Date.now();

  // 3. Fast Memory Cache check (unless forceRefresh)
  if (!options?.forceRefresh) {
    const memEntry = memoryCache.get(memoryKey);
    if (memEntry !== null) {
      return { ...memEntry, isCached: true };
    }
  }

  // 4. Construct trip days
  const tripDateStrings = generateDateRange(trip.startDate, trip.endDate);
  const tripDays = tripDateStrings.map((dateStr, idx) => {
    const matchingDay = trip.itineraryDays.find((d) => d.dayNumber === idx + 1);
    return {
      date: dateStr,
      dayNumber: matchingDay ? matchingDay.dayNumber : idx + 1,
    };
  });

  // 5. Check Database WeatherSnapshots freshness
  const todayStr = new Date().toISOString().split('T')[0];
  const maxForecastDate = new Date();
  maxForecastDate.setUTCDate(maxForecastDate.getUTCDate() + 16);
  const maxForecastStr = maxForecastDate.toISOString().split('T')[0];

  // Eligible forecast dates
  const eligibleDates = tripDateStrings.filter((d) => d >= todayStr && d <= maxForecastStr);

  const existingSnapshots = await prisma.weatherSnapshot.findMany({
    where: {
      tripId,
      date: {
        in: tripDateStrings.map((d) => new Date(`${d}T00:00:00.000Z`)),
      },
    },
    orderBy: { date: 'asc' },
  });

  const allEligibleHaveSnapshots =
    eligibleDates.length > 0 &&
    eligibleDates.every((ed) =>
      existingSnapshots.some((s) => s.date.toISOString().split('T')[0] === ed)
    );

  const newestSnapshotTime = existingSnapshots.reduce(
    (max, s) => Math.max(max, s.fetchedAt.getTime()),
    0
  );
  const isDbSnapshotFresh =
    allEligibleHaveSnapshots &&
    newestSnapshotTime > 0 &&
    now - newestSnapshotTime < DB_SNAPSHOT_FRESHNESS_MS;

  if (isDbSnapshotFresh && !options?.forceRefresh) {
    const result = buildFromSnapshots(
      tripId,
      trip.destinationName,
      lat,
      lng,
      tripDays,
      existingSnapshots,
      false
    );
    memoryCache.set(memoryKey, result);
    return result;
  }

  // 6. Fetch from Open-Meteo
  // If no dates are in forecast range (e.g. all in past or far future), return honest unavailable state
  if (eligibleDates.length === 0) {
    const result = normalizeOpenMeteoResponse(
      { latitude: lat, longitude: lng },
      tripDays,
      {
        tripId,
        destinationName: trip.destinationName,
        latitude: lat,
        longitude: lng,
        isCached: false,
        isStale: false,
      }
    );
    memoryCache.set(memoryKey, result);
    return result;
  }

  const startDateParam = eligibleDates[0];
  const endDateParam = eligibleDates[eligibleDates.length - 1];

  try {
    const rawForecast = await fetchOpenMeteoForecast({
      latitude: lat,
      longitude: lng,
      startDate: startDateParam,
      endDate: endDateParam,
    });

    const normalized = normalizeOpenMeteoResponse(rawForecast, tripDays, {
      tripId,
      destinationName: trip.destinationName,
      latitude: lat,
      longitude: lng,
      isCached: false,
      isStale: false,
    });

    // 7. Persist snapshots in database asynchronously/transactionally
    const daysToPersist = normalized.days
      .filter((d) => d.status === 'available')
      .map((d) => ({
        tripId,
        date: new Date(`${d.date}T00:00:00.000Z`),
        latitude: lat,
        longitude: lng,
        temperature: d.temperatureMean ?? d.temperatureMax,
        precipitationProbability: d.precipitationProbability,
        weatherCode: d.weatherCode,
      }));

    if (daysToPersist.length > 0) {
      await prisma.$transaction([
        prisma.weatherSnapshot.deleteMany({
          where: {
            tripId,
            date: { in: daysToPersist.map((p) => p.date) },
          },
        }),
        prisma.weatherSnapshot.createMany({
          data: daysToPersist,
        }),
      ]);
    }

    // Cache in memory
    memoryCache.set(memoryKey, normalized);
    return normalized;
  } catch (error) {
    // If provider fails but we have snapshots, safely return cached snapshot with isStale: true
    if (existingSnapshots.length > 0) {
      const staleResult = buildFromSnapshots(
        tripId,
        trip.destinationName,
        lat,
        lng,
        tripDays,
        existingSnapshots,
        true,
        'Weather service currently unavailable; displaying cached snapshot.'
      );
      memoryCache.set(memoryKey, staleResult);
      return staleResult;
    }

    if (error instanceof OpenMeteoError) {
      throw error;
    }
    throw new OpenMeteoError('Weather forecast is temporarily unavailable.', 503);
  }
}

/**
 * Standalone coordinate-based weather lookup for exploring locations.
 */
export async function getCoordinateWeather(params: {
  latitude: number;
  longitude: number;
  startDate?: string;
  endDate?: string;
}): Promise<NormalizedTripWeather> {
  const { latitude, longitude } = params;

  const todayStr = new Date().toISOString().split('T')[0];
  const maxForecastDate = new Date();
  maxForecastDate.setUTCDate(maxForecastDate.getUTCDate() + 7);
  const defaultEndStr = maxForecastDate.toISOString().split('T')[0];

  const startDate = params.startDate || todayStr;
  const endDate = params.endDate || defaultEndStr;

  const cacheKey = `${latitude.toFixed(2)}:${longitude.toFixed(2)}:${startDate}:${endDate}`;
  const cached = coordWeatherCache.get(cacheKey);
  if (cached) {
    return { ...cached, isCached: true };
  }

  const dateList = generateDateRange(startDate, endDate).map((date, idx) => ({
    date,
    dayNumber: idx + 1,
  }));

  const raw = await fetchOpenMeteoForecast({
    latitude,
    longitude,
    startDate,
    endDate,
  });

  const normalized = normalizeOpenMeteoResponse(raw, dateList, {
    tripId: 'coordinates',
    destinationName: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
    latitude,
    longitude,
    isCached: false,
    isStale: false,
  });

  coordWeatherCache.set(cacheKey, normalized);
  return normalized;
}
