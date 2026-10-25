import { WeatherConditionCategory } from './types';

/**
 * WMO Weather interpretation codes (WW)
 * Reference: Open-Meteo & World Meteorological Organization
 */
interface WmoConditionInfo {
  condition: string;
  category: WeatherConditionCategory;
  description: string;
}

const WMO_CODE_TABLE: Record<number, WmoConditionInfo> = {
  0: { condition: 'Clear Sky', category: 'clear', description: 'Cloudless and sunny' },
  1: { condition: 'Mainly Clear', category: 'clear', description: 'Mostly sunny with scattered light clouds' },
  2: { condition: 'Partly Cloudy', category: 'partly_cloudy', description: 'Partly cloudy throughout the day' },
  3: { condition: 'Overcast', category: 'cloudy', description: 'Overcast skies' },
  45: { condition: 'Foggy', category: 'fog', description: 'Fog with reduced visibility' },
  48: { condition: 'Depositing Rime Fog', category: 'fog', description: 'Dense depositing fog' },
  51: { condition: 'Light Drizzle', category: 'drizzle', description: 'Light fine drizzle' },
  53: { condition: 'Moderate Drizzle', category: 'drizzle', description: 'Moderate continuous drizzle' },
  55: { condition: 'Dense Drizzle', category: 'drizzle', description: 'Dense heavy drizzle' },
  56: { condition: 'Light Freezing Drizzle', category: 'drizzle', description: 'Light freezing drizzle' },
  57: { condition: 'Dense Freezing Drizzle', category: 'drizzle', description: 'Dense freezing drizzle' },
  61: { condition: 'Slight Rain', category: 'rain', description: 'Occasional light rain showers' },
  63: { condition: 'Moderate Rain', category: 'rain', description: 'Steady moderate rainfall' },
  65: { condition: 'Heavy Rain', category: 'rain', description: 'Heavy persistent rainfall' },
  66: { condition: 'Light Freezing Rain', category: 'rain', description: 'Light freezing rain' },
  67: { condition: 'Heavy Freezing Rain', category: 'rain', description: 'Heavy freezing rain' },
  71: { condition: 'Slight Snowfall', category: 'snow', description: 'Light flurries and snowfall' },
  73: { condition: 'Moderate Snowfall', category: 'snow', description: 'Moderate snowfall' },
  75: { condition: 'Heavy Snowfall', category: 'snow', description: 'Heavy steady snow accumulation' },
  77: { condition: 'Snow Grains', category: 'snow', description: 'Fine snow grains' },
  80: { condition: 'Slight Rain Showers', category: 'rain', description: 'Brief scattered rain showers' },
  81: { condition: 'Moderate Rain Showers', category: 'rain', description: 'Moderate rain showers' },
  82: { condition: 'Violent Rain Showers', category: 'rain', description: 'Intense sudden rain showers' },
  85: { condition: 'Slight Snow Showers', category: 'snow', description: 'Intermittent snow showers' },
  86: { condition: 'Heavy Snow Showers', category: 'snow', description: 'Heavy snow showers' },
  95: { condition: 'Thunderstorm', category: 'thunderstorm', description: 'Thunderstorm with lightning' },
  96: { condition: 'Thunderstorm with Slight Hail', category: 'thunderstorm', description: 'Thunderstorm with light hail' },
  99: { condition: 'Thunderstorm with Heavy Hail', category: 'thunderstorm', description: 'Severe thunderstorm with heavy hail' },
};

/**
 * Maps WMO weather code to standard condition, category, and descriptive text.
 */
export function mapWmoCode(code: number | null | undefined): WmoConditionInfo {
  if (code === null || code === undefined || typeof code !== 'number') {
    return {
      condition: 'Unknown Weather',
      category: 'unknown',
      description: 'Weather condition information unavailable',
    };
  }

  const match = WMO_CODE_TABLE[code];
  if (match) {
    return match;
  }

  // Graceful fallback for grouped codes
  if (code >= 51 && code <= 57) {
    return { condition: 'Drizzle', category: 'drizzle', description: 'Drizzle showers' };
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { condition: 'Rain', category: 'rain', description: 'Rain showers' };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { condition: 'Snow', category: 'snow', description: 'Snow conditions' };
  }
  if (code >= 95 && code <= 99) {
    return { condition: 'Thunderstorm', category: 'thunderstorm', description: 'Thunderstorm activity' };
  }

  return {
    condition: `Weather (${code})`,
    category: 'unknown',
    description: 'General atmospheric condition',
  };
}

/**
 * Formats a temperature in Celsius (°C).
 */
export function formatCelsius(temp: number | null | undefined): string {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return '--°C';
  }
  return `${Math.round(temp)}°C`;
}

/**
 * Formats a min/max temperature range in Celsius (°C).
 */
export function formatCelsiusRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min === null || min === undefined || max === null || max === undefined) {
    if (max !== null && max !== undefined) return formatCelsius(max);
    if (min !== null && min !== undefined) return formatCelsius(min);
    return '--°C';
  }
  return `${Math.round(min)}°C - ${Math.round(max)}°C`;
}

/**
 * Formats wind speed in km/h.
 */
export function formatWindSpeed(speed: number | null | undefined): string {
  if (speed === null || speed === undefined || isNaN(speed)) {
    return '-- km/h';
  }
  return `${Math.round(speed)} km/h`;
}

/**
 * Formats precipitation probability percentage and optional amount.
 */
export function formatPrecipitation(probability: number | null | undefined, sumMm?: number | null): string {
  if (probability === null || probability === undefined || isNaN(probability)) {
    if (typeof sumMm === 'number' && sumMm > 0) {
      return `${sumMm.toFixed(1)} mm`;
    }
    return '--';
  }

  const rounded = Math.round(probability);
  if (typeof sumMm === 'number' && sumMm > 0) {
    return `${rounded}% (${sumMm.toFixed(1)} mm)`;
  }
  return `${rounded}%`;
}
