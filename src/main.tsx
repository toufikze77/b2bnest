import { createRoot } from 'react-dom/client'
import { supabaseConfig } from './integrations/supabase/config'
import { MissingConfigScreen } from './components/MissingConfigScreen'
import './index.css'

const root = createRoot(document.getElementById("root")!);

if ('missing' in supabaseConfig) {
  // A readable page instead of a blank screen. The app (and everything that talks to Supabase) is not loaded.
  console.error(`B2BNEST can't start: missing ${supabaseConfig.missing.join(' and ')} in this build.`);
  root.render(<MissingConfigScreen />);
} else {
  import('./App.tsx').then(({ default: App }) => root.render(<App />));
}
