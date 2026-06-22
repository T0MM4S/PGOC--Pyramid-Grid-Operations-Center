import { useState } from "react";
import "./App.css";
import MapViewer from "./components/MapViewer";
import BootSequence from "./components/BootSequence";
import { restoreSession, logout } from "./utils/authStore";
import { Analytics } from "@vercel/analytics/react";

function App() {
  // Rehydrate a persisted session (survives Vite HMR / reload) so a logged-in
  // user isn't bounced back to the boot/login screen. First run = no session →
  // BootSequence plays as before.
  const [booted, setBooted] = useState(() => !!restoreSession());

  function handleLogout() {
    logout();
    setBooted(false);
  }

  return (
    <>
      {!booted && (
        <BootSequence
          onComplete={(user) => {
            window.__nexusUser = user;
            setBooted(true);
          }}
        />
      )}
      {booted && <MapViewer onLogout={handleLogout} />}
      <Analytics />
    </>
  );
}
export default App;