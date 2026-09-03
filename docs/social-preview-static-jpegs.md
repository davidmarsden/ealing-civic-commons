# Static social preview JPEGs

Social crawlers should receive literal JPEG files for Open Graph preview images.

The source artwork remains in `public/brand/social/*.svg`. During `npm run build`, `scripts/render-social-cards.mjs` rasterises every SVG to a 1200×630 JPEG in `dist/brand/social/` using Sharp. The build then verifies that all eight expected files exist and are non-trivial in size.

Do not reintroduce a `/.netlify/images` rewrite for these Open Graph assets. Facebook, WhatsApp and Bluesky have all shown inconsistent or failed image rendering when the public `.jpg` URL was only an Image CDN rewrite.
