# emdash-plugin-site-blocks

Site-wide blocks for [EmDash](https://emdashcms.com): put a notice, an announcement or a message into a named
region of your theme, and choose which pages it appears on with show and hide path lists, the way Drupal's
Block Layout works.

- **Regions** are spots your layouts declare (`above-header`, `footer-top`, …). Editors choose a region per block.
- **Blocks** have a type, a style, a weight (order), a status, an optional schedule and path rules.
- **Path rules** are one pattern per line: `*` matches anything, `<front>` is the home page. A block shows when it
  matches the *Show on* list (empty means every page) and does not match the *Hide on* list.
- **Built-in types:** Notice (message and link) and Rich text (paragraphs and links). Add your own as data plus a component.
- **Dismissible** blocks are remembered per browser for 14 days, and come back when you edit them.
- Edited in the EmDash admin on a **Site blocks** page. No raw HTML is stored or rendered.

## Install

```sh
bun add emdash-plugin-site-blocks     # or npm / pnpm
```

Requires EmDash 1.3 or later and Astro 6 or later. It is a native plugin (it runs with your site, not in a sandbox).

## Set up

```js
// astro.config.mjs
import emdash from "emdash/astro";
import { siteBlocks } from "emdash-plugin-site-blocks";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [
        siteBlocks({
          regions: [
            { id: "above-header", label: "Above header" },
            { id: "footer-top", label: "Footer top" },
          ],
        }),
      ],
    }),
  ],
});
```

If you leave `regions` out, five defaults are used: `above-header`, `below-header`, `playground-top`,
`playground-bottom` and `footer-top`. Region ids are lowercase letters, digits and dashes.

Then place the regions in your layout:

```astro
---
import BlockRegion from "emdash-plugin-site-blocks/astro/BlockRegion.astro";
---
<body>
  <BlockRegion name="above-header" />
  <Header />
  <slot />
  <BlockRegion name="footer-top" />
  <Footer />
</body>
```

An empty region renders nothing. If the plugin or its route is unavailable, or a fetch times out, the region is empty and the page still renders. A custom type's own component is your code: if it throws, the page fails like any other component, so keep it defensive.

## Using it

Open **Site blocks** in the EmDash admin (it needs the `plugins:manage` permission). Pick a region and a type,
write the content, choose a style, and set where it appears:

| Show on | Hide on | Result |
|---|---|---|
| *(empty)* | *(empty)* | every page |
| `/playground/*` | | only playground pages |
| *(empty)* | `/submit` | every page except `/submit` |
| `*` | `/blog/draft-*` | every page except blog drafts |
| `<front>` | | the home page only |

Matching ignores case, query strings, hashes and a trailing slash. `/playground/*` does not match `/playground`
itself; add that line too if you want both.

Several blocks can share a region; they stack in weight order (lower first). **Move up** and **Move down** renumber the weights for you.

## Styling

Default styles use `:where()`, so any selector of yours wins. Set variables or override classes:

```css
.sb-block { --sb-bg: #0f766e; --sb-fg: #fff; --sb-link: #fff; }
.sb-notice .sb-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

Classes: `sb-region` (the region wrapper), `sb-block` (every block), `sb-notice`, `sb-richtext`, `sb-style-<style>`, `sb-body`, `sb-dismiss`.
When a visitor dismisses a block the document gets a `sb:dismiss` event, so a layout that measures the region can update.

## Notice fields, two links, and styles

A notice has an optional label (`BETA`), an optional heading, a message, up to two links, and, for each link, whether it looks like a text link or a button. Of the buttons, the last is the primary one, so a text link beside one button is the "Report a problem / [Suggest a playground]" pattern. The admin's Style list comes from the notice type. The built-in styles are plain colours (`info`, `warning`, `promo`); a site that wants its own designs replaces the type with `siteBlocks({ types: [{ id: "notice", label: "Notice", styles: [...], fields: BUILTIN_TYPES[0].fields }] })` and styles `.sb-style-<value>` in its CSS. Every block renders inside `<aside class="sb-block sb-style-<value> sb-notice">` with `.sb-badge`, `.sb-heading`, `.sb-text` and `.sb-actions` inside.

## Side by side

Each block has a Width: Full or Half. A region lays its blocks out in rows: a full block takes a row, and half blocks that follow each other pair up (they stack on a narrow screen, and a lone half block grows to fill its row). Reorder blocks with Move up / Move down to choose who sits beside whom.

## Notice messages

A notice's message can link words: `Visit our [contact page](/contact) or [suggest a playground](/submit).` Only `https://`, `http://` and `/page` addresses become links; anything else stays as typed text.

## Caching

The server keeps the published blocks in memory for 30 seconds, so a page that renders several regions reads storage once. Edits made in the admin show at once on the server that took them, and on other servers within the window. Set `siteBlocks({ cacheSeconds: 0 })` to turn it off, or a number up to 3600.

## Custom block types

Declare the type's fields as data when you configure the plugin, and render it with a component:

```js
siteBlocks({
  types: [{
    id: "sponsor",
    label: "Sponsor card",
    styles: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }],
    fields: [
      { id: "name", label: "Sponsor", kind: "text", required: true, max: 80 },
      { id: "url", label: "Website", kind: "url" },
    ],
  }],
})
```

```astro
<BlockRegion name="footer-top" types={{ sponsor: SponsorCard }} />
```

`SponsorCard` receives `block` (`{ id, type, style, dismissible, props, rev }`). Render inside `BlockShell`
(`emdash-plugin-site-blocks/astro/BlockShell.astro`) to get the wrapper, dismiss button and dismissal memory. Field kinds: `text`, `textarea`, `url`, `select`.
A type with the id of a built-in replaces it.

## Customizing: styles, options, regions and templates

Everything a site chooses is plain data in the plugin options, plus CSS and, optionally, an Astro template. Working samples live in [`examples/`](examples/):
[`astro.config.example.mjs`](examples/astro.config.example.mjs), [`blocks.example.css`](examples/blocks.example.css),
[`SponsorCard.astro`](examples/SponsorCard.astro) and [`NoticeCustom.astro`](examples/NoticeCustom.astro). The tests render them, so they stay correct.

### Add a style

1. **Offer it in the admin.** Styles belong to a block type. List them on the type (the first is the default):
   ```js
   import { BUILTIN_TYPES, siteBlocks } from "emdash-plugin-site-blocks";
   const notice = { ...BUILTIN_TYPES.find((t) => t.id === "notice"), styles: [
     { value: "dark", label: "Dark strip" }, { value: "coral", label: "Coral announcement" },
   ] };
   siteBlocks({ types: [notice] });
   ```
2. **Style it.** The block gets the class `sb-style-<value>`. Colours come from variables, so a style can be a few lines
   (see [`blocks.example.css`](examples/blocks.example.css)):
   ```css
   .sb-style-coral { --sb-bg: #fde4d8; --sb-fg: #2b2118; --sb-link: #8a3b17; --sb-badge-bg: #f08a5d; }
   ```
   The plugin's own defaults use `:where()`, so a plain selector in your CSS always wins.

### Options an editor can choose

A field's `kind` decides the control: `text`, `textarea`, `url` (must be `https://`, `http://` or `/page`) or `select`.
A select lists its choices as `{ value, label }`; your template receives the `value`.
Every field can be `required`, has a `max` length (500 by default) and an optional `help` hint.
Every block, whatever its type, also has: region, style, width (full or half), dismissible, show/hide paths, status, weight and a schedule.

### Add a region

Declare it, then place it in a layout:

```js
siteBlocks({ regions: [{ id: "above-header", label: "Above header" }, { id: "sidebar", label: "Sidebar" }] })
```
```astro
<BlockRegion name="sidebar" />
```

### Change how a block is drawn (templates)

`<BlockRegion types={{ ... }}>` maps a type id to the component that draws it, for new types and for the built-in ones:

```astro
<BlockRegion name="footer-top" types={{ sponsor: SponsorCard }} />   <!-- a new type -->
<BlockRegion name="above-header" types={{ notice: NoticeCustom }} />  <!-- replaces the built-in notice output -->
```

A template receives `block` = `{ id, type, style, dismissible, width, props, rev }`; `props` holds the type's fields as strings.
Render inside `BlockShell` to get the wrapper, the dismiss button, the dismissal memory and the half/full width.
Text you print is escaped by Astro; check any address you link (`isSafeLink` from `emdash-plugin-site-blocks/model`).
See [`SponsorCard.astro`](examples/SponsorCard.astro) for a new type and [`NoticeCustom.astro`](examples/NoticeCustom.astro) for a replacement.

### The markup the built-in notice produces

```html
<div class="sb-region" data-sb-region="above-header">
  <aside class="sb-block sb-style-coral sb-notice" aria-label="Site notice"
         data-sb-block="…" data-sb-rev="…" data-sb-width="full">
    <div class="sb-body">
      <span class="sb-badge">BETA</span>
      <span class="sb-content">
        <strong class="sb-heading">Heading</strong>
        <span class="sb-text">Message with <a class="sb-link" href="/contact">a link</a>.</span>
      </span>
      <span class="sb-actions">
        <a class="sb-link" href="/contact">Report a problem</a>
        <a class="sb-btn sb-btn-primary" href="/submit">Suggest a playground</a>
      </span>
    </div>
    <button type="button" class="sb-dismiss" aria-label="Dismiss">×</button>
  </aside>
</div>
```

`sb-link` is a text link; `sb-btn` is a button, and of the buttons the last one is `sb-btn-primary` and any other is `sb-btn-secondary`.
Parts that are empty are left out, and an empty region renders nothing.

## Security

Dismissing a block uses a small inline script. Under a Content-Security-Policy that blocks inline scripts, add a nonce or hash for it, or dismissal will not be remembered.


- Editors enter plain text. Messages are escaped by Astro; rich text is parsed into paragraphs, breaks and links, never HTML.
- Link addresses must start with `https://`, `http://` or `/` (not `//`); anything else (including backslashes, spaces and control characters) is refused when saving and again when rendering a notice's link or a message link.
- The public route returns only what a page needs (type, style, content, revision). Path rules and admin names stay private.
- Input from the admin is validated on the server: region, type, status, weight, dates, path-list size, field lengths.

## Development

```sh
bun install
bun run test        # unit and component tests
bun run typecheck
bun run build
```

## License

MIT
