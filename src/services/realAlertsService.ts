/**
 * Live weather alerts.
 *
 * The notification feed must not contain demo warnings or inferred pest attacks.
 * This service only emits a warning when the current observation from Open-Meteo
 * crosses a conservative safety threshold for the exact coordinates supplied by
 * the user's device.
 */

import { AppNotification } from "../types/notifications";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
}

const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 67, 82, 85, 86]);

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isFiniteLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function safePlaceName(value: string, fallback: string): string {
  const name = value.trim();
  return name || fallback;
}

export async function fetchLiveWeatherAlerts(
  latitude: number,
  longitude: number,
  district: string,
  state: string
): Promise<AppNotification[]> {
  if (!isFiniteCoordinate(latitude) || !isFiniteLongitude(longitude)) return [];

  const place = safePlaceName(district, "your location");
  const region = safePlaceName(state, "");
  const locationLabel = region ? `${place}, ${region}` : place;
  const baseId = `real-weather-${latitude.toFixed(3)}-${longitude.toFixed(3)}`;

  try {
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
    if (!response.ok) return [];

    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current;
    if (!current || !Number.isFinite(current.weather_code)) return [];

    const weatherCode = current.weather_code as number;
    const temperature = current.temperature_2m;
    const windSpeed = current.wind_speed_10m;
    const precipitation = current.precipitation;
    const humidity = current.relative_humidity_2m;
    const now = new Date().toISOString();
    const meta = Number.isFinite(temperature)
      ? { district: place, temperature: `${Math.round(temperature as number)}°C` }
      : { district: place };

    if (THUNDERSTORM_CODES.has(weatherCode)) {
      return [{
        id: `${baseId}-thunderstorm`,
        category: "weather",
        priority: "critical",
        title: `⚡ Thunderstorm/lightning reported near ${locationLabel}`,
        message: `The current weather observation for your coordinates reports thunderstorm or lightning (weather code ${weatherCode}). Move to a safe shelter and avoid open fields until the conditions clear.`,
        timestamp: now,
        read: false,
        actionUrl: "/weather",
        actionLabel: "View current weather",
        iconType: "cloud-rain",
        meta,
      }];
    }

    if (HEAVY_RAIN_CODES.has(weatherCode) || (Number.isFinite(precipitation) && (precipitation as number) >= 10)) {
      return [{
        id: `${baseId}-heavy-rain`,
        category: "weather",
        priority: "warning",
        title: `🌧️ Heavy rain reported near ${locationLabel}`,
        message: `The current observation reports heavy rain for your coordinates${Number.isFinite(precipitation) ? ` (${(precipitation as number).toFixed(1)} mm in the current interval)` : ""}. Pause spraying and check field drainage and stored produce.`,
        timestamp: now,
        read: false,
        actionUrl: "/weather",
        actionLabel: "View current weather",
        iconType: "cloud-rain",
        meta,
      }];
    }

    if (Number.isFinite(windSpeed) && (windSpeed as number) >= 50) {
      return [{
        id: `${baseId}-wind`,
        category: "weather",
        priority: "warning",
        title: `💨 Strong wind reported near ${locationLabel}`,
        message: `The current observation reports wind at ${Math.round(windSpeed as number)} km/h for your coordinates. Secure loose materials and check young crops before the next field operation.`,
        timestamp: now,
        read: false,
        actionUrl: "/weather",
        actionLabel: "View current weather",
        iconType: "cloud-rain",
        meta,
      }];
    }

    if (Number.isFinite(temperature) && (temperature as number) >= 40) {
      return [{
        id: `${baseId}-heat`,
        category: "weather",
        priority: "warning",
        title: `🔥 Extreme heat reported near ${locationLabel}`,
        message: `The current observation reports ${Math.round(temperature as number)}°C at your coordinates${Number.isFinite(humidity) ? ` with ${Math.round(humidity as number)}% humidity` : ""}. Irrigate during the coolest hours and protect workers from heat stress.`,
        timestamp: now,
        read: false,
        actionUrl: "/weather",
        actionLabel: "View current weather",
        iconType: "cloud-rain",
        meta,
      }];
    }

    // Clear conditions are intentionally silent. A notification is for an actionable
    // condition, not a routine "everything is fine" heartbeat.
    return [];
  } catch (error) {
    console.warn("Failed to fetch current weather alerts:", error);
    return [];
  }
}
