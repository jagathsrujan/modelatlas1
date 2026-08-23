-- Add avatar_url to seller_profiles for demo avatars (optional, demo-first)
alter table seller_profiles add column if not exists avatar_url text;
