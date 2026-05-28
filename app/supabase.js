import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gsrhseuwcmckjztvaoui.supabase.co";

const supabaseKey = "sb_publishable_3u5aI1so-gYBmsHhJjQrPw_J3Caf8GB";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);