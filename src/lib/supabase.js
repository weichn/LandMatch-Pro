import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 
'https://lywxmttsbdlpfesjcdvv.supabase.co'


const supabaseAnonKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3htdHRzYmRscGZlc2pjZHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTgyNjMsImV4cCI6MjEwMDEzNDI2M30.q03t__zeWKyvGpX1Q-6Hjq2pVrESyiczHj8i_2jMnfE'


export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)