import { OpenMeteoRawResponse } from './types';

export class OpenMeteoError extends Error {
  constructor(
    message: string,
    public statusCode: number = 502,
    public isClientSafe: boolean = true
  ) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

export interface FetchForecastParams {
  latitude: number;
  longitude: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone?: string;
  timeoutMs?: number;
}

/**
 * Low-level client for Open-Meteo Forecast API.
 * Never leaks raw provider credentials, handles timeouts gracefully,
 * and validates response structure.
 */
export async function fetchOpenMeteoForecast(
  params: FetchForecastParams
): Promise<OpenMeteoRawResponse> {
  const { latitude, longitude, startDate, endDate, timezone = 'auto', timeoutMs = 8000 } = params;

  // Strict coordinate validation
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new OpenMeteoError('Invalid latitude. Must be between -90 and 90.', 400);
  }
  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new OpenMeteoError('Invalid longitude. Must be between -180 and 180.', 400);
  }

  // Strict date format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new OpenMeteoError('Dates must be in YYYY-MM-DD format.', 400);
  }
  if (startDate > endDate) {
    throw new OpenMeteoError('Start date must be on or before end date.', 400);
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
    ].join(',')
  );
  url.searchParams.set(
    'current',
    ['temperature_2m', 'apparent_temperature', 'precipitation', 'weather_code', 'wind_speed_10m'].join(',')
  );
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GhumneChalo-Weather/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let errorMsg = `Open-Meteo returned status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.reason) {
          errorMsg = errJson.reason;
        }
      } catch {
        // Fall back to status text
      }
      throw new OpenMeteoError(`Weather service error: ${errorMsg}`, res.status >= 500 ? 502 : 400);
    }

    const data: OpenMeteoRawResponse = await res.json();

    if (data.error && data.reason) {
      throw new OpenMeteoError(`Weather service error: ${data.reason}`, 400);
    }

    // Validate essential fields in response
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      throw new OpenMeteoError('Malformed response from weather provider: missing coordinates.', 502);
    }

    return data;
  } catch (error: unknown) {
    clearTimeout(timer);
    if (error instanceof OpenMeteoError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenMeteoError('Weather service request timed out.', 504);
    }
    throw new OpenMeteoError(
      'Unable to reach weather service. Please check your connection.',
      502
    );
  }
}
