# Garden Buddy — Dev Notes

## Data model intentions and future work

### Media

- **Media ↔ Plant relationship** — A media item should be linkable to a plant
  (profile photo, progress shots, etc.).  A join table `plant_media` or a
  nullable `plant_id` FK on the `media` table should be added when endpoints
  are built for plant detail pages.
- **Thumbnail generation** — When saving an image, consider generating a small
  thumbnail at save time (e.g. via `Pillow`) and storing it alongside the
  original. Useful for list views.
- **HEIC conversion** — iPhones upload `.heic` files which many browsers cannot
  display. Consider converting HEIC → JPEG at save time using `pillow-heif` as
  an optional dependency.  Store the converted file and record the original MIME
  type in the `media` table for reference.

### Plants

- **Markdown notes field** — The `notes` column is plain TEXT in SQLite.
  Newlines and formatting are preserved naturally. No escaping or processing is
  needed in the DB layer. Rendering to HTML should happen at the API/frontend
  layer (e.g. `markdown-it` or Python `markdown` package).
- **Plant ↔ Media** — See Media section above.
- **Garden / location concept** — Plants may eventually belong to a garden or
  bed. Consider a `gardens` table and a `plant_garden` join table when spatial
  or organisational features are needed.

### Species

- **Taxonomy depth** — The current `parent_species_id` FK supports one level of
  subspecies. If deeper taxonomy (family → genus → species → subspecies) is
  needed in the future, consider a `taxonomy_rank` column and a recursive CTE
  for traversal, or a dedicated `taxonomy` table.

### General

- All timestamps are stored as ISO-8601 UTC strings.  If timezone-aware
  datetimes become relevant, migrate to storing Unix timestamps (INTEGER) or
  add a `timezone` column.
- `PRAGMA foreign_keys = ON` is set per-connection in `db/connection.py`.
  This must remain in place for `ON DELETE CASCADE` and `ON DELETE SET NULL`
  constraints to be enforced by SQLite.
