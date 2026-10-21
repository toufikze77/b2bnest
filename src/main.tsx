import { createRoot } from 'react-dom/client'
import { supabaseConfig } from './integrations/supabase/config'
import { MissingConfigScreen } from './components/MissingConfigScreen'
import { isChunkLoadError, reloadOnceForNewVersion } from './lib/lazyPage'
import './index.css'

const root = createRoot(document.getElementById("root")!);

if ('missing' in supabaseConfig) {
  // A readable page instead of a blank screen. The app (and everything that talks to Supabase) is not loaded.
  console.error(`B2BNEST can't start: missing ${supabaseConfig.missing.join(' and ')} in this build.`);
  root.render(<MissingConfigScreen />);
} else {
  import('./App.tsx').then(({ default: App }) => root.render(<App />)).catch((error) => {
    // A tab left open across a deployment: fetch the new version once, otherwise say so instead of a blank page.
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    console.error('B2BNEST could not start:', error);
    root.render(<MissingConfigScreen title="B2BNEST couldn't load" message="Please reload the page. If this keeps happening, try again in a few minutes." />);
  });
}
