-- Full-text search on Resource(title, description).
-- A generated tsvector column keeps the index in sync automatically, and a GIN
-- index makes `@@` queries fast. The application queries this via raw SQL
-- (parameterized) in the resource list endpoint.

ALTER TABLE "Resource"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "Resource_searchVector_idx" ON "Resource" USING GIN ("searchVector");
