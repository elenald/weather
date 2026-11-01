'use strict';

/* =========================================================
   Погода — клиентское приложение на Open-Meteo
   ========================================================= */

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const MET_SUN_URL = 'https://api.met.no/weatherapi/sunrise/3.0/sun';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const DEFAULT_PLACE = {
  name: 'Ликино-Дулёво',
  admin1: 'Московская область',
  country: 'Россия',
  latitude: 55.7078,
  longitude: 38.9572,
  timezone: 'Europe/Moscow',
};

const POPULAR_PLACES = [
  DEFAULT_PLACE,
  { name: 'Москва', admin1: 'Москва', country: 'Россия', latitude: 55.7558, longitude: 37.6173, timezone: 'Europe/Moscow' },
  { name: 'Санкт-Петербург', admin1: 'Санкт-Петербург', country: 'Россия', latitude: 59.9386, longitude: 30.3141, timezone: 'Europe/Moscow' },
  { name: 'Казань', admin1: 'Татарстан', country: 'Россия', latitude: 55.7963, longitude: 49.1088, timezone: 'Europe/Moscow' },
  { name: 'Новосибирск', admin1: 'Новосибирская область', country: 'Россия', latitude: 55.0084, longitude: 82.9357, timezone: 'Asia/Novosibirsk' },
  { name: 'Екатеринбург', admin1: 'Свердловская область', country: 'Россия', latitude: 56.8389, longitude: 60.6057, timezone: 'Asia/Yekaterinburg' },
];

const WEATHER = {
  0: { label: 'Ясно', icon: 'clear' },
  1: { label: 'В основном ясно', icon: 'mostly-clear' },
  2: { label: 'Переменная облачность', icon: 'partly' },
  3: { label: 'Пасмурно', icon: 'cloudy' },
  45: { label: 'Туман', icon: 'fog' },
  48: { label: 'Изморозь и туман', icon: 'fog' },
  51: { label: 'Слабая морось', icon: 'drizzle' },
  53: { label: 'Морось', icon: 'drizzle' },
  55: { label: 'Сильная морось', icon: 'drizzle' },
  56: { label: 'Ледяная морось', icon: 'drizzle' },
  57: { label: 'Сильная ледяная морось', icon: 'drizzle' },
  61: { label: 'Небольшой дождь', icon: 'rain' },
  63: { label: 'Дождь', icon: 'rain' },
  65: { label: 'Сильный дождь', icon: 'rain' },
  66: { label: 'Ледяной дождь', icon: 'rain' },
  67: { label: 'Сильный ледяной дождь', icon: 'rain' },
  71: { label: 'Небольшой снег', icon: 'snow' },
  73: { label: 'Снег', icon: 'snow' },
  75: { label: 'Сильный снег', icon: 'snow' },
  77: { label: 'Снежная крупа', icon: 'snow' },
  80: { label: 'Небольшие ливни', icon: 'rain' },
  81: { label: 'Ливни', icon: 'rain' },
  82: { label: 'Сильные ливни', icon: 'rain' },
  85: { label: 'Небольшие снегопады', icon: 'snow' },
  86: { label: 'Сильные снегопады', icon: 'snow' },
  95: { label: 'Гроза', icon: 'thunder' },
  96: { label: 'Гроза с градом', icon: 'thunder' },
  99: { label: 'Сильная гроза с градом', icon: 'thunder' },
};

const COMPASS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];

const numberFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const heroDateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

/* ---------- Storage ---------- */
const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим или переполнение — просто игнорируем */
    }
  },
};

/* ---------- State ---------- */
const state = {
  place: null,
  data: null,
  unit: 'c',
  recents: [],
  suggestions: [],
  activeIndex: -1,
  requestId: 0,
  searchSeq: 0,
  searchTimer: 0,
  controller: null,
  loading: false,
  preferMet: false,
};

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const els = {
  search: $('search'),
  searchInput: $('search-input'),
  searchClear: $('search-clear'),
  suggestions: $('suggestions'),
  refreshBtn: $('refresh-btn'),
  geoBtn: $('geo-btn'),
  unitBtn: $('unit-btn'),
  loadingBar: $('loading-bar'),
  city: $('city'),
  region: $('region'),
  date: $('date'),
  updated: $('updated'),
  heroIcon: $('hero-icon'),
  temp: $('temp'),
  unitMark: $('unit-mark'),
  condition: $('condition'),
  feels: $('feels'),
  chipMax: $('chip-max'),
  chipMin: $('chip-min'),
  chipWind: $('chip-wind'),
  chipPop: $('chip-pop'),
  dFeels: $('d-feels'),
  dFeelsNote: $('d-feels-note'),
  dHumidity: $('d-humidity'),
  dHumidityNote: $('d-humidity-note'),
  dWind: $('d-wind'),
  dWindNote: $('d-wind-note'),
  dPressure: $('d-pressure'),
  dPressureNote: $('d-pressure-note'),
  dPrecip: $('d-precip'),
  dPrecipNote: $('d-precip-note'),
  dUv: $('d-uv'),
  dUvNote: $('d-uv-note'),
  dSunrise: $('d-sunrise'),
  dSunriseNote: $('d-sunrise-note'),
  dSunset: $('d-sunset'),
  dSunsetNote: $('d-sunset-note'),
  hours: $('hours'),
  days: $('days'),
  toast: $('toast'),
};

