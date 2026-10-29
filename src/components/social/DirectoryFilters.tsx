"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { inputClass } from "@/components/ui/Field";
import { SocialIcon } from "./icons";
import { ViewToggle } from "./ListView";

/**
 * Search, category and university for the communities directory, plus the grid / list switch:
 * a plain GET form; the dropdowns submit on change and the search on Enter.
 */
export function DirectoryFilters({ category, university, q, categories, universities }: {
  category?: string;
  university?: string;
  q?: string;
  /** [slug, name] for every category any community covers. */
  categories: [string, string][];
  universities: string[];
}) {
  const form = useRef<HTMLFormElement>(null);

  // Empty fields stay out of the URL (`?category=careers`, not `?q=&category=careers&university=`).
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    const prune = (e: FormDataEvent) => {
      for (const [key, value] of [...e.formData.entries()]) if (value === "") e.formData.delete(key);
    };
    el.addEventListener("formdata", prune);
    return () => el.removeEventListener("formdata", prune);
  }, []);

  const submit = () => form.current?.requestSubmit();

  return (
    <form ref={form} method="get" action="/communities" role="search" className="flex flex-wrap items-center gap-2 px-4">
      <label className="relative min-w-0 flex-1 sm:min-w-48">
        <span className="sr-only">Search communities</span>
        <SocialIcon name="community" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search communities" className={`${inputClass} py-2.5 pl-10`} />
      </label>
      {/* Phones: the dropdowns share the second line; wider, everything sits on one. */}
      <div className="order-last flex w-full gap-2 sm:order-none sm:w-auto">
        <Dropdown name="category" label="Category" value={category} onChange={submit} className="sm:w-44 lg:w-52">
          <option value="">All categories</option>
          {categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </Dropdown>
        {universities.length > 0 && (
          <Dropdown name="university" label="University" value={university} onChange={submit} className="sm:w-44 lg:w-56">
            <option value="">All universities</option>
            {universities.map((u) => <option key={u} value={u}>{u}</option>)}
          </Dropdown>
        )}
      </div>
      <ViewToggle />
    </form>
  );
}

function Dropdown({ name, label, value, onChange, className = "", children }: {
  name: string;
  label: string;
  value?: string;
  onChange: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`relative min-w-0 flex-1 sm:flex-none ${className}`}>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} onChange={onChange} className={`${inputClass} cursor-pointer appearance-none truncate py-2.5 pr-9`}>
        {children}
      </select>
      <SocialIcon name="down" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </label>
  );
}
