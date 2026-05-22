
-- 1) Tighten storage object listing: drop broad public SELECT, restrict listing to authenticated only.
-- Public bucket files remain accessible via the public object URL endpoint (bypasses RLS).
DROP POLICY IF EXISTS posts_bucket_read ON storage.objects;
DROP POLICY IF EXISTS reels_bucket_read ON storage.objects;
DROP POLICY IF EXISTS statuses_bucket_read ON storage.objects;

CREATE POLICY posts_bucket_read_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = ANY (ARRAY['posts'::text, 'avatars'::text]));

CREATE POLICY reels_bucket_read_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reels'::text);

CREATE POLICY statuses_bucket_read_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'statuses'::text);

-- 2) SECURITY DEFINER functions: revoke direct execute from anon/public.
-- Trigger functions only need to run via the trigger (which uses the function owner's rights).
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_status_reply_to_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- increment_reel_view is intentionally callable by signed-in users via RPC;
-- revoke from anon but keep for authenticated.
REVOKE EXECUTE ON FUNCTION public.increment_reel_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_reel_view(uuid) TO authenticated;
