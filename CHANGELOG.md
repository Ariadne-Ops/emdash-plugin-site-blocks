# Changelog

## Unreleased

- Notice messages can hold `[words](address)` links, and may be up to 1000 characters.
- The published blocks are cached in memory for 30 seconds (`cacheSeconds` option; 0 turns it off). Admin edits clear it at once.

## 0.1.0

First release.

- Regions: a site declares named placements (`above-header`, `footer-top`, …) and renders them with `<BlockRegion name="…" />`.
- Blocks: placed in a region, ordered by weight, published or draft, with an optional start and end date.
- Visibility: Drupal-style show and hide path lists (`*` wildcard, `<front>`); a hide match always wins.
- Built-in types: Notice (message, link, info/warning/promo styles) and Rich text (paragraphs and safe links, no HTML).
- Dismissible blocks, remembered in the visitor's browser for 14 days and shown again when the block is edited.
- Block Kit admin page: blocks grouped by region, add, edit, reorder, publish/unpublish, delete.
- Custom block types: declare fields as data in `siteBlocks({ types })`, render with a component in `<BlockRegion types>`.
