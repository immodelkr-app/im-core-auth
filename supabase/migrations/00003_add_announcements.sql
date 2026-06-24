CREATE TABLE admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_app TEXT NOT NULL DEFAULT 'ALL', -- 'ALL', 'MOCA', 'IMFF'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) just in case, but since we are using admin client, it bypasses RLS.
ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;
