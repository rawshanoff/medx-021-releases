import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // i18next may return "ru-RU" / "en-US" etc via LanguageDetector
  const current = (i18n.language || '').toLowerCase().split('-')[0]; // 'en', 'ru', 'uz'
  const value = current === 'ru' || current === 'uz' || current === 'en' ? current : 'ru';

  return (
    <select
      value={value}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      title="Language"
      aria-label="Language"
      className="h-[40px] w-[72px] rounded-full border border-border bg-card/80 px-[12px] text-[14px] font-semibold text-foreground shadow-sm backdrop-blur outline-none focus-visible:ring-[2px] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[2px] focus-visible:ring-offset-[hsl(var(--background))]"
    >
      <option value="ru">RU</option>
      <option value="uz">UZ</option>
      <option value="en">EN</option>
    </select>
  );
}