/* ---------- Helpers ---------- */
function toUnit(celsius) {
  return state.unit === 'f' ? celsius * 9 / 5 + 32 : celsius;
}

function temp(celsius) {
  return `${Math.round(toUnit(celsius))}°`;
}

function windSpeed(ms) {
  return `${numberFmt.format(ms)} м/с`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseLocal(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return new Date(0);
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0)
  );
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function weatherMeta(code) {
  return WEATHER[code] || { label: 'Неизвестно', icon: 'cloudy' };
}

function samePlace(a, b) {
  return Math.abs(a.latitude - b.latitude) < 0.02 && Math.abs(a.longitude - b.longitude) < 0.02;
}

function placeRegion(place) {
  const parts = [place.admin1, place.country].filter(Boolean);
  return parts.filter((part, index) => parts.indexOf(part) === index).join(', ');
}

function uvLabel(value) {
  if (value < 3) return 'Низкий';
  if (value < 6) return 'Умеренный';
  if (value < 8) return 'Высокий';
  if (value < 11) return 'Очень высокий';
  return 'Экстремальный';
}

function themeFor(icon, isDay) {
  switch (icon) {
    case 'clear':
    case 'mostly-clear':
      return isDay ? 'clear-day' : 'clear-night';
    case 'partly':
      return isDay ? 'partly-day' : 'partly-night';
    case 'fog':
      return 'fog';
    case 'drizzle':
    case 'rain':
      return 'rain';
    case 'snow':
      return 'snow';
    case 'thunder':
      return 'thunder';
    default:
      return 'cloudy';
  }
}

function currentHourIndex(data) {
  const key = data.current.time.slice(0, 13);
  const index = data.hourly.time.findIndex((time) => time.slice(0, 13) === key);
  return index >= 0 ? index : 0;
}

