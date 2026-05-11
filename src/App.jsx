import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  // Backgrounds
  bg: "#0D0A1A",
  bgDeep: "#080612",
  card: "rgba(255,255,255,0.04)",
  cardSolid: "#13102A",
  card2: "#1A1730",
  // Borders
  border: "rgba(168,85,247,0.15)",
  borderHov: "rgba(168,85,247,0.35)",
  // Accent palette — purple/violet/pink
  primary: "#A855F7",
  primaryDim: "#7C3AED",
  accent: "#C084FC",
  glow: "#D946EF",
  // Status
  green: "#34D399",
  amber: "#FBBF24",
  red: "#F87171",
  pink: "#F472B6",
  blue: "#60A5FA",
  // Text
  text: "#F3EEFF",
  sub: "rgba(243,238,255,0.6)",
  muted: "rgba(243,238,255,0.3)",
};

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const XPR = (lvl) => Math.round(100 * Math.pow(1.42, lvl - 1));
const calcLvl = (xp) => {
  let l = 1,
    s = 0;
  while (s + XPR(l) <= xp) {
    s += XPR(l);
    l++;
  }
  return {
    l,
    cur: xp - s,
    max: XPR(l),
    pct: Math.min(100, ((xp - s) / XPR(l)) * 100),
  };
};

const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

const callAI = async (sys, userMsg, history = []) => {
  const k = localStorage.getItem("ascend_gemini_key");
  if (!k) return "No API key found.";
  if (k === "offline") return "✦ Sensei nods in silence. (Offline Mode)";

  const messages = [
    { role: "system", content: sys },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: userMsg },
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let lastError = "";
  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${k}`,
          "HTTP-Referer": "https://ascend.app",
          "X-Title": "Ascend Focus App",
        },
        body: JSON.stringify({ model, messages, max_tokens: 150 }),
      });

      // 429 = rate limited — wait longer before trying the next model
      if (res.status === 429) {
        console.warn(`Model ${model} rate-limited (429). Waiting 5s...`);
        lastError = "Too many requests";
        if (i < FREE_MODELS.length - 1) await sleep(5000);
        continue;
      }

      const d = await res.json();
      if (d.error) {
        console.warn(`Model ${model} failed:`, d.error.message);
        lastError = d.error.message;
        if (i < FREE_MODELS.length - 1) await sleep(1000); // 1s between normal failures
        continue;
      }
      console.log(`✓ Used model: ${model}`);
      return d.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.warn(`Model ${model} threw:`, e.message);
      lastError = e.message;
      if (i < FREE_MODELS.length - 1) await sleep(1000);
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError}`);
};

const DEFAULT_USER = {
  name: "",
  xp: 0,
  streak: 0,
  lastActive: null,
  goals: [],
  tasks: [],
  skills: [
    { id: "sk1", name: "Focus", icon: "", xp: 0, color: T.primary },
    { id: "sk2", name: "Discipline", icon: "", xp: 0, color: T.accent },
    { id: "sk3", name: "Learning", icon: "", xp: 0, color: T.blue },
  ],
  xpLog: [],
};

// ══════════════════════════════════════════════
// SHARED UI COMPONENTS  (Solo Leveling Design)
// ══════════════════════════════════════════════

// Glowing progress bar
function ProgressBar({ pct, color = T.primary, h = 6 }) {
  return (
    <div
      style={{
        background: "rgba(168,85,247,0.1)",
        borderRadius: 99,
        height: h,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: "100%",
          borderRadius: 99,
          background: `linear-gradient(90deg, ${T.primaryDim}, ${color})`,
          boxShadow: `0 0 12px ${color}99`,
          transition: "width 0.7s cubic-bezier(0.34,1.2,0.64,1)",
        }}
      />
    </div>
  );
}

// Circular XP ring (SVG)
function XPRing({ pct, size = 90, color = T.primary, children }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(168,85,247,0.12)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#xpg-${size})`}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.34,1.2,0.64,1)",
          }}
        />
        <defs>
          <linearGradient id={`xpg-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.primaryDim} />
            <stop offset="100%" stopColor={T.glow} />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Glassmorphism card
function GlassCard({ children, style = {}, glow, onClick }) {
  const [hov, setHov] = useState(false);
  const glowColor = glow || T.primary;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "rgba(168,85,247,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${hov && onClick ? T.borderHov : T.border}`,
        borderRadius: 20,
        padding: "18px 20px",
        transition: "all 0.25s ease",
        cursor: onClick ? "pointer" : "default",
        transform: hov && onClick ? "translateY(-2px) scale(1.005)" : "none",
        boxShadow:
          hov && onClick
            ? `0 8px 32px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.06)`
            : `0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
        animation: "fadeUp 0.35s ease-out",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Gradient purple button
function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  style = {},
}) {
  const [hov, setHov] = useState(false);
  const bg =
    variant === "primary"
      ? `linear-gradient(135deg, ${T.primaryDim}, ${T.primary})`
      : variant === "danger"
        ? `linear-gradient(135deg, #b91c1c, ${T.red})`
        : variant === "ghost"
          ? "rgba(168,85,247,0.08)"
          : "rgba(168,85,247,0.12)";
  const border = variant === "ghost" ? `1px solid ${T.border}` : "none";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: bg,
        border,
        color: "#fff",
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        letterSpacing: "0.01em",
        padding:
          size === "sm"
            ? "7px 16px"
            : size === "lg"
              ? "14px 32px"
              : "10px 20px",
        fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13,
        opacity: disabled ? 0.35 : 1,
        transform: hov && !disabled ? "translateY(-1px)" : "translateY(0)",
        boxShadow:
          hov && !disabled && variant === "primary"
            ? `0 6px 24px rgba(168,85,247,0.45)`
            : "none",
        transition: "all 0.18s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Glass input field
function FancyInput({
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
  rows = 3,
  style = {},
  onKeyDown,
}) {
  const [f, setF] = useState(false);
  const base = {
    width: "100%",
    padding: "13px 18px",
    borderRadius: 14,
    background: "rgba(168,85,247,0.06)",
    border: `1px solid ${f ? T.borderHov : T.border}`,
    color: T.text,
    fontSize: 14,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: f ? `0 0 0 3px rgba(168,85,247,0.12)` : "none",
    resize: "vertical",
    ...style,
  };
  return multiline ? (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      rows={rows}
      style={base}
    />
  ) : (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      onKeyDown={onKeyDown}
      style={base}
    />
  );
}

// Status pill badge
function StatusBadge({ status }) {
  const map = {
    done: [T.green, "✓ Done"],
    partial: [T.amber, "~ Partial"],
    missed: [T.red, "✕ Missed"],
    pending: [T.muted, "Pending"],
  };
  const [col, lbl] = map[status] || map.pending;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: `${col}18`,
        color: col,
        border: `1px solid ${col}33`,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {lbl}
    </span>
  );
}

// Pill tag
function Tag({ children, color = T.primary }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

// Section header (used inside every tab)
function SectionHeader({ title, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: T.text,
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: "-0.3px",
        }}
      >
        {title}
      </div>
      {action}
    </div>
  );
}

