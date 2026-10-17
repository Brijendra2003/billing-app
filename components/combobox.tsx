"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface ComboOption {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Free-text input with suggestions. Typing a value that doesn't match an option is
 * allowed (it becomes a new client/product on save).
 */
export function Combobox({
  value,
  onChange,
  onPick,
  options,
  placeholder,
  className,
  createLabel = "New",
  inputProps,
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (id: string) => void;
  options: ComboOption[];
  placeholder?: string;
  className?: string;
  createLabel?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q))
      : options;
    return list.slice(0, 8);
  }, [value, options]);
  const exact = options.some((o) => o.label.toLowerCase() === value.trim().toLowerCase());

  const pick = (o: ComboOption) => {
    onPick(o.id);
    setOpen(false);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        {...inputProps}
        value={value}
        placeholder={placeholder}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (matches.length > 0 || (value.trim() && !exact)) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {matches.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-brand-50" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span className="font-medium text-slate-800">{o.label}</span>
              {o.sub && <span className="block truncate text-xs text-slate-500">{o.sub}</span>}
            </li>
          ))}
          {value.trim() && !exact && (
            <li className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <span className="font-semibold text-brand-600">＋ {createLabel}:</span> &ldquo;{value.trim()}&rdquo; will be saved
              automatically
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
