from supabase import create_client, Client

# Ganti dengan project Supabase kamu
SUPABASE_URL = "https://yfvemirbwlyztkmesknl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdmVtaXJid2x5enRrbWVza25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjI2MDgsImV4cCI6MjA3NTEzODYwOH0.bXopjvHQHWpoEibgMTlK0vJAnZdjL7uzcoRdiOQMD7o"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
