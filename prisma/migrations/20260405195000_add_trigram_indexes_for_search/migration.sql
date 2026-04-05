-- Enable trigram support for contains / ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Post search
CREATE INDEX "Post_title_trgm_idx" ON "Post" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Post_summary_trgm_idx" ON "Post" USING GIN ("summary" gin_trgm_ops);

-- Related entity search
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
CREATE INDEX "User_nickname_trgm_idx" ON "User" USING GIN ("nickname" gin_trgm_ops);
CREATE INDEX "Board_name_trgm_idx" ON "Board" USING GIN ("name" gin_trgm_ops);