// ══════════════════════════════════════════════
// DASHBOARD TAB  —  Solo Leveling Style
// ══════════════════════════════════════════════
function DashTab({ user, gainXP, setU }) {
  const lvl = calcLvl(user.xp);
  const tasks = user.tasks.filter((t) => t.date === today());
  const done = tasks.filter((t) => t.status === "done").length;
  const todayXP = (user.xpLog || [])
    .filter((e) => e.date === today())
    .reduce((s, e) => s + e.amount, 0);
  const goalPct = user.goals.length
    ? Math.round(
        user.goals.reduce((s, g) => {
          const gt = user.tasks.filter((t) => t.goalId === g.id);
          return (
            s +
            (gt.length
              ? (gt.filter((t) => t.status === "done").length / gt.length) * 100
              : 0)
          );
        }, 0) / user.goals.length,
      )
    : 0;
  const nextTask = tasks.find((t) => t.status === "pending");

  const markDone = (t) => {
    setU((u) => ({
      ...u,
      tasks: u.tasks.map((x) => (x.id === t.id ? { ...x, status: "done" } : x)),
      xpLog: [
        ...(u.xpLog || []),
        { amount: t.xp, source: t.title, date: today() },
      ],
    }));
    gainXP(t.xp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Hero XP Ring + Stats ── */}
      <GlassCard style={{ padding: "24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <XPRing pct={lvl.pct} size={96}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: 20,
                color: T.text,
                lineHeight: 1,
              }}
            >
              {lvl.l}
            </div>
            <div
              style={{ fontSize: 10, color: T.muted, letterSpacing: "0.04em" }}
            >
              LEVEL
            </div>
          </XPRing>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                color: T.muted,
                fontWeight: 600,
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              SOLO LEVELING SYSTEM
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: T.text,
                marginBottom: 2,
              }}
            >
              {user.name}
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 10 }}>
              {user.xp.toLocaleString()} Total XP
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {user.streak > 0 && (
                <Tag color={T.amber}>STREAK {user.streak} streak</Tag>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Stat Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          {
            icon: "///",
            label: "XP Today",
            value: `+${todayXP}`,
            color: T.accent,
          },
          {
            icon: "[DONE]",
            label: "Tasks Done",
            value: `${done}/${tasks.length}`,
            color: T.green,
          },
          {
            icon: "◎",
            label: "Active Quests",
            value: user.goals.length,
            color: T.primary,
          },
          {
            icon: "",
            label: "Goal Progress",
            value: `${goalPct}%`,
            color: T.pink,
          },
        ].map(({ icon, label, value, color }) => (
          <GlassCard key={label} style={{ padding: "16px 14px" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24,
                fontWeight: 800,
                color,
                lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: T.muted,
                marginTop: 4,
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Next Task Banner ── */}
      {nextTask && (
        <div
          style={{
            background: `linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))`,
            border: `1px solid rgba(168,85,247,0.3)`,
            borderRadius: 18,
            padding: "16px 18px",
            boxShadow: "0 0 24px rgba(168,85,247,0.1)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.accent,
              fontWeight: 700,
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}
          >
            ★ NEXT QUEST TASK
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.text,
              marginBottom: 12,
            }}
          >
            {nextTask.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Btn onClick={() => markDone(nextTask)} size="sm">
              ✓ Complete Task
            </Btn>
            <Tag color={T.accent}>+{nextTask.xp} XP</Tag>
          </div>
        </div>
      )}

      {/* ── Skill Tracker (Solo Leveling style) ── */}
      <GlassCard>
        <SectionHeader title=" Skill Tracker" />
        {user.skills.length === 0 ? (
          <div
            style={{
              color: T.muted,
              fontSize: 13,
              textAlign: "center",
              padding: "12px 0",
            }}
          >
            No skills yet — go to Skills tab
          </div>
        ) : (
          user.skills.slice(0, 5).map((s, i) => {
            const si = calcLvl(s.xp);
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom:
                    i < user.skills.length - 1
                      ? `1px solid ${T.border}`
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: `${s.color}18`,
                    border: `1px solid ${s.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{ fontSize: 13, fontWeight: 600, color: T.text }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{ fontSize: 11, color: s.color, fontWeight: 700 }}
                    >
                      Lv.{si.l}
                    </span>
                  </div>
                  <ProgressBar pct={si.pct} color={s.color} h={5} />
                </div>
              </div>
            );
          })
        )}
      </GlassCard>

      {/* ── Today's Agenda ── */}
      <GlassCard>
        <SectionHeader
          title=" Today's Agenda"
          action={
            <Tag color={T.muted}>
              {done}/{tasks.length} done
            </Tag>
          }
        />
        {tasks.length === 0 ? (
          <div
            style={{
              color: T.muted,
              fontSize: 13,
              textAlign: "center",
              padding: "20px 0",
              lineHeight: 1.6,
            }}
          >
            No tasks today.
            <br />
            <span style={{ color: T.primary }}>
              Go to Quests to generate your roadmap →
            </span>
          </div>
        ) : (
          tasks.map((t, i) => (
            <div
              key={t.id}
              onClick={() => t.status === "pending" && markDone(t)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom:
                  i < tasks.length - 1 ? `1px solid ${T.border}` : "none",
                cursor: t.status === "pending" ? "pointer" : "default",
                opacity: t.status === "done" ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 8,
                  flexShrink: 0,
                  background:
                    t.status === "done"
                      ? `${T.green}22`
                      : t.status === "partial"
                        ? `${T.amber}22`
                        : "rgba(168,85,247,0.1)",
                  border: `1px solid ${t.status === "done" ? T.green : t.status === "partial" ? T.amber : T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: t.status === "done" ? T.green : T.amber,
                }}
              >
                {t.status === "done" ? "✓" : t.status === "partial" ? "~" : ""}
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.status === "done" ? T.muted : T.text,
                  textDecoration: t.status === "done" ? "line-through" : "none",
                }}
              >
                {t.title}
              </div>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>
                +{t.xp}
              </div>
            </div>
          ))
        )}
      </GlassCard>
    </div>
  );
}

