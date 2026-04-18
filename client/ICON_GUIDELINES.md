# TalkWork Icon Guidelines (Lucide)

## Library
- Use `lucide-vue-next` for all UI icons.
- Do not use emoji, symbol characters, or mixed icon sets in product UI.
- Lucide is MIT licensed and is the project standard icon source.

## Standard Sizes
- `16px`: inline action text, metadata, compact buttons.
- `20px`: normal buttons, navigation arrows, floating action buttons.
- `24px`: card/header visual icons and standalone icon blocks.

## Usage Rules
- Prefer direct component imports from `lucide-vue-next`.
- Keep icon size explicit with `:size="16|20|24"`.
- Keep icon and text aligned with `display: inline-flex; align-items: center; gap: 4px/6px`.
- Use `fill="currentColor"` only for toggled/active states where a filled visual is needed.
- Keep icon color inherited from text unless a specific semantic color is required.

## Vue Examples
```vue
<script setup>
import { Heart, MessageCircle, Plus } from 'lucide-vue-next';
</script>

<button class="act">
  <Heart :size="16" :fill="liked ? 'currentColor' : 'none'" />
  点赞
</button>

<button class="tw-btn tw-btn-primary">
  <Plus :size="16" />
  发帖
</button>

<span class="meta">
  <MessageCircle :size="16" />
  12
</span>
```

## Review Checklist
- No emoji icons left in templates.
- No text-symbol icons left (`+`, `*`, arrows, stars) for icon intent.
- New icons follow 16/20/24 size system.
- Import names are clear and consistent with UI meaning.
