export const COUNTRIES = {
  US: { code: 'US', name: 'United States', flag: '🇺🇸' },
  GB: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  CA: { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  AU: { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  DE: { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  FR: { code: 'FR', name: 'France', flag: '🇫🇷' },
  IT: { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  ES: { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  NL: { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  BR: { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  IN: { code: 'IN', name: 'India', flag: '🇮🇳' },
  CN: { code: 'CN', name: 'China', flag: '🇨🇳' },
  JP: { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  CH: { code: 'CH', name: 'Switzerland', flag: '🇨🇭' }
};

export const LANGUAGES = {
  en: { code: 'en', name: 'English', nativeName: 'English' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
};

export const TIMEZONES = [
  { value: 'UTC', label: 'UTC - Coordinated Universal Time', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-06:00' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)', offset: '+01:00' },
  { value: 'Europe/Rome', label: 'Central European Time (CET)', offset: '+01:00' },
  { value: 'Europe/Madrid', label: 'Central European Time (CET)', offset: '+01:00' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offset: '+08:00' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offset: '+05:30' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)', offset: '+10:00' },
  { value: 'America/Sao_Paulo', label: 'Brasília Time (BRT)', offset: '-03:00' }
];

export const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)', example: '12/31/2024' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)', example: '31/12/2024' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)', example: '2024-12-31' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (DE)', example: '31.12.2024' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '31-12-2024' }
];

export const TIME_FORMATS = [
  { value: '12h', label: '12-hour (AM/PM)', example: '02:30 PM' },
  { value: '24h', label: '24-hour', example: '14:30' }
];

export interface UserSettings {
  currency_code: string;
  timezone: string;
  country_code: string;
  language_code: string;
  date_format: string;
  time_format: string;
}

export const formatDateWithUserSettings = (date: Date, settings: UserSettings): string => {
  const { date_format, timezone } = settings;
  
  // Convert to user's timezone
  const userDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  
  const day = userDate.getDate().toString().padStart(2, '0');
  const month = (userDate.getMonth() + 1).toString().padStart(2, '0');
  const year = userDate.getFullYear();
  
  switch (date_format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
};

export const formatTimeWithUserSettings = (date: Date, settings: UserSettings): string => {
  const { time_format, timezone } = settings;
  
  const userDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  
  if (time_format === '24h') {
    const hours = userDate.getHours().toString().padStart(2, '0');
    const minutes = userDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    return userDate.toLocaleString("en-US", {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
};