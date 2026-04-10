---
name: icon-usage
description: >-
  Enforce centralized icon usage through the Icon component. Use when adding,
  using, or referencing icons in any component. All icons must go through
  src/components/Icon.tsx — never import react-icons directly in other files.
---

# Icon Usage Convention

## Rule

**All icons in this project MUST be used through the centralized `Icon` component at `src/components/Icon.tsx`.**

Never import icons directly from `react-icons/*` or any icon library in page/feature components.

## How to Use an Icon

```tsx
import Icon from '@/components/Icon';

<Icon icon="github" size={18} />
<Icon icon="heart" size={12} className="text-danger" />
```

## Adding a New Icon

When you need an icon that doesn't exist in the `Icon` component yet, update `src/components/Icon.tsx`:

1. Add the import from `react-icons/lu` (Lucide) or the appropriate library
2. Add the icon name to the `IconType` union type (keep alphabetical order)
3. Add the `case` in the `renderIcon` switch statement (keep alphabetical order)
4. Use `<Icon icon="your-new-icon" />` in your component

## Prohibited Pattern

```tsx
// WRONG — never do this in page/feature components
import { LuGithub, LuHeart } from 'react-icons/lu';

<LuGithub size={18} />
```

## Existing Icon Names

Check the `IconType` union in `src/components/Icon.tsx` for all available icons. The naming convention follows Lucide's kebab-case (e.g. `circle-check-big`, `external-link`, `file-text`).

## Icon Libraries

- Primary: `react-icons/lu` (Lucide icons)
- Secondary: `react-icons/md` (Material Design, for icons not in Lucide)
- AI providers: `@lobehub/icons-static-svg` (OpenAI, Anthropic, etc.)
