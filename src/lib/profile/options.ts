// Suggestions for the free-text onboarding fields. Users can always type their own.

export const DEPARTMENT_SUGGESTIONS = [
  "Business School",
  "Faculty of Engineering",
  "Faculty of Medicine",
  "Faculty of Natural Sciences",
  "Centre for Environmental Policy",
  "Department of Computing",
] as const;

export const COURSE_SUGGESTIONS = [
  "MSc Management",
  "MSc Finance",
  "MSc Business Analytics",
  "MSc Financial Technology",
  "MSc Strategic Marketing",
  "MSc International Management",
  "MSc Economics & Strategy for Business",
  "MSc Climate Change, Management & Finance",
  "MSc Investment & Wealth Management",
  "MSc Risk Management & Financial Engineering",
  "MSc Innovation, Entrepreneurship & Management",
  "MBA",
] as const;

export const YEAR_OPTIONS = ["1st year", "2nd year", "3rd year", "4th year+", "Master's", "PhD", "Graduated"] as const;

/** Year chips, keeping any custom value already on the profile (e.g. "2026/27") selectable. */
export function yearOptions(current: string) {
  const list: string[] = [...YEAR_OPTIONS];
  if (current && !list.includes(current)) list.unshift(current);
  return list.map((y) => ({ value: y, label: y }));
}
