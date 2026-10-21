"use client";

import { useState } from "react";
import { TagPicker } from "@/components/organiser/editor/TagPicker";

/**
 * Interest chips plus custom tags for admin forms (sources and events). Server actions read the
 * tags from a hidden comma-separated input, the same format the old text box sent.
 */
export function InterestTagsField({ name, label, defaultValue, error, hint }: {
  name: string;
  label: string;
  defaultValue: string[];
  error?: string;
  hint: string;
}) {
  const [tags, setTags] = useState(defaultValue);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-fg/90">{label}</p>
      <TagPicker value={tags} onChange={setTags} error={error} hint={hint} />
      <input type="hidden" name={name} value={tags.join(", ")} />
    </div>
  );
}
