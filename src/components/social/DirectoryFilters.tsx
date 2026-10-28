"use client";

import { useRef } from "react";
import { inputClass } from "@/components/ui/Field";
import { SocialIcon } from "./icons";

/** Search + university for the communities directory: a plain GET form that submits on change. */
export function DirectoryFilters({ category, university, q, universities }: {
  category?: string;
  university?: string;
  q?: string;
  universities: string[];
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} method="get" action="/communities" role="search" className="flex flex-col gap-2 px-4 sm:flex-row">
      {category && <input type="hidden" name="category" value={category} />}
      <label className="relative flex-1">
        <span className="sr-only">Search communities</span>
        <SocialIcon name="community" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search communities" className={`${inputClass} py-2.5 pl-10`} />
      </label>
      {universities.length > 0 && (
        <label className="sm:w-60">
          <span className="sr-only">University</span>
          <select
            name="university"
            defaultValue={university ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={`${inputClass} appearance-none py-2.5`}
          >
            <option value="">All universities</option>
            {universities.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      )}
    </form>
  );
}
