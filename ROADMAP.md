# Ideas for later

Not built, not promised. Block types that fit the existing field kinds (text, textarea, url, select):

- **Sponsor card**: a name, a tagline, a link and a tier. See `examples/SponsorCard.astro` for the template.
- **Link list**: a heading and several links, for a "Helpful links" box above the footer. Needs a repeating-field kind, or a textarea with one `[label](address)` per line.
- **Promo banner with an image**: needs an image field (an upload or an address) and a size check.
- **Countdown or schedule banner**: uses the existing start/end dates, with a template that prints the time left.

Plugin features:

- A repeating-field kind (a list of small groups of fields) and an image field kind.
- Drag-and-drop ordering and moving a block between regions in the admin.
- Role-based visibility (signed-in or not) and per-device visibility.
- Admin date inputs with a time of day (they are UTC dates today).
- Registry listing and an npm release (waiting on a final review).
