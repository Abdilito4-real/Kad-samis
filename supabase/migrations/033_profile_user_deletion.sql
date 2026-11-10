DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_auth_users_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_assigned_operator_id_fkey,
  ADD CONSTRAINT requests_assigned_operator_id_fkey
    FOREIGN KEY (assigned_operator_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL
    NOT VALID,
  DROP CONSTRAINT IF EXISTS requests_assigned_by_fkey,
  ADD CONSTRAINT requests_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL
    NOT VALID;

ALTER TABLE public.request_operations
  DROP CONSTRAINT IF EXISTS request_operations_actor_id_fkey,
  ADD CONSTRAINT request_operations_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL
    NOT VALID;
