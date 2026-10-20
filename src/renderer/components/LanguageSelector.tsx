import { useTranslation } from 'react-i18next';
import { Select, SelectItem } from '@heroui/react';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const languages = [
    { key: 'en', label: 'English' },
    { key: 'zh-Hans', label: '简体中文' },
    { key: 'zh-Hant', label: '繁體中文' },
  ];

  const getBaseLanguageKey = (lang: string) => {
    const supportedKeys = languages.map((l) => l.key);
    if (supportedKeys.includes(lang)) return lang;
    const prefix = lang.split('-')[0];
    if (supportedKeys.includes(prefix)) return prefix;

    return 'en';
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <Select
      className="max-w-[8rem]"
      aria-label="Select language"
      disallowEmptySelection={true}
      defaultSelectedKeys={[getBaseLanguageKey(i18n.language)]}
      onChange={handleLanguageChange}
    >
      {languages.map((lang) => (
        <SelectItem key={lang.key}>{lang.label}</SelectItem>
      ))}
    </Select>
  );
};
