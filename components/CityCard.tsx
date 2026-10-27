import type { CityForecast } from "@/lib/open-meteo";
import { describeWeather } from "@/lib/weather-codes";
import { DeleteCityButton } from "./DeleteCityButton";

const round = (n: number) => `${Math.round(n)}°`;

export function CityCard({ id, name, weather }: { id: string; name: string; weather?: CityForecast }) {
  const conditions = weather && describeWeather(weather.current.weatherCode, weather.current.isDay);

  return (
    <li className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="w-10 text-center text-3xl" aria-hidden>
        {conditions?.icon ?? "–"}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium">{name}</h2>
        <p className="text-sm text-zinc-500">
          {weather ? `${conditions!.label} · H ${round(weather.today.high)} L ${round(weather.today.low)}` : "Weather unavailable"}
        </p>
      </div>
      {weather && <div className="text-2xl font-semibold tabular-nums">{round(weather.current.temperature)}C</div>}
      <DeleteCityButton id={id} name={name} />
    </li>
  );
}
