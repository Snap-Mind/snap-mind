import { Listbox, ListboxItem } from '@heroui/listbox';
import { Divider } from '@heroui/divider';
import { Bot, Cog, Flame, SquareDashed, MessageCircle } from 'lucide-react';

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
  const renderIcon = (categoryId) => {
    if (categoryId === 'general') return <Cog className="inline-block ml-2" size={18} />;
    if (categoryId === 'models') return <Bot className="inline-block ml-2" size={18} />;
    if (categoryId === 'chat') return <MessageCircle className="inline-block ml-2" size={18} />;
    if (categoryId === 'hotkeys') return <Flame className="inline-block ml-2" size={18} />;
    if (categoryId === 'others') return <SquareDashed className="inline-block ml-2" size={18} />;
    return null;
  };

  const activeStyle = (category) => {
    return category.id === activeCategory.id
      ? 'text-default-foreground bg-default text-default-foreground'
      : '';
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">Settings</h1>
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
