# Restaurant & menu data structure (from live export)

This describes the structure used in the DB and by `export-restaurants-and-menu.js` / `import-restaurants-and-menu.js`. TSV importers should produce data that matches this.

## Restaurant

| Field | Type | Notes |
|-------|------|--------|
| id | string | Slug, e.g. `alans-bakery`, `bagel-boys`, `central-perk-cafe`, `graze-smokehouse` |
| name | string | Display name |
| address | string \| null | |
| phone | string \| null | |
| typeOfFood | string \| null | |
| kosherCertification | string \| null | |
| logoUrl | string \| null | Filename or URL |
| featured | boolean | |
| active | boolean | |
| createdAt, updatedAt | date | |

## MenuItem (simple, variety, builder)

| Field | Type | Notes |
|-------|------|--------|
| id | UUID | Generated on create |
| restaurantId | string | FK to Restaurant.id |
| name | string | |
| description | string \| null | Plain text (no HTML) |
| price | decimal/string | Base price; for variety = first variant price |
| category | string \| null | e.g. `salads`, `bagels`, `paninis`, `fish` (no leading slash) |
| imageUrl | string \| null | URL or filename |
| available | boolean | Default true |
| itemType | enum | `simple` \| `variety` \| `builder` |
| options | object \| null | For **variety**: `{ variants: [ { name, priceModifier } ] }`; for **builder**: `{ configurations: [ { category, required, maxSelections, options: [ { name, priceModifier } ] } ] }`; simple: null |
| labels | array | e.g. `["D"]` or `[]` |
| createdAt, updatedAt | date | |
| itemOptions | array | MenuItemOption records; often `[]` for simple |

## Restaurant ID slugs (TSV → DB)

TSV files use various names; map to DB ids as follows:

- `central-perk` → `central-perk-cafe`
- `graze` → `graze-smokehouse`
- `ruthies-place` → `ruthys-grocery-and-deli`
- `stop-chop-roll` → `stop-chop-and-roll`
- `traditions` → `traditions-eatery`
- `alans-bakery`, `bagel-boys`, `five-fifty`, `mazza-and-more`, `oh-nuts`, `the-cheese-store`, `spruce-dvine` → use as-is (match DB id)

## TSV formats in repo

1. **Short format** (e.g. alans-bakery, bagel-boys): Tab-separated with columns: Product ID, Variant ID, Product Type, **Restaurant Name** (3), **Category** (4), **Name** (5), **Description** (6), **Price** (7), On Sale, Sale Price, [Variants], Stock, **Visible** (12).
2. **Long format** (e.g. central-perk, graze): Product ID, Variant ID, Product Type, **Product Page** (3), Product URL, **Title** (5), **Description** (6), SKU, Option columns… **Price** (20), Sale Price, On Sale, Stock, **Categories** (24), Tags, Weight, Length, Width, Height, **Visible** (30). Detect by header containing `title` and `product page`.

Category in TSV often has leading slash (e.g. `/salads`); strip it for DB (`salads`).

## Variety / builder from TSV (`import-product-tsv.js`)

- **Long format:** Rows with Option Name 1 / Option Value 1 (e.g. Size / Small, Size / Large) are grouped by Product ID. When multiple rows share the same product (or one row has options), the importer creates a **variety** item: `itemType: 'variety'`, `options: { variants: [ { name, priceModifier } ] }`. Base price = first row price; each variant’s `priceModifier` = that row’s price minus base price. Variant-only rows (empty Title) are merged into the previous product.
- **Short format:** If Product Type = "Variable" and the Variants column is set, the importer creates a **variety** item with one variant (name from Variants, `priceModifier: 0`).
- **Builder:** When the TSV has **two or more distinct option dimensions** (e.g. Option Name 1 = "Size" and Option Name 2 = "Rice" or "Sauce"), the importer creates a **builder** item: `itemType: 'builder'`, `options: { configurations: [ { category, required: true, maxSelections: 1, options: [ { name, priceModifier } ] } ] }`.
- **Restaurant:** If the restaurant slug is not in the DB, the importer creates it (minimal record: id, name from slug, active: true) so any TSV can be uploaded with no prep.
- **Category:** Empty category is stored as `general` so validation passes.
- **TSV prep (all 7):** Run `node scripts/match-seven-to-four-tsv.js` to normalize categories (simple names, no hyphens) and add detailed descriptions. Updates TSV files in `data/` in place.
- **Import:** `node scripts/import-product-tsv.js --replace <path-to.tsv>` replaces that restaurant’s menu. For all 7: `node scripts/import-all-seven-restaurants.js`.
- **Verify:** `node scripts/verify-menu-items.js [restaurant-id]` prints item counts by type and runs validation.
