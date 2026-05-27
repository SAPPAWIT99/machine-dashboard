import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gsrhseuwcmckjztvaoui.supabase.co";

const supabaseKey = "วาง Publishable Key ของคุณ";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);