/* ---------- Weather icons ---------- */
function iconSvg(name, isDay = true, size = 'md') {
  const cls = `wi wi-${name} wi-${size}`;
  const sun = `
    <circle cx="32" cy="32" r="12.5" fill="#FFD166"/>
    <circle cx="27.5" cy="27.5" r="4" fill="#FFF4CC" opacity=".65"/>
    <g stroke="#FFD166" stroke-width="3.2" stroke-linecap="round">
      <path d="M32 4v7M32 53v7M4 32h7M53 32h7M12.2 12.2l5 5M46.8 46.8l5 5M51.8 12.2l-5 5M17.2 46.8l-5 5"/>
    </g>`;
  const smallSun = `
    <circle cx="23" cy="20" r="8.5" fill="#FFD166"/>
    <g stroke="#FFD166" stroke-width="2.5" stroke-linecap="round">
      <path d="M23 6v4M23 30v4M9 20h4M33 20h4M13.1 10.1l2.8 2.8M30.1 27.1l2.8 2.8M32.9 10.1l-2.8 2.8M15.9 27.1l-2.8 2.8"/>
    </g>`;
  const moon = `
    <path d="M42 8A20 20 0 1 0 58 34 24 24 0 0 1 42 8Z" fill="#E9F0FF"/>
    <circle cx="16" cy="14" r="1.8" fill="#FFFFFF" opacity=".85"/>
    <circle cx="26" cy="8" r="1.2" fill="#FFFFFF" opacity=".7"/>
    <circle cx="12" cy="31" r="1.4" fill="#FFFFFF" opacity=".65"/>`;
  const cloud = '<path d="M46 42H20a8 8 0 0 1-1.2-15.9 12 12 0 0 1 23.2-1.6A8 8 0 0 1 46 42Z" fill="#F3F8FF"/>';
  const backCloud = '<path d="M44 32H27a6 6 0 0 1-1-11.9 9.5 9.5 0 0 1 18.3-1.3A6 6 0 0 1 44 32Z" fill="#DCE8F7" opacity=".55"/>';

  let body = '';

  switch (name) {
    case 'clear':
      body = isDay ? sun : moon;
      break;
    case 'mostly-clear':
      body = isDay
        ? `${smallSun}<g transform="translate(6 6)">${cloud}</g>`
        : `${moon}<g transform="translate(8 8) scale(.78)">${cloud}</g>`;
      break;
    case 'partly':
      body = isDay
        ? `${smallSun}<g transform="translate(3 7)">${cloud}</g>`
        : `${moon}<g transform="translate(6 8) scale(.82)">${cloud}</g>`;
      break;
    case 'cloudy':
      body = `${backCloud}<g transform="translate(2 6)">${cloud}</g>`;
      break;
    case 'fog':
      body = `${backCloud}<g transform="translate(2 2)">${cloud}</g>
        <g stroke="#DCE8F7" stroke-width="3" stroke-linecap="round" opacity=".85">
          <path d="M16 51h32M21 57h22"/>
        </g>`;
      break;
    case 'drizzle':
      body = `<g transform="translate(0 -4)">${cloud}</g>
        <g fill="#9FD8FF">
          <circle cx="24" cy="50" r="2"/>
          <circle cx="33" cy="55" r="2"/>
          <circle cx="42" cy="50" r="2"/>
        </g>`;
      break;
    case 'rain':
      body = `<g transform="translate(0 -5)">${cloud}</g>
        <g stroke="#8FD0FF" stroke-width="3" stroke-linecap="round">
          <path d="M24 48l-1.5 8M33 48l-1.5 8M42 48l-1.5 8"/>
        </g>`;
      break;
    case 'snow':
      body = `<g transform="translate(0 -5)">${cloud}</g>
        <g stroke="#E3F2FF" stroke-width="2" stroke-linecap="round">
          <path d="M22 47v9M18.2 49.2l7.6 4.6M25.8 49.2l-7.6 4.6"/>
          <path d="M33 47v9M29.2 49.2l7.6 4.6M36.8 49.2l-7.6 4.6"/>
          <path d="M44 47v9M40.2 49.2l7.6 4.6M47.8 49.2l-7.6 4.6"/>
        </g>`;
      break;
    case 'thunder':
      body = `<g transform="translate(0 -5)">${cloud}</g>
        <path d="M34 42l-7 12h6l-2 9 10-13h-6l5-8Z" fill="#FFD166"/>`;
      break;
    default:
      body = cloud;
  }

  return `<svg class="${cls}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

/* ---------- Data loading ---------- */
function withTimeout(signal, ms) {
  if (typeof AbortSignal === 'undefined' || !AbortSignal.timeout) return signal;
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal;
}

function localIso(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const hour = String(Number(parts.hour) % 24).padStart(2, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

function timeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function metSymbolToCode(symbol) {
  const s = String(symbol || '').replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  if (s.includes('heavyrain')) return s.includes('shower') ? 82 : 65;
  if (s.includes('rainshower')) return s.includes('light') ? 80 : 81;
  if (s.includes('sleet')) return 66;
  if (s.includes('heavysnow')) return 75;
  if (s.includes('lightsnow')) return 71;
  if (s.includes('snow')) return 73;
  if (s.includes('lightrain')) return 61;
  if (s.includes('rain')) return 63;
  if (s.includes('fog')) return 45;
  if (s === 'partlycloudy') return 2;
  if (s === 'cloudy') return 3;
  if (s === 'fair') return 1;
  if (s === 'clearsky') return 0;
  return 3;
}

function isDaySymbol(symbol, time) {
  if (/_night$/.test(symbol)) return false;
  if (/_day$/.test(symbol) || /_polartwilight$/.test(symbol)) return true;
  const hour = Number(time.slice(11, 13));
  return hour >= 7 && hour < 19;
}

function apparentTemperature(t, humidity, wind) {
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return t + 0.33 * e - 0.7 * wind - 4;
}

function dewPoint(t, humidity) {
  const rh = Math.min(100, Math.max(1, humidity));
  const gamma = Math.log(rh / 100) + (17.27 * t) / (237.7 + t);
  return (237.7 * gamma) / (17.27 - gamma);
}

function pickDayCode(hours) {
  let best = hours[0];
  let bestDiff = Infinity;
  hours.forEach((hour) => {
    const minutes = Number(hour.time.slice(11, 13)) * 60 + Number(hour.time.slice(14, 16));
    const diff = Math.abs(minutes - 720);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = hour;
    }
  });
  return best.code;
}

async function fetchOpenMeteo(place, signal) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'ms',
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'dew_point_2m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'weather_code',
      'is_day',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'uv_index_max',
    ].join(','),
  });

  const response = await fetch(`${FORECAST_URL}?${params}`, { signal: withTimeout(signal, 4500) });
  if (!response.ok) throw new Error(`Forecast HTTP ${response.status}`);
  const data = await response.json();
  data.source = 'Open-Meteo';
  return data;
}

async function fetchMetSunrise(place, dateKey, timeZone, signal) {
  const offset = formatOffset(timeZoneOffset(new Date(), timeZone));
  const params = new URLSearchParams({
    lat: place.latitude.toFixed(4),
    lon: place.longitude.toFixed(4),
    date: dateKey,
    offset,
  });

  try {
    const response = await fetch(`${MET_SUN_URL}?${params}`, { signal: withTimeout(signal, 8000) });
    if (!response.ok) return { sunrise: null, sunset: null };
    const json = await response.json();
    const sunrise = json.properties?.sunrise?.time || null;
    const sunset = json.properties?.sunset?.time || null;
    return { sunrise, sunset };
  } catch {
    return { sunrise: null, sunset: null };
  }
}

async function fetchMetForecast(place, signal) {
  const params = new URLSearchParams({
    lat: place.latitude.toFixed(4),
    lon: place.longitude.toFixed(4),
  });

  const response = await fetch(`${MET_URL}?${params}`, { signal: withTimeout(signal, 12000) });
  if (!response.ok) throw new Error(`MET HTTP ${response.status}`);
  const json = await response.json();

  const series = json.properties?.timeseries || [];
  if (!series.length) throw new Error('MET: пустой ответ');

  const timeZone = place.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = Date.now();

  const hours = series.map((item) => {
    const date = new Date(item.time);
    const details = item.data.instant.details;
    const symbol = item.data.next_1_hours?.summary?.symbol_code
      || item.data.next_6_hours?.summary?.symbol_code
      || item.data.next_12_hours?.summary?.symbol_code
      || '';
    const time = localIso(date, timeZone);
    const precipitation = item.data.next_1_hours?.details?.precipitation_amount
      ?? item.data.next_6_hours?.details?.precipitation_amount
      ?? 0;

    return {
      date,
      time,
      temperature: details.air_temperature,
      humidity: details.relative_humidity,
      pressure: details.air_pressure_at_sea_level,
      windSpeed: details.wind_speed,
      windDirection: details.wind_from_direction,
      cloud: details.cloud_area_fraction,
      code: metSymbolToCode(symbol),
      isDay: isDaySymbol(symbol, time),
      precipitation,
    };
  });

  let currentIndex = 0;
  for (let i = 0; i < hours.length; i += 1) {
    if (hours[i].date.getTime() <= now) currentIndex = i;
    else break;
  }
  const currentHour = hours[currentIndex];

  const dayKeys = [];
  const dayHours = new Map();
  hours.forEach((hour) => {
    const key = hour.time.slice(0, 10);
    if (!dayHours.has(key)) {
      dayHours.set(key, []);
      dayKeys.push(key);
    }
    dayHours.get(key).push(hour);
  });

  const days = dayKeys.slice(0, 7).map((key) => {
    const list = dayHours.get(key);
    const temps = list.map((hour) => hour.temperature);
    return {
      key,
      code: pickDayCode(list),
      max: Math.max(...temps),
      min: Math.min(...temps),
      wind: Math.max(...list.map((hour) => hour.windSpeed)),
    };
  });

  const sun = await fetchMetSunrise(place, days[0].key, timeZone, signal);

  const data = {
    source: 'MET Norway',
    current: {
      time: currentHour.time,
      temperature_2m: currentHour.temperature,
      relative_humidity_2m: currentHour.humidity,
      apparent_temperature: apparentTemperature(
        currentHour.temperature,
        currentHour.humidity,
        currentHour.windSpeed
      ),
      is_day: currentHour.isDay ? 1 : 0,
      precipitation: currentHour.precipitation,
      weather_code: currentHour.code,
      cloud_cover: currentHour.cloud,
      pressure_msl: currentHour.pressure,
      wind_speed_10m: currentHour.windSpeed,
      wind_direction_10m: currentHour.windDirection,
      wind_gusts_10m: Math.round(currentHour.windSpeed * 1.7 * 10) / 10,
      dew_point_2m: dewPoint(currentHour.temperature, currentHour.humidity),
    },
    hourly: {
      time: hours.map((hour) => hour.time),
      temperature_2m: hours.map((hour) => hour.temperature),
      precipitation_probability: hours.map(() => null),
      weather_code: hours.map((hour) => hour.code),
      is_day: hours.map((hour) => (hour.isDay ? 1 : 0)),
    },
    daily: {
      time: days.map((day) => day.key),
      weather_code: days.map((day) => day.code),
      temperature_2m_max: days.map((day) => day.max),
      temperature_2m_min: days.map((day) => day.min),
      sunrise: days.map((day, index) => (index === 0 ? sun.sunrise : null)),
      sunset: days.map((day, index) => (index === 0 ? sun.sunset : null)),
      precipitation_probability_max: days.map(() => null),
      wind_speed_10m_max: days.map((day) => day.wind),
      uv_index_max: days.map(() => null),
    },
  };

  return data;
}

async function fetchForecast(place, signal) {
  if (state.preferMet) {
    try {
      return await fetchMetForecast(place, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('MET Norway недоступен, пробуем Open-Meteo:', error?.message || error);
      const data = await fetchOpenMeteo(place, signal);
      state.preferMet = false;
      storage.set('weather.provider', null);
      return data;
    }
  }

  try {
    return await fetchOpenMeteo(place, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('Open-Meteo недоступен, переключаемся на MET Norway:', error?.message || error);
    state.preferMet = true;
    storage.set('weather.provider', { name: 'met', until: Date.now() + 6 * 60 * 60 * 1000 });
    return fetchMetForecast(place, signal);
  }
}


async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(
      `${REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=ru`,
      { signal: AbortSignal.timeout?.(8000) }
    );
    if (!response.ok) throw new Error('Reverse geocode failed');
    const json = await response.json();
    return {
      name: json.city || json.locality || json.principalSubdivision || 'Моё местоположение',
      admin1: json.principalSubdivision || '',
      country: json.countryName || '',
      latitude,
      longitude,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    };
  } catch {
    return {
      name: 'Моё местоположение',
      admin1: '',
      country: '',
      latitude,
      longitude,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    };
  }
}

function updatePlaceHeader(place) {
  els.city.textContent = place.name;
  els.region.textContent = placeRegion(place);
  document.title = `${place.name} — Погода`;
  if (!state.data) {
    els.date.textContent = capitalize(heroDateFmt.format(new Date()));
  }
}

async function loadWeather(place, { save = true } = {}) {
  const requestId = ++state.requestId;
  const isNewPlace = !state.place || !samePlace(state.place, place);
  state.place = place;

  if (isNewPlace) {
    state.data = null;
    resetView();
  }

  updatePlaceHeader(place);
  setLoading(true);

  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  const timeoutId = setTimeout(() => controller.abort(), 24000);

  try {
    const data = await fetchForecast(place, controller.signal);
    if (requestId !== state.requestId) return;
    state.data = data;
    render();
    if (save) savePlace(place);
    markUpdated();
  } catch (error) {
    if (error.name === 'AbortError') {
      if (requestId === state.requestId) {
        showToast('Сервер погоды не ответил. Попробуйте обновить прогноз.');
      }
      return;
    }
    console.error(error);
    showToast('Не удалось загрузить прогноз. Проверьте соединение и попробуйте ещё раз.');
  } finally {
    clearTimeout(timeoutId);
    if (requestId === state.requestId) setLoading(false);
  }
}

function savePlace(place) {
  storage.set('weather.place', place);
  const list = state.recents.filter((item) => !samePlace(item, place));
  list.unshift(place);
  state.recents = list.slice(0, 5);
  storage.set('weather.recents', state.recents);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.loadingBar.classList.toggle('active', isLoading);
  els.refreshBtn.classList.toggle('busy', isLoading);
  els.refreshBtn.setAttribute('aria-busy', String(isLoading));
}

function markUpdated() {
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  const source = state.data?.source;
  els.updated.textContent = `обновлено в ${time}${source ? ` · ${source}` : ''}`;
}

function resetView() {
  els.temp.textContent = '—';
  els.condition.textContent = 'Загрузка прогноза…';
  els.feels.textContent = 'Ощущается как —';
  els.chipMax.textContent = '—';
  els.chipMin.textContent = '—';
  els.chipWind.textContent = '—';
  els.chipPop.textContent = '—';
  els.heroIcon.innerHTML = '';
  els.hours.innerHTML = '';
  els.days.innerHTML = '';
  els.updated.textContent = 'обновление…';

  [els.dFeels, els.dHumidity, els.dWind, els.dPressure, els.dPrecip, els.dUv, els.dSunrise, els.dSunset]
    .forEach((el) => { el.textContent = '—'; });

  [els.dFeelsNote, els.dHumidityNote, els.dWindNote, els.dPressureNote, els.dPrecipNote, els.dUvNote, els.dSunriseNote, els.dSunsetNote]
    .forEach((el) => { el.textContent = ''; });
}

/* ---------- Rendering ---------- */
function render() {
  const data = state.data;
  if (!data) return;

  const current = data.current;
  const daily = data.daily;
  const meta = weatherMeta(current.weather_code);
  const isDay = current.is_day === 1;
  const hourIndex = currentHourIndex(data);
  const pop = data.hourly.precipitation_probability?.[hourIndex] ?? null;
  const dayMax = daily.temperature_2m_max[0];
  const dayMin = daily.temperature_2m_min[0];

  document.body.dataset.theme = themeFor(meta.icon, isDay);

  /* Hero */
  els.city.textContent = state.place.name;
  els.region.textContent = placeRegion(state.place);
  els.date.textContent = capitalize(heroDateFmt.format(parseLocal(current.time)));
  els.heroIcon.innerHTML = iconSvg(meta.icon, isDay, 'hero');
  els.temp.textContent = Math.round(toUnit(current.temperature_2m));
  els.unitMark.textContent = state.unit === 'f' ? '°F' : '°C';
  els.condition.textContent = meta.label;
  els.feels.textContent = `Ощущается как ${temp(current.apparent_temperature)}`;
  els.chipMax.textContent = temp(dayMax);
  els.chipMin.textContent = temp(dayMin);
  els.chipWind.textContent = windSpeed(current.wind_speed_10m);
  els.chipPop.textContent = pop == null ? '—' : `${Math.round(pop)}%`;

  /* Details */
  const feelsDiff = Math.round(toUnit(current.apparent_temperature) - toUnit(current.temperature_2m));
  els.dFeels.textContent = temp(current.apparent_temperature);
  els.dFeelsNote.textContent = feelsDiff === 0
    ? 'Совпадает с фактической'
    : feelsDiff < 0
      ? `Холоднее на ${Math.abs(feelsDiff)}°`
      : `Теплее на ${feelsDiff}°`;

  els.dHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  els.dHumidityNote.textContent = `Точка росы ${temp(current.dew_point_2m)}`;

  const directionIndex = Math.round(current.wind_direction_10m / 45) % 8;
  els.dWind.textContent = windSpeed(current.wind_speed_10m);
  els.dWindNote.textContent = `${COMPASS[directionIndex]} · порывы ${numberFmt.format(current.wind_gusts_10m)} м/с`;

  const pressureHpa = Math.round(current.pressure_msl);
  els.dPressure.textContent = `${Math.round(pressureHpa * 0.750062)} мм`;
  els.dPressureNote.textContent = `${pressureHpa} гПа`;

  els.dPrecip.textContent = `${numberFmt.format(current.precipitation)} мм`;
  els.dPrecipNote.textContent = pop == null ? 'Вероятность неизвестна' : `Вероятность ${Math.round(pop)}%`;

  const uv = daily.uv_index_max?.[0];
  els.dUv.textContent = uv == null ? '—' : numberFmt.format(uv);
  els.dUvNote.textContent = uv == null ? 'Нет данных' : uvLabel(uv);

  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];

  if (sunrise && sunset) {
    els.dSunrise.textContent = sunrise.slice(11, 16);
    els.dSunriseNote.textContent = 'Начало светового дня';
    els.dSunset.textContent = sunset.slice(11, 16);
    els.dSunsetNote.textContent = `Световой день ${daylight(sunrise, sunset)}`;
  } else {
    els.dSunrise.textContent = '—';
    els.dSunriseNote.textContent = 'Нет данных';
    els.dSunset.textContent = '—';
    els.dSunsetNote.textContent = 'Нет данных';
  }

  renderHours(hourIndex);
  renderDays();
}

function daylight(sunrise, sunset) {
  const minutes = Math.round((parseLocal(sunset) - parseLocal(sunrise)) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

function renderHours(startIndex) {
  const data = state.data;
  const total = data.hourly.time.length;
  const end = Math.min(startIndex + 24, total);
  const rows = [];

  for (let i = startIndex; i < end; i += 1) {
    const meta = weatherMeta(data.hourly.weather_code[i]);
    const isDay = data.hourly.is_day[i] === 1;
    const time = i === startIndex ? 'Сейчас' : data.hourly.time[i].slice(11, 16);
    const probability = data.hourly.precipitation_probability?.[i] ?? null;
    const rain = probability != null && probability >= 5 ? `${Math.round(probability)}%` : '';

    rows.push(`
      <div class="hour${i === startIndex ? ' now' : ''}">
        <span class="hour-time">${time}</span>
        ${iconSvg(meta.icon, isDay, 'sm')}
        <span class="hour-temp">${temp(data.hourly.temperature_2m[i])}</span>
        <span class="hour-rain">${rain}</span>
      </div>`);
  }

  els.hours.innerHTML = rows.join('');
}

function renderDays() {
  const daily = state.data.daily;
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = Math.max(weekMax - weekMin, 1);
  const rows = [];

  for (let i = 0; i < daily.time.length; i += 1) {
    const date = parseLocal(`${daily.time[i]}T12:00`);
    let name = capitalize(weekdayFmt.format(date).replace('.', ''));
    if (i === 0) name = 'Сегодня';
    if (i === 1) name = 'Завтра';

    const meta = weatherMeta(daily.weather_code[i]);
    const rawProbability = daily.precipitation_probability_max?.[i];
    const probability = rawProbability == null ? null : Math.round(rawProbability);
    const showProbability = probability != null && probability >= 5;
    const low = daily.temperature_2m_min[i];
    const high = daily.temperature_2m_max[i];

    let left = ((low - weekMin) / span) * 100;
    let width = Math.max(((high - low) / span) * 100, 7);
    if (left + width > 100) left = 100 - width;
    left = Math.max(0, left);

    rows.push(`
      <div class="day">
        <div class="day-name">${name}<small>${shortDateFmt.format(date)}</small></div>
        ${iconSvg(meta.icon, true, 'sm')}
        <div class="day-precip${showProbability ? '' : ' empty'}" title="Вероятность осадков">${showProbability ? `${probability}%` : '—'}</div>
        <div class="range" aria-hidden="true"><div class="range-fill" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></div></div>
        <div class="day-temps"><span class="min">${temp(low)}</span><span class="max">${temp(high)}</span></div>
      </div>`);
  }

  els.days.innerHTML = rows.join('');
}

/* ---------- Search ---------- */
function closeSuggestions() {
  els.suggestions.hidden = true;
  els.searchInput.setAttribute('aria-expanded', 'false');
  els.searchInput.removeAttribute('aria-activedescendant');
  state.activeIndex = -1;
}

function renderSuggestions(list, { label = '', message = '' } = {}) {
  state.suggestions = list;
  state.activeIndex = -1;
  els.searchInput.removeAttribute('aria-activedescendant');

  if (message) {
    els.suggestions.innerHTML = `<div class="suggestions-empty">${escapeHtml(message)}</div>`;
    els.suggestions.hidden = false;
    els.searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  if (!list.length) {
    els.suggestions.innerHTML = '<div class="suggestions-empty">Ничего не найдено. Попробуйте другое название.</div>';
    els.suggestions.hidden = false;
    els.searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  const items = list.map((place, index) => {
    const region = placeRegion(place);
    return `
      <button class="suggestion" type="button" role="option" aria-selected="false" id="suggestion-${index}" data-index="${index}">
        <span class="suggestion-pin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/>
            <circle cx="12" cy="10" r="2.5"/>
          </svg>
        </span>
        <span class="suggestion-text">
          <strong>${escapeHtml(place.name)}</strong>
          ${region ? `<small>${escapeHtml(region)}</small>` : ''}
        </span>
        <span class="suggestion-go">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6"/>
          </svg>
        </span>
      </button>`;
  });

  els.suggestions.innerHTML = `${label ? `<div class="suggestions-label">${escapeHtml(label)}</div>` : ''}${items.join('')}`;
  els.suggestions.hidden = false;
  els.searchInput.setAttribute('aria-expanded', 'true');
}

function showDefaults() {
  if (state.recents.length) {
    renderSuggestions(state.recents, { label: 'Недавние' });
  } else {
    renderSuggestions(POPULAR_PLACES, { label: 'Популярные города' });
  }
}

async function searchCities(query) {
  const seq = ++state.searchSeq;

  try {
    const params = new URLSearchParams({
      name: query,
      count: '6',
      language: 'ru',
      format: 'json',
    });
    const response = await fetch(`${GEOCODE_URL}?${params}`, { signal: AbortSignal.timeout?.(8000) });
    if (!response.ok) throw new Error(`Geocode HTTP ${response.status}`);
    const json = await response.json();
    if (seq !== state.searchSeq) return;

    const results = (json.results || []).map((item) => ({
      name: item.name,
      admin1: item.admin1 || '',
      country: item.country || '',
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone || '',
    }));

    if (!results.length) {
      renderSuggestions([], { message: 'Ничего не найдено. Попробуйте другое название.' });
    } else {
      renderSuggestions(results);
    }
  } catch (error) {
    if (seq !== state.searchSeq) return;
    console.error(error);
    renderSuggestions([], { message: 'Не удалось выполнить поиск. Проверьте соединение.' });
  }
}

function choosePlace(place) {
  if (!place) return;
  closeSuggestions();
  els.searchInput.value = '';
  els.searchClear.hidden = true;
  els.searchInput.blur();
  loadWeather(place, { save: true });
}

function moveActive(delta) {
  const buttons = [...els.suggestions.querySelectorAll('.suggestion')];
  if (!buttons.length) return;

  state.activeIndex = (state.activeIndex + delta + buttons.length) % buttons.length;
  buttons.forEach((button, index) => {
    const active = index === state.activeIndex;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    if (active) button.scrollIntoView({ block: 'nearest' });
  });

  els.searchInput.setAttribute('aria-activedescendant', buttons[state.activeIndex].id);
}

/* ---------- Geolocation ---------- */
function locateMe() {
  if (!navigator.geolocation) {
    showToast('Геолокация не поддерживается этим браузером.');
    return;
  }

  els.geoBtn.classList.add('busy');
  els.geoBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const place = await reverseGeocode(latitude, longitude);
      els.geoBtn.classList.remove('busy');
      els.geoBtn.disabled = false;
      loadWeather(place, { save: true });
    },
    (error) => {
      console.error(error);
      els.geoBtn.classList.remove('busy');
      els.geoBtn.disabled = false;
      showToast('Не удалось определить местоположение. Разрешите доступ к геолокации.');
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
  );
}

/* ---------- Toast ---------- */
let toastTimer = 0;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 4200);
}

/* ---------- Units ---------- */
function updateUnitButton() {
  els.unitBtn.textContent = state.unit === 'f' ? '°F' : '°C';
  els.unitBtn.setAttribute(
    'aria-label',
    state.unit === 'f' ? 'Переключить на градусы Цельсия' : 'Переключить на градусы Фаренгейта'
  );
  els.unitBtn.title = state.unit === 'f' ? 'Показать в градусах Цельсия' : 'Показать в градусах Фаренгейта';
}

/* ---------- Events ---------- */
function bindEvents() {
  els.searchInput.addEventListener('input', () => {
    const query = els.searchInput.value.trim();
    els.searchClear.hidden = query.length === 0;
    clearTimeout(state.searchTimer);
    state.searchSeq += 1;

    if (!query) {
      showDefaults();
      return;
    }

    renderSuggestions([], { message: 'Ищем города…' });
    state.searchTimer = setTimeout(() => searchCities(query), 280);
  });

  els.searchInput.addEventListener('focus', () => {
    if (state.suggestions.length && !els.suggestions.hidden) return;
    const query = els.searchInput.value.trim();
    if (query) {
      searchCities(query);
    } else {
      showDefaults();
    }
  });

  els.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (els.suggestions.hidden) showDefaults();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter') {
      if (!els.suggestions.hidden) {
        event.preventDefault();
        const place = state.activeIndex >= 0
          ? state.suggestions[state.activeIndex]
          : state.suggestions[0];
        choosePlace(place);
      }
    } else if (event.key === 'Escape') {
      closeSuggestions();
      els.searchInput.blur();
    }
  });

  els.searchClear.addEventListener('click', () => {
    els.searchInput.value = '';
    els.searchClear.hidden = true;
    els.searchInput.focus();
    showDefaults();
  });

  els.suggestions.addEventListener('pointerdown', (event) => event.preventDefault());
  els.suggestions.addEventListener('click', (event) => {
    const button = event.target.closest('.suggestion');
    if (!button) return;
    choosePlace(state.suggestions[Number(button.dataset.index)]);
  });

  document.addEventListener('click', (event) => {
    if (!els.search.contains(event.target)) closeSuggestions();
  });

  els.refreshBtn.addEventListener('click', () => {
    if (state.place && !state.loading) loadWeather(state.place, { save: false });
  });

  els.geoBtn.addEventListener('click', locateMe);

  els.unitBtn.addEventListener('click', () => {
    state.unit = state.unit === 'f' ? 'c' : 'f';
    storage.set('weather.unit', state.unit);
    updateUnitButton();
    if (state.data) render();
  });
}

/* ---------- Init ---------- */
function init() {
  const savedUnit = storage.get('weather.unit', 'c');
  state.unit = savedUnit === 'f' ? 'f' : 'c';

  const provider = storage.get('weather.provider', null);
  state.preferMet = provider?.name === 'met' && Number(provider.until) > Date.now();

  const recents = storage.get('weather.recents', []);
  state.recents = Array.isArray(recents)
    ? recents.filter((place) => place && typeof place.latitude === 'number' && typeof place.longitude === 'number')
    : [];

  const savedPlace = storage.get('weather.place', null);
  const initial = savedPlace && typeof savedPlace.latitude === 'number' && typeof savedPlace.longitude === 'number'
    ? savedPlace
    : DEFAULT_PLACE;

  updateUnitButton();
  updatePlaceHeader(initial);
  bindEvents();
  loadWeather(initial, { save: !savedPlace });
}

init();
