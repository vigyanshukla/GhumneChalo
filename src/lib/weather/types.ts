/**
 * Weather System Types & Contracts for GhumneChalo (Phase 7)
 */

export type WeatherConditionCategory =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

export type WeatherDayStatus =
  | 'available'
  | 'past_unavailable'
  | 'future_unavailable'
  | 'error';

export interface NormalizedWeatherDay {
  date: string; // YYYY-MM-DD
  dayNumber?: number;
  status: WeatherDayStatus;
  statusMessage?: string;
  temperatureMax: number | null;
  temperatureMin: number | null;
  temperatureMean: number | null;
  apparentTemperatureMax: number | null;
  apparentTemperatureMin: number | null;
  precipitationProbability: number | null; // % (0-100)
  precipitationSum: number | null; // mm
  windSpeedMax: number | null; // km/h
  weatherCode: number | null; // WMO code
  condition: string; // Human-readable e.g. "Sunny", "Partly Cloudy", "Rain", etc.
  conditionCategory: WeatherConditionCategory;
  formattedTemp: string; // e.g. "28°C"
  formattedTempRange: string; // e.g. "22°C - 31°C"
  formattedWind: string; // e.g. "14 km/h"
  formattedPrecipitation: string; // e.g. "20% chance"
}

export interface CurrentWeatherInfo {
  temperature: number | null;
  apparentTemperature: number | null;
  weatherCode: number | null;
  condition: string;
  conditionCategory: WeatherConditionCategory;
  windSpeed: number | null;
  precipitation: number | null;
  formattedTemp: string;
}

export interface NormalizedTripWeather {
  tripId: string;
  destinationName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  current: CurrentWeatherInfo | null;
  days: NormalizedWeatherDay[];
  summary: {
    tempRange: string;
    predominantCondition: string;
    hasRainExpected: boolean;
    maxRainChance: number;
  };
  fetchedAt: string;
  isCached: boolean;
  isStale: boolean;
  warning?: string;
}

export interface OpenMeteoRawResponse {
  latitude: number;
  longitude: number;
  generationtime_ms?: number;
  utc_offset_seconds?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  elevation?: number;
  current?: {
    time: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    apparent_temperature_max?: number[];
    apparent_temperature_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
  error?: boolean;
  reason?: string;
}
