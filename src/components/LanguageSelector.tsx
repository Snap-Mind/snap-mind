import { useTranslation } from 'react-i18next';
import { Select, SelectItem} from '@heroui/react';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const languages = [
    { key: 'en', label: 'English' },
    { key: 'zh-Hans', label: '简体中文' },
    { key: 'zh-Hant', label: '繁體中文' },
  ];

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <Select
      aria-label='Select language'
      defaultSelectedKeys={[i18n.language]}
      onChange={handleLanguageChange}
      className="max-w-[8rem]"
    >
      {languages.map((lang) => (
        <SelectItem key={lang.key}>
          {lang.label}
        </SelectItem>
      ))}
    </Select>
  );
};
