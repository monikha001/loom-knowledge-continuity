import { supabase } from "./lib/supabaseClient";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
supabase
  .from("organizations")
  .select("id")
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error("LOOM connection failed:", error.message);
    } else {
      console.log(
        "LOOM Supabase connected successfully!",
        data.length,
        "organisations visible"
      );
    }
  });
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
