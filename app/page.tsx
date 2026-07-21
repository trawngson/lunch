"use client";

import { useEffect, useMemo, useState } from "react";

type Dish = {
  name: string;
  kcal: number | null;
};

type Meal = {
  name: string;
  totalKcal: number | null;
  dishes: Dish[];
};

type MenuDay = {
  date: string;
  meals: Meal[];
};

type MenuData = {
  generatedAt: string;
  timezone: string;
  sample?: boolean;
  days: MenuDay[];
};

const dataPath = process.env.NEXT_PUBLIC_MENU_PATH ?? "/api/menu";

function parseDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00+07:00`);
}

function shortWeekday(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parseDate(isoDate));
}

function fullDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parseDate(isoDate));
}

function dateNumber(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parseDate(isoDate));
}

function kcal(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} kcal`;
}

function isToday(isoDate: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return isoDate === `${value("year")}-${value("month")}-${value("day")}`;
}

function isFeaturedDay(isoDate: string) {
  const weekday = parseDate(isoDate).getUTCDay();
  return weekday === 2 || weekday === 4;
}

export default function LunchMenu() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      setError(false);
      try {
        const response = await fetch(dataPath, { cache: "no-store" });
        if (!response.ok) throw new Error("Menu unavailable");
        const payload = (await response.json()) as MenuData;
        if (!Array.isArray(payload.days) || payload.days.length === 0) {
          throw new Error("Menu data is empty");
        }
        if (!cancelled) {
          setMenu(payload);
          setSelectedIndex(0);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const schoolDays = useMemo(
    () =>
      menu?.days.filter((day) => {
        const weekday = parseDate(day.date).getUTCDay();
        return weekday !== 0 && weekday !== 6;
      }) ?? [],
    [menu],
  );
  const selectedDay = schoolDays[selectedIndex] ?? null;
  const dayTotal = useMemo(
    () =>
      selectedDay?.meals.reduce(
        (sum, meal) => sum + (meal.totalKcal ?? 0),
        0,
      ) ?? 0,
    [selectedDay],
  );

  return (
    <main className="page-shell">
      <header className="site-header">
        <h1>lunch<span>.</span></h1>
        {schoolDays.length > 0 && (
          <div className="week-range" aria-label="Displayed date range">
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(parseDate(schoolDays[0].date))}
            <span>—</span>
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(parseDate(schoolDays[schoolDays.length - 1].date))}
          </div>
        )}
      </header>

      <div className="rule" />

      {error ? (
        <section className="state-card" aria-live="polite">
          <p>Menu unavailable.</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </section>
      ) : !menu || !selectedDay ? (
        <section className="state-card" aria-live="polite">
          <p>Loading menu…</p>
        </section>
      ) : (
        <>
          <nav className="date-tabs" aria-label="Choose a school day">
            {schoolDays.map((day, index) => (
              <button
                className={[
                  "date-tab",
                  isFeaturedDay(day.date) ? "featured" : "",
                  index === selectedIndex ? "active" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                key={day.date}
                aria-pressed={index === selectedIndex}
                aria-label={`${isToday(day.date) ? "Today" : shortWeekday(day.date)}, ${dateNumber(day.date)}${isFeaturedDay(day.date) ? ", highlighted" : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="weekday">{isToday(day.date) ? "Today" : shortWeekday(day.date)}</span>
                <span className="date-number">{dateNumber(day.date)}</span>
              </button>
            ))}
          </nav>

          <section className="menu-panel" aria-live="polite">
            <div className="menu-heading">
              <h2>{fullDate(selectedDay.date)}</h2>
              <span>{Math.round(dayTotal)} kcal total</span>
            </div>

            {selectedDay.meals.length === 0 ? (
              <div className="empty-menu">No menu published for this date.</div>
            ) : (
              <div className="meal-grid">
                {selectedDay.meals.map((meal, mealIndex) => (
                  <article className="meal-card" key={`${selectedDay.date}-${meal.name}-${mealIndex}`}>
                    <header>
                      <div>
                        <span className="meal-label">
                          {mealIndex === 0 ? "Lunch" : mealIndex === 1 ? "Snack" : `Meal ${mealIndex + 1}`}
                        </span>
                        <h3>{meal.name}</h3>
                      </div>
                      <strong>{kcal(meal.totalKcal)}</strong>
                    </header>

                    <div className="dish-list">
                      {meal.dishes.map((dish, dishIndex) => (
                        <div className="dish-row" key={`${selectedDay.date}-${dish.name}-${dishIndex}`}>
                          <span
                            className={dish.name.toLocaleLowerCase("vi").includes("kem") ? "dish-name special-treat" : "dish-name"}
                            data-text={dish.name}
                          >
                            {dish.name}
                          </span>
                          <span>{kcal(dish.kcal)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
