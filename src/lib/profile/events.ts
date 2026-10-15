/** True once an event is over: past its end time, or past its start when it has no end time. */
export function hasEnded(event: { starts_at: string; ends_at: string | null }, now = new Date()) {
  const end = event.ends_at ?? event.starts_at;
  return new Date(end).getTime() < now.getTime();
}
