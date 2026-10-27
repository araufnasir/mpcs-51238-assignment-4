import "server-only";
import { cacheLife } from "next/cache";

// Open-Meteo needs no API key. All calls happen on the server so we can cache
// responses and turn any failure into one clear "weather service down" state.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5000;

export type CityResult = {
  id: number;
  name: string; // "Chicago, Illinois, United States"
  latitude: number;
  longitude: number;
};

export type CurrentWeather = {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  high: number;
  low: number;
};

type Coordinates = { latitude: number; longitude: number };

// Throws on any network or upstream error. Errors are never cached,
// so the next request (or a Retry click) tries Open-Meteo again.
async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return res.json();
}

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
};

export async function searchCities(query: string): Promise<CityResult[]> {
  "use cache";
  cacheLife("days"); // place names and coordinates rarely change

  const params = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" });
  const data: { results?: GeocodingResult[] } = await getJson(`${GEOCODING_URL}?${params}`);

  // No matches comes back as 200 with no `results` key at all.
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

type ForecastResponse = {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
};

// One request for every saved city. Results are in the same order as `places`.
export async function getCurrentWeather(places: Coordinates[]): Promise<CurrentWeather[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 }); // conditions update every 15 min upstream

  if (places.length === 0) return [];

  const params = new URLSearchParams({
    latitude: places.map((p) => p.latitude).join(","),
    longitude: places.map((p) => p.longitude).join(","),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  const data: ForecastResponse | ForecastResponse[] = await getJson(`${FORECAST_URL}?${params}`);

  // A single location returns an object; several return an array.
  return (Array.isArray(data) ? data : [data]).map((f) => ({
    temperature: f.current.temperature_2m,
    weatherCode: f.current.weather_code,
    isDay: f.current.is_day === 1,
    high: f.daily.temperature_2m_max[0],
    low: f.daily.temperature_2m_min[0],
  }));
}
