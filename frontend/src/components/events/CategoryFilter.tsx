import React from 'react';
import { useTranslations } from 'next-intl';
import { EventCategory } from '@/types/api';
import { FilterChip } from '@/components/ui/FilterChip';
import { CategoryFilter as CategoryFilterValue, EVENT_CATEGORIES } from '@/lib/events';

export interface CategoryFilterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}

// Same hues as the category badges (§1.4), at -500 so the dot reads on both light and dark chips.
const categoryDots: Record<EventCategory, string> = {
  Tech: 'bg-lime-500',
  Media: 'bg-violet-500',
  Music: 'bg-indigo-500',
  Sports: 'bg-teal-500',
  Business: 'bg-orange-500',
  Gaming: 'bg-fuchsia-500',
  EventsOrganization: 'bg-sky-500',
};

// "All" + one chip per category, single choice. Phones: one row that scrolls sideways, bleeding to the
// screen edge (negative margin = page padding). py-1 leaves room for the focus ring, which the scroll box
// would otherwise clip. From md: the chips wrap onto more lines instead.
export const CategoryFilter = React.forwardRef<HTMLDivElement, CategoryFilterProps>(
  ({ value, onChange, className = '', ...props }, ref) => {
    const t = useTranslations('Feed');
    const tCategory = useTranslations('Categories');
    return (
      <div
        ref={ref}
        role="group"
        aria-label={t('categories')}
        className={`-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
        {...props}
      >
        <FilterChip isSelected={value === 'all'} onClick={() => onChange('all')}>
          {t('allCategories')}
        </FilterChip>
        {EVENT_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            isSelected={value === category}
            dotClassName={categoryDots[category]}
            onClick={() => onChange(category)}
          >
            {tCategory(category)}
          </FilterChip>
        ))}
      </div>
    );
  }
);

CategoryFilter.displayName = 'CategoryFilter';
