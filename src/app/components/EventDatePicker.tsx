import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchEvents, type EventItem } from "../data/events";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parse(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}
function fmt(iso: string): string {
  if (!iso) return "";
  const { y, m, d } = parse(iso);
  return new Date(y, m, d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface EventDatePickerProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (date: string) => void;
  /** Earliest selectable date (YYYY-MM-DD). Past days are disabled. */
  min?: string;
  /** Classes for the trigger button so it matches the surrounding inputs. */
  className?: string;
  placeholder?: string;
}

/**
 * A compact calendar date picker that also surfaces forthcoming CA events:
 * days with an event show a dot, and hovering a day shows the event name(s).
 * Replaces the native date input so events can be displayed inside the calendar.
 */
export function EventDatePicker({
  value,
  onChange,
  min,
  className = "",
  placeholder = "dd-mm-yyyy",
}: EventDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const base = parse(value || min || todayStr);
  const [viewYear, setViewYear] = useState(base.y);
  const [viewMonth, setViewMonth] = useState(base.m);

  useEffect(() => {
    fetchEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  // When opening, jump to the selected month (or today / min).
  useEffect(() => {
    if (open) {
      const p = parse(value || min || todayStr);
      setViewYear(p.y);
      setViewMonth(p.m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${className} flex items-center justify-between text-left`}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value ? fmt(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg p-3">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">{monthLabel}</span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[11px] text-muted-foreground py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`b-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const ds = ymd(viewYear, viewMonth, day);
              const dayEvents = byDate.get(ds) ?? [];
              const disabled = min ? ds < min : false;
              const selected = ds === value;
              const isToday = ds === todayStr;
              return (
                <button
                  key={ds}
                  type="button"
                  disabled={disabled}
                  title={dayEvents.length ? dayEvents.map((e) => e.title).join(", ") : undefined}
                  onClick={() => {
                    onChange(ds);
                    setOpen(false);
                  }}
                  className={`aspect-square rounded-md flex items-center justify-center text-sm relative transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : disabled
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "hover:bg-accent"
                  } ${isToday && !selected ? "ring-1 ring-primary" : ""}`}
                >
                  {day}
                  {dayEvents.length > 0 && (
                    <span
                      className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        selected ? "bg-primary-foreground" : "bg-primary"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            Dot = forthcoming event (hover for name)
          </p>
        </div>
      )}
    </div>
  );
}