// ══════════════════════════════════════════════
// GOALS TAB  —  Active Quests
// ══════════════════════════════════════════════
function GoalsTab({ user, setU, gainXP }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [ddl, setDdl] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const generate = async () => {
    if (loading) return;
    if (!title.trim()) return;
    setLoading(true);
    try {
      const sys = `You are a goal decomposition expert. Return ONLY valid JSON — no markdown, no explanation.
Schema: { "phases": [{ "name": string, "duration": string, "milestones": [string], "tasks": [{ "title": string, "description": string, "xp": number, "daysFromNow": number }] }] }
Rules: 2-3 phases, 2-4 tasks each. xp 15-60 based on difficulty. daysFromNow: spread tasks over the goal timeline.`;
      const raw = await callAI(
        sys,
        `Goal: ${title}\nContext: ${desc}\nDeadline: ${ddl || "flexible"}`,
      );
      let json;
      try {
        if (raw.includes("Offline Mode")) throw new Error("Offline");
        json = JSON.parse(raw.replace(/```json?|```/g, "").trim());
      } catch (e) {
        // Fallback mock JSON for Offline Mode or parse failures
        json = {
          phases: [
            {
              name: "Phase 1: Foundation",
              duration: "Week 1",
              milestones: ["Initial research and setup"],
              tasks: [
                {
                  title: `Start working on ${title}`,
                  description: "Initial step for offline generation.",
                  xp: 20,
                  daysFromNow: 1,
                },
                {
                  title: "Define roadmap",
                  description: "Offline fallback task.",
                  xp: 30,
                  daysFromNow: 2,
                },
              ],
            },
          ],
        };
      }
      const goalId = uid();
      const base = new Date();
      const tasks = json.phases.flatMap((ph) =>
        ph.tasks.map((t) => {
          const d = new Date(base);
          d.setDate(d.getDate() + (t.daysFromNow || 0));
          return {
            id: uid(),
            goalId,
            title: t.title,
            description: t.description || "",
            xp: t.xp || 20,
            date: d.toISOString().slice(0, 10),
            status: "pending",
            phase: ph.name,
          };
        }),
      );
      setU((u) => ({
        ...u,
        goals: [
          ...u.goals,
          {
            id: goalId,
            title,
            description: desc,
            deadline: ddl,
            phases: json.phases,
            createdAt: today(),
          },
        ],
        tasks: [...u.tasks, ...tasks],
      }));
      setOpen(false);
      setTitle("");
      setDesc("");
      setDdl("");
    } catch (e) {
      alert("AI generation failed — check console.");
      console.error(e);
    }
    setLoading(false);
  };

  const del = (id) =>
    setU((u) => ({
      ...u,
      goals: u.goals.filter((g) => g.id !== id),
      tasks: u.tasks.filter((t) => t.goalId !== id),
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader
        title="◎ Active Quests"
        action={
          <Btn
            onClick={() => setOpen((s) => !s)}
            size="sm"
            variant={open ? "ghost" : "primary"}
          >
            {open ? "✕ Cancel" : "+ New Quest"}
          </Btn>
        }
      />

      {/* AI Form */}
      {open && (
        <div
          style={{
            background: "rgba(124,58,237,0.08)",
            border: `1px solid rgba(168,85,247,0.3)`,
            borderRadius: 20,
            padding: "20px 18px",
            animation: "fadeUp 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: T.accent,
              fontWeight: 700,
              letterSpacing: "0.1em",
              marginBottom: 16,
            }}
          >
            ✦ AI QUEST GENERATOR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FancyInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quest title — e.g. Learn Java Programming"
            />
            <FancyInput
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              multiline
              rows={3}
              placeholder="Describe your goal, current level, and what success looks like..."
            />
            <FancyInput
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              placeholder="Target deadline (e.g. 3 months, optional)"
            />
            <Btn
              onClick={generate}
              disabled={loading || !title.trim()}
              size="lg"
            >
              {loading
                ? "/// Generating roadmap..."
                : "/// Generate AI Roadmap"}
            </Btn>
          </div>
        </div>
      )}

      {/* Empty state */}
      {user.goals.length === 0 && !open && (
        <div style={{ textAlign: "center", padding: "56px 0", color: T.muted }}>
          <div
            style={{ fontSize: 52, marginBottom: 16, filter: "grayscale(0.3)" }}
          >
            ◎
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 18,
              color: T.sub,
              marginBottom: 8,
            }}
          >
            No active quests
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Click <span style={{ color: T.primary }}>+ New Quest</span> to have
            AI
            <br />
            build your roadmap automatically
          </div>
        </div>
      )}

      {/* Quest Cards */}
      {user.goals.map((g) => {
        const gt = user.tasks.filter((t) => t.goalId === g.id);
        const dn = gt.filter((t) => t.status === "done").length;
        const pct = gt.length ? Math.round((dn / gt.length) * 100) : 0;
        const isEx = expanded === g.id;
        return (
          <div
            key={g.id}
            style={{
              background: "rgba(168,85,247,0.05)",
              backdropFilter: "blur(16px)",
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              overflow: "hidden",
              animation: "fadeUp 0.3s ease-out",
            }}
          >
            {/* Card header — clickable */}
            <div
              onClick={() => setExpanded(isEx ? null : g.id)}
              style={{ padding: "18px 18px 0", cursor: "pointer" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                {/* Mini XP ring */}
                <XPRing pct={pct} size={56}>
                  <div
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 800,
                      fontSize: 13,
                      color: T.text,
                    }}
                  >
                    {pct}
                    <span style={{ fontSize: 8 }}>%</span>
                  </div>
                </XPRing>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.text,
                      marginBottom: 3,
                    }}
                  >
                    {g.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <Tag color={T.muted}>{gt.length} tasks</Tag>
                    <Tag color={T.green}>{dn} done</Tag>
                    {g.deadline && <Tag color={T.amber}>Due {g.deadline}</Tag>}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    del(g.id);
                  }}
                  style={{
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    color: T.red,
                    cursor: "pointer",
                    borderRadius: 8,
                    width: 28,
                    height: 28,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: "0 0 14px" }}>
                <ProgressBar pct={pct} h={5} />
              </div>
            </div>

            {/* Expanded phases */}
            {isEx && (
              <div
                style={{
                  borderTop: `1px solid ${T.border}`,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {(g.phases || []).map((ph, pi) => (
                  <div key={pi}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          background: T.primary,
                          boxShadow: `0 0 8px ${T.primary}`,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.primary,
                        }}
                      >
                        {ph.name}
                      </div>
                      <Tag color={T.accent}>{ph.duration}</Tag>
                    </div>
                    {ph.milestones?.map((m, mi) => (
                      <div
                        key={mi}
                        style={{
                          fontSize: 12,
                          color: T.sub,
                          paddingLeft: 16,
                          marginBottom: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        ◆ {m}
                      </div>
                    ))}
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {gt
                        .filter((t) => t.phase === ph.name)
                        .map((t) => (
                          <div
                            key={t.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              background: "rgba(168,85,247,0.04)",
                              borderRadius: 10,
                              border: `1px solid ${T.border}`,
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 5,
                                flexShrink: 0,
                                background:
                                  t.status === "done"
                                    ? `${T.green}22`
                                    : "rgba(168,85,247,0.1)",
                                border: `1px solid ${t.status === "done" ? T.green : T.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                color: T.green,
                              }}
                            >
                              {t.status === "done" ? "✓" : ""}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                fontSize: 12,
                                color: t.status === "done" ? T.muted : T.sub,
                                textDecoration:
                                  t.status === "done" ? "line-through" : "none",
                              }}
                            >
                              {t.title}
                            </div>
                            <div style={{ fontSize: 10, color: T.muted }}>
                              {fmtDate(t.date)}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.accent,
                                fontWeight: 600,
                              }}
                            >
                              +{t.xp}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// TASKS TAB  —  Task Log
// ══════════════════════════════════════════════
function TasksTab({ user, setU, gainXP }) {
  const [filter, setFilter] = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", xp: "20", date: today() });

  const tasks =
    filter === "today"
      ? user.tasks.filter((t) => t.date === today())
      : filter === "pending"
        ? user.tasks.filter((t) => t.status === "pending")
        : user.tasks.slice().reverse();

  const setStatus = (id, status) => {
    const t = user.tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const xpGain =
      status === "done"
        ? t.xp
        : status === "partial"
          ? Math.floor(t.xp * 0.4)
          : 0;
    setU((u) => ({
      ...u,
      tasks: u.tasks.map((x) => (x.id === id ? { ...x, status } : x)),
      xpLog:
        xpGain > 0
          ? [
              ...(u.xpLog || []),
              { amount: xpGain, source: t.title, date: today() },
            ]
          : u.xpLog || [],
    }));
    if (xpGain > 0) gainXP(xpGain);
  };

  const addTask = () => {
    if (!form.title.trim()) return;
    setU((u) => ({
      ...u,
      tasks: [
        ...u.tasks,
        {
          id: uid(),
          goalId: null,
          title: form.title,
          xp: parseInt(form.xp) || 20,
          date: form.date,
          status: "pending",
        },
      ],
    }));
    setForm({ title: "", xp: "20", date: today() });
    setShowAdd(false);
  };

  const delTask = (id) =>
    setU((u) => ({ ...u, tasks: u.tasks.filter((t) => t.id !== id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="✓ Task Log"
        action={
          <Btn
            onClick={() => setShowAdd((s) => !s)}
            size="sm"
            variant={showAdd ? "ghost" : "primary"}
          >
            {showAdd ? "Cancel" : "+ Task"}
          </Btn>
        }
      />

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8 }}>
        {["today", "pending", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "7px 16px",
              borderRadius: 99,
              border: `1px solid ${filter === f ? T.primary : T.border}`,
              background:
                filter === f ? `rgba(168,85,247,0.15)` : "transparent",
              color: filter === f ? T.primary : T.muted,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Add task form */}
      {showAdd && (
        <div
          style={{
            background: "rgba(52,211,153,0.06)",
            border: `1px solid rgba(52,211,153,0.2)`,
            borderRadius: 18,
            padding: "18px",
            animation: "fadeUp 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.green,
              fontWeight: 700,
              letterSpacing: "0.1em",
              marginBottom: 14,
            }}
          >
            ✦ NEW TASK
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FancyInput
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Task title..."
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <FancyInput
                value={form.xp}
                onChange={(e) => setForm((p) => ({ ...p, xp: e.target.value }))}
                placeholder="XP reward"
                style={{ flex: 1 }}
              />
              <FancyInput
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                type="date"
                style={{ flex: 1, colorScheme: "dark" }}
              />
            </div>
            <Btn onClick={addTask}>Add Task</Btn>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>///</div>
          <div style={{ fontSize: 14, color: T.sub }}>
            All clear — nothing here!
          </div>
        </div>
      ) : (
        tasks.map((t, i) => (
          <div
            key={t.id}
            style={{
              background: "rgba(168,85,247,0.04)",
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: "14px 16px",
              animation: "fadeUp 0.3s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: t.status === "pending" ? 12 : 0,
              }}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.status === "done" ? T.muted : T.text,
                    textDecoration:
                      t.status === "done" ? "line-through" : "none",
                    marginBottom: 6,
                  }}
                >
                  {t.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <Tag color={T.accent}>+{t.xp} XP</Tag>
                  {t.phase && <Tag color={T.primary}>{t.phase}</Tag>}
                  <span style={{ fontSize: 10, color: T.muted }}>
                    {fmtDate(t.date)}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                <StatusBadge status={t.status} />
                <button
                  onClick={() => delTask(t.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  delete
                </button>
              </div>
            </div>
            {t.status === "pending" && (
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  ["done", "✓ Done", T.green],
                  ["partial", "~ Partial", T.amber],
                  ["missed", "✕ Miss", T.red],
                ].map(([s, lbl, c]) => (
                  <button
                    key={s}
                    onClick={() => setStatus(t.id, s)}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      borderRadius: 10,
                      border: `1px solid ${c}33`,
                      background: `${c}12`,
                      color: c,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'Space Grotesk', sans-serif",
                      transition: "background 0.15s",
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// SKILLS TAB  —  Solo Leveling Style
// ══════════════════════════════════════════════
function SkillsTab({ user, setU, gainXP }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "✦", color: T.primary });
  const ICONS = [
    "✦",
    "❖",
    "⊗",
    "⟁",
    "⎈",
    "⌘",
    "⌖",
    "⎊",
    "⍟",
    "⌬",
    "⎔",
    "⏣",
    "⬡",
    "⛋",
    "◭",
    "◬",
    "⟐",
    "◈",
    "◇",
    "⬢",
  ];
  const COLORS = [
    T.primary,
    T.accent,
    T.green,
    T.amber,
    "#F472B6",
    "#34D399",
    "#60A5FA",
    "#A78BFA",
    "#FB923C",
    "#4DD0E1",
  ];

  const addSkill = () => {
    if (!form.name.trim()) return;
    setU((u) => ({
      ...u,
      skills: [
        ...u.skills,
        {
          id: uid(),
          name: form.name,
          icon: form.icon,
          color: form.color,
          xp: 0,
        },
      ],
    }));
    setForm({ name: "", icon: "///", color: T.primary });
    setShowAdd(false);
  };

  const trainSkill = (skillId, amt) => {
    setU((u) => ({
      ...u,
      xp: u.xp + amt,
      skills: u.skills.map((s) =>
        s.id === skillId ? { ...s, xp: s.xp + amt } : s,
      ),
      xpLog: [
        ...(u.xpLog || []),
        { amount: amt, source: "Skill training", date: today() },
      ],
    }));
    gainXP(amt);
  };

  const delSkill = (id) =>
    setU((u) => ({ ...u, skills: u.skills.filter((s) => s.id !== id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader
        title="/// Skill Tree"
        action={
          <Btn
            onClick={() => setShowAdd((s) => !s)}
            size="sm"
            variant={showAdd ? "ghost" : "primary"}
          >
            {showAdd ? "Cancel" : "+ New Skill"}
          </Btn>
        }
      />

      {/* Add skill form */}
      {showAdd && (
        <div
          style={{
            background: "rgba(124,58,237,0.08)",
            border: `1px solid rgba(168,85,247,0.3)`,
            borderRadius: 20,
            padding: "20px 18px",
            animation: "fadeUp 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.accent,
              fontWeight: 700,
              letterSpacing: "0.12em",
              marginBottom: 14,
            }}
          >
            ✦ CREATE NEW SKILL
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FancyInput
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Skill name..."
            />

            {/* Icon picker */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: T.muted,
                  marginBottom: 8,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                CHOOSE ICON
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: `2px solid ${form.icon === ic ? T.primary : T.border}`,
                      background:
                        form.icon === ic
                          ? `rgba(168,85,247,0.2)`
                          : "rgba(168,85,247,0.05)",
                      fontSize: 18,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow:
                        form.icon === ic
                          ? `0 0 12px rgba(168,85,247,0.4)`
                          : "none",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color swatches */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: T.muted,
                  marginBottom: 8,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                CHOOSE COLOR
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map((cl) => (
                  <button
                    key={cl}
                    onClick={() => setForm((p) => ({ ...p, color: cl }))}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 99,
                      background: cl,
                      border: "none",
                      cursor: "pointer",
                      outline:
                        form.color === cl
                          ? `3px solid ${cl}`
                          : "3px solid transparent",
                      outlineOffset: 3,
                      transition: "outline 0.15s",
                      boxShadow:
                        form.color === cl ? `0 0 12px ${cl}88` : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: `${form.color}0d`,
                borderRadius: 12,
                border: `1px solid ${form.color}30`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `${form.color}22`,
                  border: `1px solid ${form.color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                {form.icon}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    color: T.text,
                    fontSize: 15,
                  }}
                >
                  {form.name || "Skill Name"}
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  Level 1 · 0 XP
                </div>
              </div>
            </div>
            <Btn onClick={addSkill}>Create Skill</Btn>
          </div>
        </div>
      )}

      {/* Empty state */}
      {user.skills.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}></div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16,
              color: T.sub,
              marginBottom: 6,
            }}
          >
            No skills yet
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Create your first skill to start
            <br />
            tracking your leveling progress
          </div>
        </div>
      )}

      {/* Skill cards */}
      {user.skills.map((s) => {
        const si = calcLvl(s.xp);
        return (
          <div
            key={s.id}
            style={{
              background: "rgba(168,85,247,0.04)",
              border: `1px solid ${s.color}33`,
              borderRadius: 20,
              padding: "18px",
              boxShadow: `0 0 20px ${s.color}0d`,
              animation: "fadeUp 0.3s ease-out",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              {/* Skill XP Ring */}
              <XPRing pct={si.pct} size={68} color={s.color}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
              </XPRing>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.text,
                    marginBottom: 2,
                  }}
                >
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {s.xp.toLocaleString()} total XP
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <Tag color={s.color}>Lv.{si.l}</Tag>
                  <Tag color={T.muted}>
                    {Math.round(si.pct)}% to Lv.{si.l + 1}
                  </Tag>
                </div>
              </div>
              <button
                onClick={() => delSkill(s.id)}
                style={{
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.18)",
                  color: T.red,
                  cursor: "pointer",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                remove
              </button>
            </div>

            {/* XP Progress bar */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: T.muted,
                  marginBottom: 6,
                }}
              >
                <span>
                  {si.cur.toLocaleString()} / {si.max.toLocaleString()} XP
                </span>
                <span style={{ color: s.color, fontWeight: 600 }}>
                  {(si.max - si.cur).toLocaleString()} to next level
                </span>
              </div>
              <ProgressBar pct={si.pct} color={s.color} h={8} />
            </div>

            {/* Train buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              {[10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => trainSkill(s.id, amt)}
                  style={{
                    flex: 1,
                    padding: "9px 4px",
                    borderRadius: 12,
                    border: `1px solid ${s.color}44`,
                    background: `${s.color}10`,
                    color: s.color,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  +{amt} XP
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// FOCUS TAB  —  Solo Leveling Timer
// ══════════════════════════════════════════════
function FocusTab({ user, gainXP, setU, active }) {
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
    {
      id: "deep",
      label: "Deep Work",
      icon: "///",
      color: T.primary,
      mins: 25,
      desc: "Pause and reset at will",
    },
    {
      id: "monk",
      label: "Monk Mode",
      icon: "❖",
      color: T.amber,
      mins: 50,
      desc: "Strict pause limit, no resets",
    },
    {
      id: "flow",
      label: "Flow State",
      icon: "⊗",
      color: T.green,
      mins: 90,
      desc: "No pause. Quitting loses all progress",
    },
  ];
  const currentMode = MODES.find((m) => m.id === mode);

  useEffect(() => {
    if (
      !active &&
      mode === "flow" &&
      (status === "running" || status === "paused")
    ) {
      clearInterval(timerRef.current);
      clearInterval(pauseTimerRef.current);
      setStatus("failed");
      setTimeLeft(0);
      setAiMsg(
        "Flow State broken! You lost focus by leaving the tab. 0 XP gained.",
      );
    }
  }, [active, mode, status]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
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
              xpLog: [
                ...(u.xpLog || []),
                {
                  amount: xp,
                  source: `Focus: ${currentMode.label}`,
                  date: today(),
                },
              ],
            }));
            setAiMsg(`Session complete! +${xp} XP earned. You're ascending.`);
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
    if (
      mode === "monk" &&
      status !== "failed" &&
      status !== "done" &&
      status !== "idle"
    )
      return;
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
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => selectMode(m)}
            style={{
              padding: "12px 8px",
              borderRadius: 16,
              cursor:
                status !== "idle" && status !== "done" && status !== "failed"
                  ? "not-allowed"
                  : "pointer",
              background:
                mode === m.id ? `${m.color}18` : "rgba(168,85,247,0.04)",
              border: `1px solid ${mode === m.id ? m.color + "55" : T.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              boxShadow: mode === m.id ? `0 0 20px ${m.color}22` : "none",
              transition: "all 0.2s",
              opacity:
                status !== "idle" &&
                status !== "done" &&
                status !== "failed" &&
                mode !== m.id
                  ? 0.4
                  : 1,
            }}
          >
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: mode === m.id ? m.color : T.muted,
              }}
            >
              {m.label}
            </span>
            <span style={{ fontSize: 10, color: T.muted }}>{m.mins}m</span>
          </button>
        ))}
      </div>

      {mode === "monk" && status === "idle" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "center",
            fontSize: 12,
            color: T.muted,
          }}
        >
          Max Pause Bank:
          <select
            value={monkMaxPause}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setMonkMaxPause(val);
              setMonkPauseLeft(val);
            }}
            style={{
              background: "rgba(0,0,0,0.3)",
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "4px 8px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value={5}>5 Seconds</option>
            <option value={60}>1 Minute</option>
            <option value={300}>5 Minutes</option>
          </select>
        </div>
      )}

      {/* Timer Ring */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
        }}
      >
        <div
          style={{ position: "relative", width: ringSize, height: ringSize }}
        >
          <svg
            width={ringSize}
            height={ringSize}
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(168,85,247,0.1)"
              strokeWidth={12}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={status === "failed" ? T.red : currentMode.color}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              style={{
                transition: "stroke-dashoffset 0.9s ease",
                filter: `drop-shadow(0 0 10px ${status === "failed" ? T.red : currentMode.color}88)`,
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 42,
                fontWeight: 800,
                color: status === "failed" ? T.red : T.text,
                letterSpacing: "-2px",
                lineHeight: 1,
              }}
            >
              {fmt(timeLeft)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: status === "failed" ? T.red : T.muted,
                marginTop: 4,
              }}
            >
              {status === "idle"
                ? currentMode.desc
                : status === "running"
                  ? "Focus active"
                  : status === "paused"
                    ? "Paused"
                    : status === "done"
                      ? "Complete! ✓"
                      : "Failed ✕"}
            </div>
            {status === "paused" && mode === "monk" && (
              <div
                style={{
                  fontSize: 13,
                  color: T.red,
                  fontWeight: 600,
                  marginTop: 6,
                  animation: "pulse 1s infinite",
                }}
              >
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
          Reward:{" "}
          <span style={{ color: currentMode.color, fontWeight: 700 }}>
            +{Math.round(duration * 3)} XP
          </span>{" "}
          on completion
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        {status === "idle" ||
        status === "paused" ||
        status === "done" ||
        status === "failed" ? (
          <Btn
            onClick={status === "done" || status === "failed" ? reset : start}
            size="lg"
            style={{ flex: 1 }}
          >
            {status === "paused"
              ? "▶ Resume"
              : status === "done" || status === "failed"
                ? "↻ Reset"
                : "▶ Start Session"}
          </Btn>
        ) : (
          mode !== "flow" && (
            <Btn onClick={pause} size="lg" variant="ghost" style={{ flex: 1 }}>
              ⏸ Pause
            </Btn>
          )
        )}

        {status !== "idle" &&
          status !== "done" &&
          status !== "failed" &&
          mode !== "monk" && (
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
            background:
              status === "failed"
                ? "rgba(248,113,113,0.1)"
                : `${currentMode.color}0d`,
            border: `1px solid ${status === "failed" ? "rgba(248,113,113,0.3)" : currentMode.color + "33"}`,
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
          <div
            style={{
              fontSize: 11,
              color: T.accent,
              fontWeight: 700,
              letterSpacing: "0.1em",
              marginBottom: 12,
            }}
          >
            /// FOCUS PROTOCOL
          </div>
          {[
            ["", "Phone face-down, notifications off"],
            ["", "Use noise-cancelling or lo-fi music"],
            ["", "Water bottle ready before you start"],
            ["", "Write your intention before hitting Start"],
          ].map(([ic, tip]) => (
            <div
              key={tip}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 9,
                fontSize: 12,
                color: T.sub,
              }}
            >
              <span>{ic}</span>
              <span>{tip}</span>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// AI COACH TAB  —  Solo Leveling Style
// ══════════════════════════════════════════════
function AITab({ user }) {
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);
  const lvl = calcLvl(user.xp);

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const analyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysis("");
    const recent = user.tasks.slice(-15);
    const dnPct = recent.length
      ? Math.round(
          (recent.filter((t) => t.status === "done").length / recent.length) *
            100,
        )
      : 0;
    try {
      const r = await callAI(
        "Roleplay as Ascend AI Coach, a sharp and encouraging productivity coach. Speak directly to the user. Do NOT repeat your instructions. Give 3-4 specific, actionable insights using bullet points (•). Max 200 words.",
        `User Stats: Level ${lvl.l}, ${user.xp} XP, ${user.streak}-day streak, ${dnPct}% task completion, ${user.goals.length} active quests, ${user.skills.length} skills. Recent Activity: ${JSON.stringify(recent.map((t) => ({ title: t.title, status: t.status })))}`,
      );
      setAnalysis(r);
    } catch {
      setAnalysis("Analysis failed. Check your connection.");
    }
    setAnalyzing(false);
  };

  const send = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChat((p) => [...p, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      const reply = await callAI(
        `Roleplay as Ascend AI Coach. Be supportive, sharp, and results-focused. Speak directly to the user. Do NOT repeat your instructions. User Stats: Level ${lvl.l}, ${user.xp} XP, ${user.streak}-day streak, ${user.goals.length} quests. Max 120 words.`,
        msg,
        chat.slice(-6),
      );
      setChat((p) => [...p, { role: "assistant", text: reply }]);
    } catch {
      setChat((p) => [
        ...p,
        { role: "assistant", text: "Connection error. Try again." },
      ]);
    }
    setChatLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="✦ AI Coach" />

      {/* Player Stats strip */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        {[
          { label: "Level", value: lvl.l, color: T.primary },
          { label: "Streak", value: `${user.streak}d STREAK`, color: T.amber },
          { label: "Quests", value: user.goals.length, color: T.accent },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: `${color}0d`,
              border: `1px solid ${color}22`,
              borderRadius: 14,
              padding: "12px 10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 10,
                color: T.muted,
                marginTop: 2,
                letterSpacing: "0.06em",
              }}
            >
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Analysis card */}
      <div
        style={{
          background: "rgba(217,70,239,0.06)",
          border: `1px solid rgba(217,70,239,0.25)`,
          borderRadius: 20,
          padding: "18px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: T.accent,
            fontWeight: 700,
            letterSpacing: "0.1em",
            marginBottom: 12,
          }}
        >
          {" "}
          PERFORMANCE ANALYSIS
        </div>
        {analysis ? (
          <div
            style={{
              fontSize: 13,
              color: T.sub,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
              marginBottom: 14,
            }}
          >
            {analysis}
          </div>
        ) : !analyzing ? (
          <div
            style={{
              fontSize: 13,
              color: T.muted,
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            Get a personalized AI breakdown of your progress patterns and smart
            recommendations.
          </div>
        ) : null}
        <Btn onClick={analyze} disabled={analyzing} size="sm">
          {analyzing ? "/// Analyzing patterns..." : "/// Analyze My Progress"}
        </Btn>
      </div>

      {/* Chat interface */}
      <div
        style={{
          background: "rgba(168,85,247,0.04)",
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: T.primary,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          {" "}
          COACH CHAT
        </div>

        {/* Messages */}
        <div
          ref={chatRef}
          style={{
            maxHeight: 280,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingRight: 2,
          }}
        >
          {chat.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: T.muted,
                textAlign: "center",
                padding: "20px 0",
                lineHeight: 1.6,
              }}
            >
              Ask me anything — goals, habits,
              <br />
              motivation, or strategy.
            </div>
          )}
          {chat.map((m, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                borderRadius: 16,
                fontSize: 13,
                lineHeight: 1.7,
                background:
                  m.role === "user"
                    ? `rgba(168,85,247,0.15)`
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${m.role === "user" ? "rgba(168,85,247,0.3)" : T.border}`,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "86%",
                color: m.role === "user" ? T.primary : T.sub,
                animation: "fadeUp 0.2s ease-out",
              }}
            >
              {m.text}
            </div>
          ))}
          {chatLoading && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                color: T.muted,
                fontSize: 13,
                alignSelf: "flex-start",
              }}
            >
              <span style={{ animation: "pulse 1.2s infinite" }}>
                ✦ Thinking...
              </span>
            </div>
          )}
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask your coach..."
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 14,
              background: "rgba(168,85,247,0.06)",
              border: `1px solid ${T.border}`,
              color: T.text,
              fontSize: 13,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
            }}
          />
          <button
            onClick={send}
            disabled={chatLoading}
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              border: "none",
              cursor: chatLoading ? "not-allowed" : "pointer",
              background: `linear-gradient(135deg, ${T.primaryDim}, ${T.primary})`,
              color: "white",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 16px rgba(168,85,247,0.4)`,
              flexShrink: 0,
              opacity: chatLoading ? 0.5 : 1,
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: T.muted,
            fontWeight: 600,
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          QUICK PROMPTS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "What should I focus on today?",
            "How can I level up my skills faster?",
            "I'm feeling unmotivated. Help me.",
            "Review my quest strategy.",
          ].map((q) => (
            <button
              key={q}
              onClick={() => {
                setChatInput(q);
              }}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(168,85,247,0.04)",
                border: `1px solid ${T.border}`,
                color: T.sub,
                fontSize: 12,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function Ascend() {
  const [setupDone, setSetupDone] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [user, setUser] = useState(DEFAULT_USER);
  const [tab, setTab] = useState("dash");
  const [xpPops, setXpPops] = useState([]);
  const [lvlUpMsg, setLvlUpMsg] = useState(null);

  const [geminiKey, setGeminiKey] = useState(
    () => localStorage.getItem("ascend_gemini_key") || "",
  );
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [testingKey, setTestingKey] = useState(false);

  // Load fonts
  useEffect(() => {
    if (!document.getElementById("asc-fonts")) {
      const el = document.createElement("link");
      el.id = "asc-fonts";
      el.rel = "stylesheet";
      el.href =
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap";
      document.head.appendChild(el);
    }
  }, []);

  // Load from storage
  useEffect(() => {
    window.storage
      ?.get("asc_v2")
      .then((r) => {
        if (r?.value) {
          const u = JSON.parse(r.value);
          setUser(u);
          if (u.name) setSetupDone(true);
        }
      })
      .catch(() => {});
  }, []);

  const persist = (u) => {
    try {
      window.storage?.set("asc_v2", JSON.stringify(u));
    } catch {}
  };

  const setU = useCallback((fn) => {
    setUser((prev) => {
      const next = typeof fn === "function" ? fn(prev) : { ...prev, ...fn };
      persist(next);
      return next;
    });
  }, []);

  // Streak logic
  const bumpStreak = () => {
    const t = today();
    setU((u) => {
      if (u.lastActive === t) return u;
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const ys = yest.toISOString().slice(0, 10);
      return {
        ...u,
        streak: u.lastActive === ys ? u.streak + 1 : 1,
        lastActive: t,
      };
    });
  };

  // XP gain with popup + level-up check
  const gainXP = useCallback((amount) => {
    const id = uid();
    setXpPops((p) => [...p, { id, amount }]);
    setTimeout(() => setXpPops((p) => p.filter((x) => x.id !== id)), 2500);
    setUser((prev) => {
      const oldLvl = calcLvl(prev.xp).l;
      const newXP = prev.xp + amount;
      const newLvl = calcLvl(newXP).l;
      if (newLvl > oldLvl) {
        setLvlUpMsg(newLvl);
        setTimeout(() => setLvlUpMsg(null), 3500);
      }
      const next = { ...prev, xp: newXP };
      persist(next);
      return next;
    });
  }, []);

  // Initial bump streak
  useEffect(() => {
    bumpStreak();
  }, []);

  // ── SETUP SCREEN ──────────────────────────────────
  if (!setupDone)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "rgba(8,6,18,0.85)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
            top: "-20%",
            left: "-15%",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,70,239,0.2) 0%, transparent 70%)",
            bottom: "-15%",
            right: "-10%",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            zIndex: 1,
            background: "rgba(168,85,247,0.06)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: 28,
            padding: "48px 36px",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            animation: "fadeUp 0.5s ease-out",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${T.primaryDim}, ${T.glow})`,
                margin: "0 auto 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                boxShadow: "0 0 32px rgba(168,85,247,0.5)",
              }}
            >
              ///
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 26,
                fontWeight: 800,
                color: T.text,
                letterSpacing: "-0.5px",
              }}
            >
              ASCEND
            </div>
            <div style={{ color: T.muted, marginTop: 8, fontSize: 14 }}>
              Your Solo Leveling journey begins
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.muted,
              fontWeight: 600,
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            YOUR NAME
          </div>
          <FancyInput
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && finishSetup()}
            placeholder="What shall we call you?"
            style={{ marginBottom: 20 }}
          />
          <Btn
            onClick={finishSetup}
            disabled={!nameInput.trim()}
            size="lg"
            style={{ width: "100%" }}
          >
            Begin Ascension →
          </Btn>
        </div>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );

  function finishSetup() {
    if (!nameInput.trim()) return;
    setU((u) => ({ ...u, name: nameInput.trim() }));
    setSetupDone(true);
  }

  // ── API KEY SCREEN ────────────────────────────────
  if (!geminiKey)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "rgba(8,6,18,0.7)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: 24,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
            top: "-10%",
            right: "-10%",
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,70,239,0.2) 0%, transparent 70%)",
            bottom: "-5%",
            left: "-5%",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            zIndex: 1,
            background: "rgba(168,85,247,0.06)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: 28,
            padding: "44px 36px",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            animation: "fadeUp 0.5s ease-out",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}></div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24,
                fontWeight: 800,
                color: T.text,
                letterSpacing: "-0.5px",
              }}
            >
              Connect AI Coach
            </div>
            <div
              style={{
                color: T.muted,
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Power up with free AI via OpenRouter
            </div>
          </div>
          <div
            style={{
              background: "rgba(168,85,247,0.08)",
              borderRadius: 16,
              padding: "16px 18px",
              border: `1px solid ${T.border}`,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.accent,
                marginBottom: 12,
                letterSpacing: "0.1em",
              }}
            >
              HOW TO GET YOUR FREE KEY
            </div>
            {[
              [
                "1",
                "Visit ",
                "openrouter.ai/keys",
                "https://openrouter.ai/keys",
              ],
              ["2", "Sign in with Google → Create Key", "", ""],
              ["3", 'Name it "Ascend" and copy it', "", ""],
              ["4", "Paste below — completely free!", "", ""],
            ].map(([n, text, link, href]) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    flexShrink: 0,
                    marginTop: 1,
                    background: `linear-gradient(135deg, ${T.primaryDim}, ${T.primary})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {n}
                </div>
                <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
                  {text}{" "}
                  {link && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: T.accent, textDecoration: "underline" }}
                    >
                      {link}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.muted,
              fontWeight: 600,
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            YOUR OPENROUTER API KEY
          </div>
          <input
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setKeyError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
            placeholder="sk-or-v1-..."
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              marginBottom: 8,
              background: "rgba(168,85,247,0.08)",
              border: `1px solid ${keyError ? T.red + "88" : T.border}`,
              color: T.text,
              fontSize: 14,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
            }}
          />
          {keyError && (
            <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>
              {keyError}
            </div>
          )}
          <Btn
            onClick={saveKey}
            disabled={testingKey}
            size="lg"
            style={{ width: "100%", marginTop: 8 }}
          >
            {testingKey ? "/// Verifying..." : "✓ Save & Connect"}
          </Btn>
          <button
            onClick={() => {
              localStorage.setItem("ascend_gemini_key", "offline");
              setGeminiKey("offline");
            }}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 10,
              background: "transparent",
              border: "none",
              color: T.muted,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Skip — Continue in Offline Mode
          </button>
          <div
            style={{
              textAlign: "center",
              marginTop: 16,
              color: T.muted,
              fontSize: 11,
            }}
          >
            {" "}
            Key stored locally — never shared
          </div>
        </div>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );

  async function saveKey() {
    const k = keyInput.trim();
    if (!k) return;
    setTestingKey(true);
    setKeyError("");
    try {
      const models = FREE_MODELS;
      let successModel = null;
      let lastErr = "";

      for (const m of models) {
        const res = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${k}`,
            },
            body: JSON.stringify({
              model: m,
              messages: [{ role: "user", content: "hi" }],
              max_tokens: 10,
            }),
          },
        );
        const d = await res.json();
        if (!d.error) {
          successModel = m;
          break;
        }
        lastErr = d.error.message;
      }

      if (!successModel) {
        setKeyError("[FAIL] All free models failed: " + lastErr);
        setTestingKey(false);
        return;
      }

      localStorage.setItem("ascend_openrouter_model", successModel);
      localStorage.setItem("ascend_gemini_key", k);
      setGeminiKey(k);
    } catch {
      setKeyError(
        "[FAIL] Connection failed. Check your internet and try again.",
      );
    }
    setTestingKey(false);
  }

  // ── MAIN APP ──────────────────────────────────────
  const lvl = calcLvl(user.xp);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const TABS = [
    { id: "dash", icon: "⊞", label: "Home" },
    { id: "goals", icon: "◎", label: "Quests" },
    { id: "focus", icon: "///", label: "Focus" },
    { id: "tasks", icon: "✓", label: "Tasks" },
    { id: "skills", icon: "///", label: "Skills" },
    { id: "ai", icon: "✦", label: "Coach" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(8,6,18,0.7)",
        backdropFilter: "blur(8px)",
        color: T.text,
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
          top: "-10%",
          right: "-20%",
          filter: "blur(80px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(217,70,239,0.08) 0%, transparent 70%)",
          bottom: "10%",
          left: "-15%",
          filter: "blur(80px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {xpPops.map((p) => (
        <div
          key={p.id}
          style={{
            position: "fixed",
            top: "14%",
            left: "50%",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: 24,
            color: T.accent,
            zIndex: 9999,
            pointerEvents: "none",
            textShadow: `0 0 20px ${T.accent}`,
            animation: "xpFloat 2.2s ease-out forwards",
          }}
        >
          +{p.amount} XP ///
        </div>
      ))}

      {lvlUpMsg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(8,6,18,0.92)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "56px 64px",
              borderRadius: 32,
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.35)",
              boxShadow: "0 0 80px rgba(168,85,247,0.3)",
              animation: "popBounce 0.45s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 80, marginBottom: 16 }}></div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: T.accent,
                letterSpacing: "0.15em",
                marginBottom: 8,
              }}
            >
              LEVEL UP
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 52,
                fontWeight: 800,
                color: T.text,
                letterSpacing: "-2px",
                lineHeight: 1,
              }}
            >
              {lvlUpMsg}
            </div>
            <div style={{ color: T.muted, marginTop: 12, fontSize: 15 }}>
              Keep ascending,{" "}
              <span style={{ color: T.primary }}>{user.name}</span>.
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 16px 110px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ padding: "56px 0 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: T.muted,
                  marginBottom: 4,
                  letterSpacing: "0.04em",
                }}
              >
                {greeting},
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}
              >
                {user.name}{" "}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {geminiKey === "offline" && (
                <button
                  onClick={() => {
                    localStorage.removeItem("ascend_gemini_key");
                    setGeminiKey("");
                  }}
                  style={{
                    background: "rgba(168,85,247,0.1)",
                    border: `1px solid ${T.primary}`,
                    borderRadius: 12,
                    padding: "7px 13px",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: T.primary,
                    cursor: "pointer",
                  }}
                >
                  Connect API
                </button>
              )}
              {user.streak > 0 && (
                <div
                  style={{
                    background: "rgba(251,191,36,0.1)",
                    border: "1px solid rgba(251,191,36,0.2)",
                    borderRadius: 12,
                    padding: "7px 13px",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: T.amber,
                  }}
                >
                  STREAK {user.streak}
                </div>
              )}
              <div
                style={{
                  background: `linear-gradient(135deg, ${T.primaryDim}, ${T.primary})`,
                  borderRadius: 12,
                  padding: "7px 13px",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: "0 4px 16px rgba(168,85,247,0.35)",
                }}
              >
                Lv.{lvl.l}
              </div>
            </div>
          </div>
          <div
            style={{
              background: "rgba(168,85,247,0.06)",
              backdropFilter: "blur(16px)",
              borderRadius: 18,
              padding: "16px 18px",
              border: `1px solid ${T.border}`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.sub,
                }}
              >
                Level {lvl.l} <span style={{ color: T.muted }}>→</span>{" "}
                {lvl.l + 1}
              </div>
              <div style={{ fontSize: 12, color: T.primary, fontWeight: 600 }}>
                {lvl.cur.toLocaleString()}{" "}
                <span style={{ color: T.muted }}>
                  / {lvl.max.toLocaleString()} XP
                </span>
              </div>
            </div>
            <ProgressBar pct={lvl.pct} h={7} />
            <div style={{ fontSize: 11, color: T.muted, marginTop: 7 }}>
              {(lvl.max - lvl.cur).toLocaleString()} XP to level {lvl.l + 1}
            </div>
          </div>
        </div>

        {tab === "dash" && <DashTab user={user} gainXP={gainXP} setU={setU} />}
        {tab === "goals" && (
          <GoalsTab user={user} setU={setU} gainXP={gainXP} />
        )}
        <div style={{ display: tab === "focus" ? "block" : "none" }}>
          <FocusTab
            user={user}
            gainXP={gainXP}
            setU={setU}
            active={tab === "focus"}
          />
        </div>
        {tab === "tasks" && (
          <TasksTab user={user} setU={setU} gainXP={gainXP} />
        )}
        {tab === "skills" && (
          <SkillsTab user={user} setU={setU} gainXP={gainXP} />
        )}
        {tab === "ai" && <AITab user={user} />}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(13,10,26,0.88)",
          backdropFilter: "blur(28px) saturate(1.8)",
          WebkitBackdropFilter: "blur(28px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-around",
          padding: "10px 8px 28px",
        }}
      >
        {TABS.map(({ id, icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: active ? "rgba(168,85,247,0.12)" : "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "7px 14px",
                borderRadius: 14,
                transition: "all 0.2s ease",
                color: active ? T.primary : T.muted,
              }}
            >
              <span
                style={{
                  fontSize: 17,
                  lineHeight: 1,
                  filter: active ? `drop-shadow(0 0 6px ${T.primary})` : "none",
                  transition: "filter 0.2s",
                }}
              >
                {icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <style>{`
        @keyframes xpFloat   { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} 20%{transform:translateX(-50%) translateY(-20px) scale(1.15)} 100%{opacity:0;transform:translateX(-50%) translateY(-90px) scale(0.9)} }
        @keyframes popBounce { from{transform:scale(0.3);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse     { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.08)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background: url('/bg.png') center/cover fixed, ${T.bgDeep}; }
        input::placeholder, textarea::placeholder { color: rgba(243,238,255,0.2); }
        input, textarea { caret-color: ${T.primary}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.25); border-radius: 3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(5) hue-rotate(240deg); }
      `}</style>
    </div>
  );
}
