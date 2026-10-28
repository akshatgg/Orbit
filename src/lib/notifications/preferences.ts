// Reminder preferences (stored by the Orbit API, which sends the reminders).

export type Preferences = {
  push_enabled: boolean;
  email_enabled: boolean;
  remind_before_hours: number;
  deadline_reminders: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  push_enabled: true,
  email_enabled: true,
  remind_before_hours: 24,
  deadline_reminders: true,
};
