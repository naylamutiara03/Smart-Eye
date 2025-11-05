import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yfvemirbwlyztkmesknl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdmVtaXJid2x5enRrbWVza25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjI2MDgsImV4cCI6MjA3NTEzODYwOH0.bXopjvHQHWpoEibgMTlK0vJAnZdjL7uzcoRdiOQMD7o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
