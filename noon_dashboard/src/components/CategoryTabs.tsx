import { ChevronDown, Filter } from 'lucide-react';

interface CategoryTabsProps {
  tabs: [string, number][];
  selected: string;
  onChange: (category: string) => void;
  allLabel?: string;
  showAll?: boolean;
}

export function CategoryTabs({ tabs, selected, onChange, allLabel = '全部 (All)', showAll = true }: CategoryTabsProps) {
  return (
    <div className="category-select-wrapper">
      <Filter size={16} className="category-select-icon-left" />
      <select
        className="category-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {showAll && <option value="All">{allLabel}</option>}
        {tabs.map(([cn, count]) => (
          <option key={cn} value={cn}>
            {cn} ({count})
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="category-select-icon-right" />
    </div>
  );
}
