import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggleLang = () => {
        // i18next may return "ru-RU" / "en-US" etc via LanguageDetector
        const current = (i18n.language || '').toLowerCase().split('-')[0]; // 'en', 'ru', 'uz'
        let next = 'ru';
        if (current === 'ru') next = 'uz';
        else if (current === 'uz') next = 'en';
        else next = 'ru';

        i18n.changeLanguage(next);
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggleLang}
            title="Switch Language"
            aria-label="Switch Language"
            className="font-bold rounded-full"
        >
            {i18n.language?.toUpperCase().substring(0, 2)}
        </Button>
    );
}
