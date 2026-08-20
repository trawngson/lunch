import { mkdir, writeFile } from "node:fs/promises";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MENU_DAY_BUFFER = 8;
const token = process.env.VIN_TOKEN?.trim().replace(/^Bearer\s+/i, "");
const studentCode = process.env.VIN_STUDENT_CODE?.trim();
const apiUrl = process.env.VIN_API_URL?.trim();

if (!token || token.length < 20) {
  throw new Error("VIN_TOKEN is missing or invalid.");
}

if (!studentCode || !/^[A-Za-z0-9_-]{3,40}$/.test(studentCode)) {
  throw new Error("VIN_STUDENT_CODE is missing or invalid.");
}

if (!apiUrl) {
  throw new Error("VIN_API_URL is missing.");
}

function vietnamToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function addDays(date, offset) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + offset, 12));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function isoDate(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function apiDate(date) {
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function sanitizeMeal(item) {
  return {
    name: cleanText(item?.meal_type_text),
    totalKcal: cleanNumber(item?.kcal),
    dishes: Array.isArray(item?.dishes)
      ? item.dishes.map((dish) => ({
          name: cleanText(dish?.content),
          kcal: cleanNumber(dish?.kcal),
        })).filter((dish) => dish.name)
      : [],
  };
}

async function fetchDay(date) {
  const url = new URL(apiUrl);
  url.searchParams.set("student_code", studentCode);
  url.searchParams.set("learning_day", apiDate(date));

  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      authorization: `Bearer ${token}`,
      "cache-control": "no-store",
      language: "vi",
      languageid: "1",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 400) {
    console.log(`No menu published for ${isoDate(date)}.`);
    return { date: isoDate(date), meals: [] };
  }

  if (!response.ok) {
    throw new Error(`Menu request failed for ${isoDate(date)} with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload?.is_success !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error(`Unexpected menu response for ${isoDate(date)}.`);
  }

  return {
    date: isoDate(date),
    meals: payload.data.items.map(sanitizeMeal).filter((meal) => meal.name),
  };
}

const today = vietnamToday();
const days = [];
let offset = 0;

while (days.length < MENU_DAY_BUFFER) {
  const date = addDays(today, offset);
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day, 12)).getUTCDay();
  if (weekday !== 0 && weekday !== 6) {
    days.push(await fetchDay(date));
  }
  offset += 1;
}

const publicMenu = {
  generatedAt: new Date().toISOString(),
  timezone: TIME_ZONE,
  sample: false,
  days,
};

await mkdir("public", { recursive: true });
await writeFile("public/menu.json", `${JSON.stringify(publicMenu, null, 2)}\n`, "utf8");
console.log(`Fetched ${days.length} menu days.`);
