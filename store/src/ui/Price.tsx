import { useEffect, useRef, useState } from "react";

const DIGITS = "0123456789".split("");

/**
 * The live price. Each digit is a vertical strip that rolls to its value, so
 * a change reads as the total ticking over rather than text being swapped.
 * Digits are keyed from the right so ₹1,999 → ₹2,049 rolls column by column.
 */
export function Price({ value, className = "" }: { value: number; className?: string }) {
  const text = `₹${Math.round(value).toLocaleString("en-IN")}`;
  const chars = text.split("");
  const prev = useRef(value);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (prev.current !== value) setBump((b) => b + 1);
    prev.current = value;
  }, [value]);

  return (
    <span className={`price-roll ${bump ? `bump-${bump % 2}` : ""} ${className}`} aria-label={text} role="img">
      {chars.map((c, i) => {
        const pos = chars.length - i; // stable key from the right
        if (!/\d/.test(c))
          return (
            <span key={`s${pos}`} aria-hidden>
              {c}
            </span>
          );
        return (
          <span className="roll-digit" key={`d${pos}`} aria-hidden>
            <span className="roll-strip" style={{ transform: `translateY(-${Number(c)}em)` }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
