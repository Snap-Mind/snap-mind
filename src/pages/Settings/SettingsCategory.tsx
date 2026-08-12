import { Listbox, ListboxItem } from '@heroui/listbox';
import { Divider } from '@heroui/divider';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import LogoSvg from '@/components/LogoSvg';

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
  onBack?: () => void;
}

function SettingsCategory({ categories, activeCategory, onBack }: SettingsCategoryProps) {
  const { t } = useTranslation();
  const renderIcon = (categoryId: string) => {
    const iconClass = 'ml-2 flex items-center justify-center leading-none';

    if (categoryId === 'general') return <Icon icon="cog" className={iconClass} size={18} />;
    if (categoryId === 'appearance')
      return <Icon icon="paint-roller" className={iconClass} size={18} />;
    if (categoryId === 'models') return <Icon icon="bot" className={iconClass} size={18} />;
    if (categoryId === 'chat')
      return <Icon icon="message-circle" className={iconClass} size={18} />;
    if (categoryId === 'hotkeys') return <Icon icon="flame" className={iconClass} size={18} />;
    if (categoryId === 'others')
      return <Icon icon="square-dashed" className={iconClass} size={18} />;
    return null;
  };

  const activeStyle = (category: { id: string }) => {
    return category.id === activeCategory.id ? 'bg-default' : '';
  };

  return (
    <div className="grid grid-cols-1 grid-rows-[65px_1fr] w-full min-w-0 h-full">
      <div className="header">
        <div className="flex items-center gap-2 min-w-0">
          {onBack ? (
            <button
              type="button"
              className="shrink-0 cursor-pointer ml-1"
              onClick={onBack}
              aria-label="Back to chat"
            >
              <LogoSvg variant="back" className="w-8 h-8 shrink-0" />
            </button>
          ) : (
            <LogoSvg className="w-8 h-8 shrink-0 ml-1" />
          )}
          <h1 className="font-bold text-2xl leading-none tracking-tight whitespace-nowrap">
            {t('common.brand')}
          </h1>
        </div>
        <Divider className="my-4" />
      </div>
      <div className="body min-w-0 overflow-y-auto">
        <Listbox aria-label="Settings Categories">
          {categories.map((category) => (
            <ListboxItem
              className={`${activeStyle(category)}`}
              key={category.id}
              href={category.path}
              startContent={renderIcon(category.id)}
              textValue={category.name}
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
