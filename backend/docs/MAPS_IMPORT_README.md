# Kosher Maps – Restaurant CSV Import

Use **Admin → Maps → Import** to upload a CSV (or XLSX) to add or update restaurants.

## Matching (upsert)

- Rows are matched by **name** (case-insensitive). If **address** is present in the row, matching also requires the same address.
- If a restaurant with that name (and address) exists → **only the columns you include in the CSV are updated**; other fields are left unchanged.
- If no match → a **new** restaurant is created (name is required; other fields optional).

So you can use a **minimal CSV** with just the columns you want to add or change.

## Column names (any of these work)

| Field | Accepted headers |
|-------|-------------------|
| Name | `name`, `restaurant name`, `restaurant`, `business name`, `establishment` |
| Address | `address` |
| City | `city` |
| State | `state` |
| Zip | `zip` |
| Latitude | `latitude`, `lat` |
| Longitude | `longitude`, `lng` |
| Phone | `phone` |
| Website | `website` |
| Certification | `kosher_certification`, `kosher certification`, `certification` |
| Rating | `google_rating`, `rating` |
| Place ID | `google_place_id`, `place_id` |
| Diet tags | `diet_tags`, `diet tags`, `tags` (comma-separated, e.g. `dairy,bakery`) |
| Hours | `hours_of_operation`, `hours of operation`, `hours` |
| Timezone | `timezone`, `tz` (IANA, e.g. `America/New_York`) |
| Active | `is_active`, `active` (`true`/`false`) |
| Deactivation reason | `deactivation_reason` |
| Notes | `notes` |

## Example: full row (create or replace those fields)

See `maps-restaurants-import-example.csv`: all columns. Use for new restaurants or when you want to set everything.

## Example: partial update (only set hours + timezone)

See `maps-restaurants-import-partial-update-example.csv`:

```csv
name,hours_of_operation,timezone
"Example Restaurant","Saturday Closed
Sunday 6 AM–3:30 PM
...
Friday 6 AM–2:30 PM",America/New_York
```

- **name** must match an existing restaurant exactly (or the first column will be used as name).
- Only **hours_of_operation** and **timezone** are updated; address, phone, etc. stay as they are.

## Hours format

Use one line per day. Separator between open and close can be `-` or `–`. Examples:

- `Saturday    Closed`
- `Sunday      6 AM–3:30 PM`
- `Friday      6 AM–2:30 PM`
- `Saturday    AS–12 AM`  (AS = 1 hour after sunset at the restaurant’s location)
