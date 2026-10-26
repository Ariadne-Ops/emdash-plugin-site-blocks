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
