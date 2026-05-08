-- Add private profile flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Update posts SELECT policy to respect privacy
DROP POLICY IF EXISTS posts_read_all ON public.posts;

CREATE POLICY posts_read_visible ON public.posts
FOR SELECT
USING (
  -- Public profile owner
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = posts.user_id AND p.is_private = false)
  -- Or viewer is the owner
  OR auth.uid() = user_id
  -- Or viewer follows the owner
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.following_id = posts.user_id AND f.follower_id = auth.uid()
  )
);