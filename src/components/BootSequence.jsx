import { useState, useEffect, useRef, memo } from "react";
import { login, getRoleLabel, getRoleColor } from "../utils/authStore";

const BOOT_LINES = [
  { text: "PGOC OS v2.4.1",                       big: true             },
  { text: "initializing cesium terrain engine..."                        },
  { text: "loading OSM building data: TIRANA, AL"                       },
  { text: "connecting to IoT mesh network..."                            },
  { text: "1,204 sensors online"                                         },
  { text: "AI inference engine: READY"                                   },
  { text: "pyramid hub: LOCKED",                  color: "#ffc040"      },
];

// ── Memoized so keystrokes never re-render these ─────────
const BootLines = memo(function BootLines({ lines, phase }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} style={{
          color:         l.color || "#4db8ff",
          fontSize:      l.big ? "22px" : "13px",
          fontWeight:    l.big ? "bold" : "normal",
          letterSpacing: l.big ? "6px" : "2px",
          marginBottom:  "8px",
          opacity:       0,
          animation:     "boot-line 0.3s ease forwards",
          textShadow:    l.big ? "0 0 10px #1a6fff" : l.color ? `0 0 8px ${l.color}` : "0 0 6px #1a6fff",
        }}>
          {!l.big && <span style={{ color: "#1a6fff", marginRight: "10px" }}>›</span>}
          {l.text}
          {phase === "boot" && i === lines.length - 1 && (
            <span style={{ animation: "blink-dot 0.8s infinite" }}>_</span>
          )}
        </div>
      ))}
    </>
  );
});

const PostLines = memo(function PostLines({ lines }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} style={{
          color:         l.color || "#4db8ff",
          fontSize:      l.big ? "22px" : "13px",
          fontWeight:    l.big ? "bold" : "normal",
          letterSpacing: l.big ? "6px" : "2px",
          marginBottom:  "8px",
          marginTop:     i === 0 ? "14px" : 0,
          opacity:       0,
          animation:     "boot-line 0.3s ease forwards",
          textShadow:    l.big ? "0 0 10px #00ff88" : `0 0 8px ${l.color || "#4db8ff"}`,
        }}>
          <span style={{ color: "#1a6fff", marginRight: "10px" }}>›</span>
          {l.text}
        </div>
      ))}
    </>
  );
});

export default function BootSequence({ onComplete }) {
  const [lines,     setLines]   = useState([]);
  const [phase,     setPhase]   = useState("boot");
  const [username,  setUsername] = useState("");
  const [password,  setPassword] = useState("");
  const [step,      setStep]    = useState("user");
  const [error,     setError]   = useState("");
  const [postLines, setPost]    = useState([]);
  const [fadeOut,   setFadeOut] = useState(false);
  const uRef = useRef(null);
  const pRef = useRef(null);

  // Boot lines
 useEffect(() => {
  if (phase !== "boot") return;
  let i = 0;
  const iv = setInterval(() => {
    if (i < BOOT_LINES.length) {
      const line = BOOT_LINES[i];
      i++;
      setLines(p => [...p, line]);
    } else {
      clearInterval(iv);
      setTimeout(() => setPhase("login"), 500);
    }
  }, 280);
  return () => clearInterval(iv);
}, []);

  // Focus username on login phase
  useEffect(() => {
    if (phase === "login") setTimeout(() => uRef.current?.focus(), 80);
  }, [phase]);

  // Focus correct input when step changes
  useEffect(() => {
    if (step === "pass") setTimeout(() => pRef.current?.focus(), 50);
    if (step === "user") setTimeout(() => uRef.current?.focus(), 50);
  }, [step]);

  // Post-auth lines
  useEffect(() => {
    if (phase !== "auth") return;
    const user = window.__nexusUser;
    if (!user) return;
    const authLines = [
      { text: `ROLE DETECTED: ${getRoleLabel(user.role)}`, color: getRoleColor(user.role) },
      { text: `CLEARANCE LEVEL: ${user.clearance} / 3`,   color: getRoleColor(user.role) },
      { text: `Welcome, ${user.name}`,                     color: getRoleColor(user.role) },
      { text: "SYSTEM ONLINE — ACCESS GRANTED",            color: "#00ff88", big: true    },
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i < authLines.length) {
        setPost(p => [...p, authLines[i++]]);
      } else {
        clearInterval(iv);
        setTimeout(() => setFadeOut(true), 400);
        setTimeout(() => onComplete(window.__nexusUser), 1000);
      }
    }, 320);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Input handlers ──────────────────────────────────────
  function handleUsernameKey(e) {
    if (e.key === "Enter" && username.trim()) {
      setStep("pass");
    }
  }

  function handlePasswordKey(e) {
    // Back to username if Backspace on empty password
    if (e.key === "Backspace" && password === "") {
      setStep("user");
      return;
    }
    if (e.key !== "Enter" || !password) return;
    const result = login(username.trim(), password);
    if (!result.success) {
      setError(result.error);
      setPassword("");
      setTimeout(() => { setError(""); pRef.current?.focus(); }, 1800);
      return;
    }
    setPhase("auth");
  }

  const inputBase = {
    background: "transparent", border: "none", outline: "none",
    color: "#00ff88", fontFamily: "'Courier New', monospace",
    fontSize: "13px", letterSpacing: "2px", width: "220px", caretColor: "#00ff88",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#000",
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "flex-start",
      padding: "18% 10%",
      fontFamily: "'Courier New', monospace",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.6s ease",
    }}>

      {/* Boot lines — memoized, never re-renders on input */}
      <BootLines lines={lines} phase={phase} />

      {/* Login form */}
      {phase === "login" && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ color: "#ffc040", fontSize: "13px", letterSpacing: "2px", marginBottom: "16px" }}>
            › AUTHENTICATION REQUIRED
          </div>

          {/* Username — always editable, clicking refocuses it */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ color: "#4db8ff", fontSize: "13px", letterSpacing: "1px", marginRight: "8px", minWidth: "110px" }}>
              › USERNAME:
            </span>
            <input
              ref={uRef}
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z]/g, ""))}
              onKeyDown={handleUsernameKey}
              onFocus={() => setStep("user")}
              style={{ ...inputBase, opacity: step === "user" ? 1 : 0.55 }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {/* Password — appears after username entered */}
          {step !== "user" && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ color: "#4db8ff", fontSize: "13px", letterSpacing: "1px", marginRight: "8px", minWidth: "110px" }}>
                › PASSWORD:
              </span>
              <input
                ref={pRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handlePasswordKey}
                style={inputBase}
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div style={{ color: "#ff2d2d", fontSize: "12px", letterSpacing: "1px", marginTop: "8px" }}>
              › ACCESS DENIED: {error}
            </div>
          )}
          {!error && (
            <div style={{ color: "#4db8ff", fontSize: "10px", letterSpacing: "1px", marginTop: "10px", opacity: 0.35 }}>
              {step === "user"
                ? "› Type username · Press ENTER"
                : "› Type password · ENTER to auth · BACKSPACE to go back"}
            </div>
          )}
          <div style={{ color: "#1a3355", fontSize: "10px", marginTop: "18px", opacity: 0.4 }}>
            › Authorized personnel only · OSHEE Grid Security Division
          </div>
        </div>
      )}

      <PostLines lines={postLines} />
    </div>
  );
}