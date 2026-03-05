import { Listbox, ListboxItem } from '@heroui/listbox';
import { Divider } from '@heroui/divider';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';

interface SettingsCategoryProps {
  categories: {
    id: string;
    name: string;
    path: string;
  }[];
  activeCategory: {
    id: string;
    name: string;
    path: string;
  };
  onCategoryChange?: (id: string) => void;
}

function SettingsCategory({
  categories,
  activeCategory /*onCategoryChange*/,
}: SettingsCategoryProps) {
  const { t } = useTranslation();
  const renderIcon = (categoryId) => {
    if (categoryId === 'general')
      return <Icon icon="cog" className="ml-2 flex items-center justify-center leading-none" size={18} />;
    if (categoryId === 'appearance')
      return (
        <Icon icon="paint-roller" className="ml-2 flex items-center justify-center leading-none" size={18} />
      );
    if (categoryId === 'models')
      return <Icon icon="bot" className="ml-2 flex items-center justify-center leading-none" size={18} />;
    if (categoryId === 'chat')
      return (
        <Icon icon="message-circle" className="ml-2 flex items-center justify-center leading-none" size={18} />
      );
    if (categoryId === 'hotkeys')
      return <Icon icon="flame" className="ml-2 flex items-center justify-center leading-none" size={18} />;
    if (categoryId === 'others')
      return (
        <Icon icon="square-dashed" className="ml-2 flex items-center justify-center leading-none" size={18} />
      );
    return null;
  };

  const activeStyle = (category) => {
    return category.id === activeCategory.id ? 'bg-default' : '';
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <Listbox aria-label="Actions">
          {categories.map((category) => (
            <ListboxItem
              className={activeStyle(category)}
              key={category.id}
              href={category.path}
              startContent={renderIcon(category.id)}
            >
              {category.name}
            </ListboxItem>
          ))}
        </Listbox>
      </div>
    </div>
  );
}

export default SettingsCategory;
