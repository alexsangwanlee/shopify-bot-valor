import Store from 'electron-store';

export interface SettingsSchema {
  webhookUrl?: string;
  theme: 'dark' | 'light';
  piscina: {
    maxThreads: number;
  };
  notifications: boolean;
}

export const settingsStore = new Store<SettingsSchema>({
  defaults: {
    theme: 'dark',
    piscina: {
      maxThreads: 8,
    },
    notifications: true,
  },
});
