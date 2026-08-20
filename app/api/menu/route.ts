import sampleMenu from "../../../public/menu.json";

export const dynamic = "force-static";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MENU_DAY_BUFFER = 8;

function vietnamToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function addDays(date: { year: number; month: number; day: number }, offset: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + offset, 12));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function isoDate(date: { year: number; month: number; day: number }) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function apiDate(date: { year: number; month: number; day: number }) {
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
}

function isWeekday(date: { year: number; month: number; day: number }) {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day, 12)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function nextWeekdays(
  date: { year: number; month: number; day: number },
  count: number,
) {
  const dates = [];
  let offset = 0;

  while (dates.length < count) {
    const candidate = addDays(date, offset);
    if (isWeekday(candidate)) dates.push(candidate);
    offset += 1;
  }

  return dates;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function sanitizeMeal(item: Record<string, unknown>) {
  const dishes = Array.isArray(item.dishes) ? item.dishes : [];
  return {
    name: cleanText(item.meal_type_text),
    totalKcal: cleanNumber(item.kcal),
    dishes: dishes
      .map((dish) => {
        const value = dish as Record<string, unknown>;
        return { name: cleanText(value.content), kcal: cleanNumber(value.kcal) };
      })
      .filter((dish) => dish.name),
  };
}

async function fetchDay(
  date: { year: number; month: number; day: number },
  token: string,
  studentCode: string,
  apiUrl: string,
) {
  const url = new URL(apiUrl);
  url.searchParams.set("student_code", studentCode);
  url.searchParams.set("learning_day", apiDate(date));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      language: "vi",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.is_success !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error("Unexpected upstream response");
  }

  return {
    date: isoDate(date),
    meals: payload.data.items
      .map((item: Record<string, unknown>) => sanitizeMeal(item))
      .filter((meal: { name: string }) => meal.name),
  };
}

export async function GET() {
  const token = process.env.VIN_TOKEN;
  const studentCode = process.env.VIN_STUDENT_CODE;
  const apiUrl = process.env.VIN_API_URL;

  if (!token || !studentCode || !apiUrl) {
    return Response.json(sampleMenu, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  try {
    const today = vietnamToday();
    const dates = nextWeekdays(today, MENU_DAY_BUFFER);
    const days = await Promise.all(
      dates.map((date) => fetchDay(date, token, studentCode, apiUrl)),
    );

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        timezone: TIME_ZONE,
        sample: false,
        days,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Menu unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
