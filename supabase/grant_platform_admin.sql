-- Run this once in Supabase Dashboard → SQL Editor to make jjbarrett12@gmail.com a platform admin.
-- (No password is stored here; you sign in with your normal password.)
update public.profiles
set is_platform_admin = true
where user_id = (select id from auth.users where email = 'jjbarrett12@gmail.com' limit 1);

-- If the row was updated, you should see: UPDATE 1
-- If you see UPDATE 0, sign up first with that email at your app's /login, then run this again.
