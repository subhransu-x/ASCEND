const fs = require('fs'); 
let s = fs.readFileSync('src/App.jsx', 'utf8'); 
const startStr = 'function FocusTab({ user, gainXP, setU }) {'; 
const endStr = '// ══════════════════════════════════════════════\n// AI COACH TAB'; 
const startIdx = s.indexOf(startStr); 
const endIdx = s.indexOf(endStr); 

if (startIdx === -1 || endIdx === -1) { 
  console.log('NOT FOUND', startIdx, endIdx); 
  process.exit(1); 
} 

const newFocusTab = `function FocusTab({ user, gainXP, setU, active }) {
  const [mode, setMode] = useState("deep");
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [status, setStatus] = useState("idle"); 
  const [aiMsg, setAiMsg] = useState("");
  const [monkMaxPause, setMonkMaxPause] = useState(60); 
  const [monkPauseLeft, setMonkPauseLeft] = useState(60);

  const timerRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const totalSecs = duration * 60;

  const MODES = [
    { id: "deep", label: "Deep Work", icon: "///", color: T.primary, mins: 25, desc: "Pause and reset at will" },
    { id: "monk", label: "Monk Mode", icon: "❖", color: T.amber, mins: 50, desc: "Strict pause limit, no resets" },
    { id: "flow", label: "Flow State", icon: "⊗", color: T.green, mins: 90, desc: "No pause. Quitting loses all progress" },
  ];
  const currentMode = MODES.find((m) => m.id === mode);

  useEffect(() => {
    if (!active && mode === "flow" && (status === "running" || status === "paused")) {
      clearInterval(timerRef.current);
      clearInterval(pauseTimerRef.current);
      setStatus("failed");
      setTimeLeft(0);
      setAiMsg("Flow State broken! You lost focus by leaving the tab. 0 XP gained.");
    }
  }, [active, mode, status]);

  const fmt = (s) => \`\${String(Math.floor(s / 60)).padStart(2, "0")}:\${String(s % 60).padStart(2, "0")}\`;
  const pct = ((totalSecs - timeLeft) / totalSecs) * 100;

  const start = () => {
    if (status === "idle" || status === "paused") {
      clearInterval(pauseTimerRef.current);
      setStatus("running");
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            setStatus("done");
            const xp = Math.round(duration * 3);
            gainXP(xp);
            setU((u) => ({
              ...u,
              xpLog: [...(u.xpLog || []), { amount: xp, source: \`Focus: \${currentMode.label}\`, date: today() }]
            }));
            setAiMsg(\`Session complete! +\${xp} XP earned. You're ascending.\`);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
  };

  const pause = () => {
    if (mode === "flow") return; 
    clearInterval(timerRef.current);
    setStatus("paused");
    if (mode === "monk") {
      pauseTimerRef.current = setInterval(() => {
        setMonkPauseLeft((p) => {
          if (p <= 1) {
            clearInterval(pauseTimerRef.current);
            setStatus("failed");
            setTimeLeft(0);
            setAiMsg("Monk Mode failed. You paused too long. 0 XP gained.");
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }
  };

  const reset = () => {
    if (mode === "monk" && status !== "failed" && status !== "done" && status !== "idle") return; 
    clearInterval(timerRef.current);
    clearInterval(pauseTimerRef.current);
    
    if (mode === "flow" && status === "running") {
      setStatus("failed");
      setTimeLeft(0);
      setAiMsg("Flow State cancelled. You gave up. 0 XP gained.");
      return;
    }
    
    setTimeLeft(duration * 60);
    setMonkPauseLeft(monkMaxPause);
    setStatus("idle");
    setAiMsg("");
  };

  const selectMode = (m) => {
    if (status !== "idle" && status !== "done" && status !== "failed") return;
    setMode(m.id);
    setDuration(m.mins);
    setTimeLeft(m.mins * 60);
    if (m.id === "monk") setMonkPauseLeft(monkMaxPause);
    setStatus("idle");
    setAiMsg("");
  };

  const ringSize = 220;
  const radius = 90;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (1 - pct / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionHeader title="/// Focus Mode" />

      {/* Mode Selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => selectMode(m)}
            style={{
              padding: "12px 8px",
              borderRadius: 16,
              cursor: status !== "idle" && status !== "done" && status !== "failed" ? "not-allowed" : "pointer",
              background: mode === m.id ? \`\${m.color}18\` : "rgba(168,85,247,0.04)",
              border: \`1px solid \${mode === m.id ? m.color + "55" : T.border}\`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              boxShadow: mode === m.id ? \`0 0 20px \${m.color}22\` : "none",
              transition: "all 0.2s",
              opacity: status !== "idle" && status !== "done" && status !== "failed" && mode !== m.id ? 0.4 : 1,
            }}
          >
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: mode === m.id ? m.color : T.muted }}>
              {m.label}
            </span>
            <span style={{ fontSize: 10, color: T.muted }}>{m.mins}m</span>
          </button>
        ))}
      </div>
      
      {mode === "monk" && status === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontSize: 12, color: T.muted }}>
          Max Pause Bank:
          <select 
            value={monkMaxPause} 
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setMonkMaxPause(val);
              setMonkPauseLeft(val);
            }}
            style={{ background: "rgba(0,0,0,0.3)", color: T.text, border: \`1px solid \${T.border}\`, borderRadius: 8, padding: "4px 8px", outline: "none", cursor: "pointer" }}
          >
            <option value={5}>5 Seconds</option>
            <option value={60}>1 Minute</option>
            <option value={300}>5 Minutes</option>
          </select>
        </div>
      )}

      {/* Timer Ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
        <div style={{ position: "relative", width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="rgba(168,85,247,0.1)" strokeWidth={12} />
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={status === "failed" ? T.red : currentMode.color} strokeWidth={12} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} style={{ transition: "stroke-dashoffset 0.9s ease", filter: \`drop-shadow(0 0 10px \${status === "failed" ? T.red : currentMode.color}88)\` }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 42, fontWeight: 800, color: status === "failed" ? T.red : T.text, letterSpacing: "-2px", lineHeight: 1 }}>
              {fmt(timeLeft)}
            </div>
            <div style={{ fontSize: 12, color: status === "failed" ? T.red : T.muted, marginTop: 4 }}>
              {status === "idle" ? currentMode.desc : status === "running" ? "Focus active" : status === "paused" ? "Paused" : status === "done" ? "Complete! ✓" : "Failed ✕"}
            </div>
            {status === "paused" && mode === "monk" && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginTop: 6, animation: "pulse 1s infinite" }}>
                Pause Left: {fmt(monkPauseLeft)}
              </div>
            )}
            {status !== "paused" && (
              <div style={{ marginTop: 8 }}>
                <Tag color={status === "failed" ? T.red : currentMode.color}>
                  {currentMode.icon} {currentMode.label}
                </Tag>
              </div>
            )}
          </div>
        </div>

        {/* XP preview */}
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          Reward: <span style={{ color: currentMode.color, fontWeight: 700 }}>+{Math.round(duration * 3)} XP</span> on completion
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        {status === "idle" || status === "paused" || status === "done" || status === "failed" ? (
          <Btn onClick={status === "done" || status === "failed" ? reset : start} size="lg" style={{ flex: 1 }}>
            {status === "paused" ? "▶ Resume" : status === "done" || status === "failed" ? "↻ Reset" : "▶ Start Session"}
          </Btn>
        ) : mode !== "flow" && (
          <Btn onClick={pause} size="lg" variant="ghost" style={{ flex: 1 }}>
            ⏸ Pause
          </Btn>
        )}
        
        {status !== "idle" && status !== "done" && status !== "failed" && mode !== "monk" && (
          <button
            onClick={reset}
            style={{
              padding: "14px 20px",
              borderRadius: 14,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: T.red,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✕ {mode === "flow" ? "Give Up" : "Reset"}
          </button>
        )}
      </div>

      {/* Session complete / AI message */}
      {aiMsg && (
        <div
          style={{
            background: status === "failed" ? "rgba(248,113,113,0.1)" : \`\${currentMode.color}0d\`,
            border: \`1px solid \${status === "failed" ? "rgba(248,113,113,0.3)" : currentMode.color + "33"}\`,
            borderRadius: 16,
            padding: "14px 16px",
            fontSize: 14,
            color: status === "failed" ? T.red : T.text,
            lineHeight: 1.6,
            animation: "fadeUp 0.4s ease-out",
          }}
        >
          {aiMsg}
        </div>
      )}

      {/* Tips card */}
      {status === "idle" && (
        <GlassCard>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>
            /// FOCUS PROTOCOL
          </div>
          {[
            ["", "Phone face-down, notifications off"],
            ["", "Use noise-cancelling or lo-fi music"],
            ["", "Water bottle ready before you start"],
            ["", "Write your intention before hitting Start"],
          ].map(([ic, tip]) => (
            <div key={tip} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 9, fontSize: 12, color: T.sub }}>
              <span>{ic}</span>
              <span>{tip}</span>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
\n\n`; 

s = s.substring(0, startIdx) + newFocusTab + s.substring(endIdx); 
fs.writeFileSync('src/App.jsx', s, 'utf8'); 
console.log('Done!');
