import { Listbox, ListboxItem } from '@heroui/listbox';
import { Divider } from '@heroui/divider';
import { useTranslation } from 'react-i18next';

import MindSvg from '../../assets/mind.svg';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function SettingsCategory({
  categories,
  activeCategory,
  isCollapsed = false,
  onToggleCollapse,
}: SettingsCategoryProps) {
  const { t } = useTranslation();
  const renderIcon = (categoryId: string) => {
    const iconClass = isCollapsed
      ? 'flex items-center justify-center leading-none'
      : 'ml-2 flex items-center justify-center leading-none';

    if (categoryId === 'general')
      return <Icon icon="cog" className={iconClass} size={18} />;
    if (categoryId === 'appearance')
      return <Icon icon="paint-roller" className={iconClass} size={18} />;
    if (categoryId === 'models')
      return <Icon icon="bot" className={iconClass} size={18} />;
    if (categoryId === 'chat')
      return <Icon icon="message-circle" className={iconClass} size={18} />;
    if (categoryId === 'hotkeys')
      return <Icon icon="flame" className={iconClass} size={18} />;
    if (categoryId === 'others')
      return <Icon icon="square-dashed" className={iconClass} size={18} />;
    return null;
  };

  const activeStyle = (category: { id: string }) => {
    return category.id === activeCategory.id ? 'bg-default' : '';
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <button
          type="button"
          className={`flex items-center gap-2 cursor-pointer`}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? t('common.brand') : `${t('common.brand')} Toggle`}
        >
          <img src={MindSvg} alt="SnapMind Logo" className="w-8 h-8 shrink-0 ml-1" />
          {!isCollapsed && <h1 className="font-bold text-2xl leading-none tracking-tight">{t('common.brand')}</h1>}
        </button>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <Listbox aria-label="Settings Categories">
          {categories.map((category) => (
            <ListboxItem
              className={`${activeStyle(category)}`}
              key={category.id}
              href={category.path}
              startContent={renderIcon(category.id)}
            >
              {isCollapsed ? '\u00A0' : category.name}
            </ListboxItem>
          ))}
        </Listbox>
      </div>
    </div>
  );
}

export default SettingsCategory;
