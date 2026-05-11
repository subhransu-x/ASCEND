import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════
// CONFIG — change GATE to update access code
// ══════════════════════════════════════════════
const GATE = "ASCEND2026";

const T = {
  bg:      "#1A1825",
  card:    "#22203200",
  cardSolid:"#221F32",
  card2:   "#2B2848",
  border:  "#33305255",
  borderSolid:"#333052",
  primary: "#9384E0",
  accent:  "#6390E9",
  green:   "#4ADE80",
  amber:   "#FBBF24",
  red:     "#F87171",
  pink:    "#F472B6",
  text:    "#EDE9FA",
  sub:     "#B0ADCC",
  muted:   "#5E5A80",
};

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
const uid     = () => Math.random().toString(36).slice(2, 10);
const today   = () => new Date().toISOString().slice(0, 10);
const fmtDate = d  => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

const XPR = lvl => Math.round(100 * Math.pow(1.42, lvl - 1));
const calcLvl = xp => {
  let l = 1, s = 0;
  while (s + XPR(l) <= xp) { s += XPR(l); l++; }
  return { l, cur: xp - s, max: XPR(l), pct: Math.min(100, ((xp - s) / XPR(l)) * 100) };
};

const callAI = async (sys, userMsg, history = []) => {
  const k = localStorage.getItem("ascend_gemini_key");
  if (!k) return "No API key found.";
  const contents = history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }]
  }));
  contents.push({ role: "user", parts: [{ text: userMsg }] });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { maxOutputTokens: 1000 }
    })
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const DEFAULT_USER = {
  name:       "",
  xp:         0,
  streak:     0,
  lastActive: null,
  goals:      [],
  tasks:      [],
  skills: [
    { id: "sk1", name: "Focus",      icon: "🎯", xp: 0, color: T.primary },
    { id: "sk2", name: "Discipline", icon: "⚔️", xp: 0, color: T.accent  },
    { id: "sk3", name: "Learning",   icon: "📚", xp: 0, color: T.green   },
  ],
  xpLog: [],
};

// ══════════════════════════════════════════════
// SHARED UI COMPONENTS
// ══════════════════════════════════════════════

function ProgressBar({ pct, color = T.primary, h = 8 }) {
  return (
    <div style={{ background: "#2B2848", borderRadius: 99, height: h, overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 99,
        background: `linear-gradient(90deg, ${color}99, ${color})`,
        boxShadow: `0 0 10px ${color}77`,
        transition: "width 0.7s cubic-bezier(0.34,1.2,0.64,1)",
      }} />
    </div>
  );
}

function GlassCard({ children, style = {}, glow, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background:    "linear-gradient(135deg, #221F3288 0%, #2B284855 100%)",
      backdropFilter:"blur(16px)",
      border:        `1px solid ${hov && onClick ? T.primary + "66" : "#33305266"}`,
      borderRadius:  20,
      padding:       "18px 20px",
      transition:    "all 0.22s",
      cursor:        onClick ? "pointer" : "default",
      transform:     hov && onClick ? "translateY(-2px)" : "none",
      boxShadow:     glow ? `0 0 30px ${glow}22, 0 4px 20px #00000033` : "0 4px 16px #00000033",
      animation:     "fadeUp 0.35s ease-out",
      ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, style = {} }) {
  const [hov, setHov] = useState(false);
  const bg = variant === "primary" ? `linear-gradient(135deg, ${T.primary}, ${T.accent})`
           : variant === "danger"  ? `linear-gradient(135deg, ${T.red}99, ${T.red})`
           : variant === "ghost"   ? "transparent" : "#2B2848";
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: bg, border: variant === "ghost" ? `1px solid ${T.borderSolid}` : "none",
        color: T.text, borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600,
        padding: size === "sm" ? "7px 14px" : size === "lg" ? "15px 28px" : "11px 20px",
        fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13,
        boxShadow: variant === "primary" && !disabled ? `0 4px 20px ${T.primary}44` : "none",
        opacity: disabled ? 0.45 : 1,
        transform: hov && !disabled ? "translateY(-1px)" : "none",
        transition: "all 0.15s", ...style,
      }}>{children}</button>
  );
}

function FancyInput({ value, onChange, placeholder, type = "text", multiline, rows = 3, style = {} }) {
  const [f, setF] = useState(false);
  const base = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    background: "#2B2848", border: `1px solid ${f ? T.primary + "99" : T.borderSolid}`,
    color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inter',sans-serif",
    transition: "border-color 0.2s", resize: "vertical", ...style,
  };
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setF(true)} onBlur={() => setF(false)} rows={rows} style={base} />
    : <input value={value} onChange={onChange} placeholder={placeholder} type={type}
        onFocus={() => setF(true)} onBlur={() => setF(false)} style={base} />;
}

function StatusBadge({ status }) {
  const m = { done: [T.green,"Done"], partial: [T.amber,"Partial"], missed: [T.red,"Missed"], pending: [T.muted,"Pending"] };
  const [col, lbl] = m[status] || m.pending;
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: `${col}22`, color: col, border: `1px solid ${col}44`,
      whiteSpace: "nowrap",
    }}>{lbl}</span>
  );
}

function Tag({ children, color = T.primary }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
      background: `${color}22`, color, border: `1px solid ${color}33`,
    }}>{children}</span>
  );
}

// ══════════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════════
function DashTab({ user, gainXP, setU }) {
  const lvl      = calcLvl(user.xp);
  const tasks    = user.tasks.filter(t => t.date === today());
  const done     = tasks.filter(t => t.status === "done").length;
  const todayXP  = (user.xpLog || []).filter(e => e.date === today()).reduce((s, e) => s + e.amount, 0);
  const goalPct  = user.goals.length ? Math.round(user.goals.reduce((s, g) => {
    const gt = user.tasks.filter(t => t.goalId === g.id);
    return s + (gt.length ? (gt.filter(t => t.status === "done").length / gt.length) * 100 : 0);
  }, 0) / user.goals.length) : 0;
  const nextTask = tasks.find(t => t.status === "pending");

  const markDone = t => {
    setU(u => ({
      ...u,
      tasks: u.tasks.map(x => x.id === t.id ? { ...x, status: "done" } : x),
      xpLog: [...(u.xpLog||[]), { amount: t.xp, source: t.title, date: today() }],
    }));
    gainXP(t.xp);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { icon:"🔥", label:"Day Streak",   value: user.streak || 0, unit:"days",  color: T.amber   },
          { icon:"⚡", label:"XP Today",     value: `+${todayXP}`,   unit:"",      color: T.accent  },
          { icon:"✅", label:"Tasks Done",   value: `${done}/${tasks.length}`,unit:"",color: T.green  },
          { icon:"🎯", label:"Quest Progress",value:`${goalPct}%`,   unit:"",      color: T.primary },
        ].map(({ icon, label, value, unit, color }) => (
          <GlassCard key={label} glow={color} style={{ textAlign:"center", padding:"16px 12px" }}>
            <div style={{ fontSize:30, marginBottom:6 }}>{icon}</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, color }}>
              {value}<span style={{ fontSize:13, fontWeight:400, color:T.muted }}>{unit && ` ${unit}`}</span>
            </div>
            <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>{label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Quick complete */}
      {nextTask && (
        <GlassCard glow={T.primary} style={{ border:`1px solid ${T.primary}44` }}>
          <div style={{ fontSize:10, color:T.primary, fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>⭐ NEXT TASK</div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:10 }}>{nextTask.title}</div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={() => markDone(nextTask)} size="sm">✓ Complete +{nextTask.xp}xp</Btn>
            <Tag color={T.accent}>+{nextTask.xp} XP</Tag>
          </div>
        </GlassCard>
      )}

      {/* Today's tasks */}
      <GlassCard>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:600, marginBottom:12 }}>
          📋 Today's Agenda
        </div>
        {tasks.length === 0 ? (
          <div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"16px 0" }}>
            No tasks today — go to Quests to create your roadmap!
          </div>
        ) : tasks.map(t => (
          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${T.borderSolid}33` }}>
            <div style={{
              width:18, height:18, borderRadius:6, flexShrink:0,
              background: t.status==="done" ? T.green : t.status==="partial" ? T.amber : "#2B2848",
              border: `1px solid ${t.status==="done" ? T.green : t.status==="partial" ? T.amber : T.borderSolid}`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:10,
            }}>{t.status==="done" ? "✓" : t.status==="partial" ? "~" : ""}</div>
            <div style={{ flex:1, fontSize:13, color: t.status==="done" ? T.muted : T.text, textDecoration: t.status==="done" ? "line-through" : "none" }}>
              {t.title}
            </div>
            <div style={{ fontSize:10, color:T.accent }}>+{t.xp}</div>
          </div>
        ))}
      </GlassCard>

      {/* Skills preview */}
      <GlassCard>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:600, marginBottom:12 }}>⚔️ Skill Power</div>
        {user.skills.slice(0,4).map(s => {
          const si = calcLvl(s.xp);
          return (
            <div key={s.id} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:13 }}>{s.icon} {s.name}</span>
                <span style={{ fontSize:11, color:s.color, fontWeight:600 }}>Lv.{si.l} · {Math.round(si.pct)}%</span>
              </div>
              <ProgressBar pct={si.pct} color={s.color} h={7} />
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

// ══════════════════════════════════════════════
// GOALS TAB
// ══════════════════════════════════════════════
function GoalsTab({ user, setU, gainXP }) {
  const [open,     setOpen]     = useState(false);
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [ddl,      setDdl]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);

  const generate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const sys = `You are a goal decomposition expert. Return ONLY valid JSON — no markdown, no explanation.
Schema: { "phases": [{ "name": string, "duration": string, "milestones": [string], "tasks": [{ "title": string, "description": string, "xp": number, "daysFromNow": number }] }] }
Rules: 2-3 phases, 2-4 tasks each. xp 15-60 based on difficulty. daysFromNow: spread tasks over the goal timeline.`;
      const raw  = await callAI(sys, `Goal: ${title}\nContext: ${desc}\nDeadline: ${ddl || "flexible"}`);
      const json = JSON.parse(raw.replace(/```json?|```/g,"").trim());
      const goalId = uid();
      const base   = new Date();
      const tasks  = json.phases.flatMap(ph => ph.tasks.map(t => {
        const d = new Date(base); d.setDate(d.getDate() + (t.daysFromNow || 0));
        return { id:uid(), goalId, title:t.title, description:t.description||"", xp:t.xp||20, date:d.toISOString().slice(0,10), status:"pending", phase:ph.name };
      }));
      setU(u => ({
        ...u,
        goals: [...u.goals, { id:goalId, title, description:desc, deadline:ddl, phases:json.phases, createdAt:today() }],
        tasks: [...u.tasks, ...tasks],
      }));
      setOpen(false); setTitle(""); setDesc(""); setDdl("");
    } catch(e) { alert("AI generation failed — check console."); console.error(e); }
    setLoading(false);
  };

  const del = id => setU(u => ({ ...u, goals: u.goals.filter(g=>g.id!==id), tasks: u.tasks.filter(t=>t.goalId!==id) }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>🗺 Active Quests</div>
        <Btn onClick={() => setOpen(s=>!s)} size="sm" variant={open?"ghost":"primary"}>{open?"✕ Cancel":"+ New Quest"}</Btn>
      </div>

      {open && (
        <GlassCard glow={T.primary} style={{ border:`1px solid ${T.primary}55` }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600, color:T.primary, marginBottom:14 }}>
            ✦ AI Goal Decomposition
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <FancyInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Goal title — e.g. Learn Java Programming" />
            <FancyInput value={desc} onChange={e=>setDesc(e.target.value)} multiline rows={3}
              placeholder="Describe your goal, current level, and what success looks like..." />
            <FancyInput value={ddl} onChange={e=>setDdl(e.target.value)} placeholder="Target deadline (optional, e.g. 3 months)" />
            <Btn onClick={generate} disabled={loading || !title.trim()} size="lg">
              {loading ? "⏳ Generating roadmap..." : "⚡ Generate AI Roadmap"}
            </Btn>
          </div>
        </GlassCard>
      )}

      {user.goals.length === 0 && !open && (
        <div style={{ textAlign:"center", padding:"48px 0", color:T.muted }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🗺</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, color:T.sub, marginBottom:6 }}>No active quests</div>
          <div style={{ fontSize:13 }}>Click "New Quest" to have AI build your roadmap</div>
        </div>
      )}

      {user.goals.map(g => {
        const gt   = user.tasks.filter(t => t.goalId === g.id);
        const dn   = gt.filter(t => t.status === "done").length;
        const pct  = gt.length ? Math.round((dn / gt.length) * 100) : 0;
        const isEx = expanded === g.id;
        return (
          <GlassCard key={g.id} onClick={() => setExpanded(isEx ? null : g.id)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ flex:1, paddingRight:10 }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600 }}>{g.title}</div>
                <div style={{ color:T.muted, fontSize:11, marginTop:3 }}>{gt.length} tasks · {dn} done · Created {fmtDate(g.createdAt)}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700, color:T.primary }}>{pct}%</div>
                <button onClick={e => { e.stopPropagation(); del(g.id); }} style={{
                  background:"none", border:`1px solid ${T.borderSolid}`, color:T.muted, cursor:"pointer",
                  borderRadius:6, width:24, height:24, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center",
                }}>×</button>
              </div>
            </div>
            <ProgressBar pct={pct} />

            {isEx && (
              <div style={{ marginTop:16 }}>
                {(g.phases||[]).map((ph, pi) => (
                  <div key={pi} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <div style={{ width:6, height:6, borderRadius:3, background:T.primary, flexShrink:0 }} />
                      <div style={{ fontSize:13, fontWeight:600, color:T.primary }}>{ph.name}</div>
                      <Tag color={T.accent}>{ph.duration}</Tag>
                    </div>
                    {ph.milestones?.map((m,mi) => (
                      <div key={mi} style={{ fontSize:12, color:T.sub, paddingLeft:14, marginBottom:3 }}>◆ {m}</div>
                    ))}
                    <div style={{ marginTop:8 }}>
                      {gt.filter(t => t.phase === ph.name).map(t => (
                        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${T.borderSolid}33` }}>
                          <div style={{
                            width:14, height:14, borderRadius:4, flexShrink:0,
                            background: t.status==="done" ? T.green : "#2B2848",
                            border: `1px solid ${t.status==="done" ? T.green : T.borderSolid}`,
                          }} />
                          <div style={{ flex:1, fontSize:12, color: t.status==="done" ? T.muted : T.sub, textDecoration: t.status==="done" ? "line-through":"none" }}>{t.title}</div>
                          <div style={{ fontSize:10, color:T.muted }}>{fmtDate(t.date)}</div>
                          <div style={{ fontSize:10, color:T.accent }}>+{t.xp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// TASKS TAB
// ══════════════════════════════════════════════
function TasksTab({ user, setU, gainXP }) {
  const [filter,  setFilter]  = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ title:"", xp:"20", date:today() });

  const tasks = filter === "today"   ? user.tasks.filter(t => t.date === today())
              : filter === "pending" ? user.tasks.filter(t => t.status === "pending")
              : user.tasks.slice().reverse();

  const setStatus = (id, status) => {
    const t = user.tasks.find(x => x.id === id);
    if (!t || t.status === status) return;
    const xpGain = status === "done" ? t.xp : status === "partial" ? Math.floor(t.xp * 0.4) : 0;
    setU(u => ({
      ...u,
      tasks: u.tasks.map(x => x.id === id ? { ...x, status } : x),
      xpLog: xpGain > 0 ? [...(u.xpLog||[]), { amount:xpGain, source:t.title, date:today() }] : u.xpLog||[],
    }));
    if (xpGain > 0) gainXP(xpGain);
  };

  const addTask = () => {
    if (!form.title.trim()) return;
    setU(u => ({ ...u, tasks: [...u.tasks, { id:uid(), goalId:null, title:form.title, xp:parseInt(form.xp)||20, date:form.date, status:"pending" }] }));
    setForm({ title:"", xp:"20", date:today() });
    setShowAdd(false);
  };

  const delTask = id => setU(u => ({ ...u, tasks: u.tasks.filter(t => t.id !== id) }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>✓ Task Log</div>
        <Btn onClick={() => setShowAdd(s=>!s)} size="sm" variant={showAdd?"ghost":"primary"}>{showAdd?"Cancel":"+ Task"}</Btn>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8 }}>
        {["today","pending","all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20,
            border:`1px solid ${filter===f ? T.primary : T.borderSolid}`,
            background: filter===f ? `${T.primary}22` : "transparent",
            color: filter===f ? T.primary : T.muted,
            fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontWeight:500,
            transition:"all 0.15s",
          }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
      </div>

      {showAdd && (
        <GlassCard style={{ border:`1px solid ${T.accent}55` }}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <FancyInput value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Task title..." />
            <div style={{ display:"flex", gap:10 }}>
              <FancyInput value={form.xp} onChange={e=>setForm(p=>({...p,xp:e.target.value}))} placeholder="XP reward" style={{flex:1}} />
              <FancyInput value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} type="date" style={{flex:1,colorScheme:"dark"}} />
            </div>
            <Btn onClick={addTask}>Add Task</Btn>
          </div>
        </GlassCard>
      )}

      {tasks.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 0", color:T.muted }}>
          <div style={{ fontSize:40 }}>✨</div>
          <div style={{ marginTop:8, fontSize:13 }}>Nothing here. All clear!</div>
        </div>
      ) : tasks.map(t => (
        <GlassCard key={t.id} style={{ padding:"14px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: t.status==="pending" ? 10 : 0 }}>
            <div style={{ flex:1, paddingRight:10 }}>
              <div style={{ fontSize:14, fontWeight:500, color: t.status==="done" ? T.muted : T.text, textDecoration: t.status==="done" ? "line-through":"none", marginBottom:4 }}>
                {t.title}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <Tag color={T.accent}>+{t.xp} XP</Tag>
                {t.phase && <Tag color={T.primary}>{t.phase}</Tag>}
                <span style={{ fontSize:10, color:T.muted, alignSelf:"center" }}>{fmtDate(t.date)}</span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
              <StatusBadge status={t.status} />
              <button onClick={() => delTask(t.id)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:11 }}>delete</button>
            </div>
          </div>
          {t.status === "pending" && (
            <div style={{ display:"flex", gap:6 }}>
              {[["done","✓ Done",T.green],["partial","~ Partial",T.amber],["missed","✕ Missed",T.red]].map(([s,lbl,c]) => (
                <button key={s} onClick={() => setStatus(t.id, s)} style={{
                  flex:1, padding:"8px 4px", borderRadius:10, border:"none",
                  background:`${c}18`, color:c, cursor:"pointer",
                  fontSize:11, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif",
                  transition:"background 0.15s",
                }}>{lbl}</button>
              ))}
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// SKILLS TAB
// ══════════════════════════════════════════════
function SkillsTab({ user, setU, gainXP }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", icon:"⚡", color:T.primary });
  const ICONS  = ["⚡","🎯","⚔️","📚","💪","🧠","🎨","💻","🎸","🏃","🧘","✍️","🔬","🌍","🎤","🏆","🛡","🗡","📊","🎮"];
  const COLORS = [T.primary, T.accent, T.green, T.amber, "#F472B6","#34D399","#60A5FA","#A78BFA","#FB923C","#4DD0E1"];

  const addSkill = () => {
    if (!form.name.trim()) return;
    setU(u => ({ ...u, skills: [...u.skills, { id:uid(), name:form.name, icon:form.icon, color:form.color, xp:0 }] }));
    setForm({ name:"", icon:"⚡", color:T.primary }); setShowAdd(false);
  };

  const trainSkill = (skillId, amt) => {
    setU(u => ({
      ...u, xp: u.xp + amt,
      skills: u.skills.map(s => s.id===skillId ? {...s, xp:s.xp+amt} : s),
      xpLog: [...(u.xpLog||[]), { amount:amt, source:"Skill training", date:today() }],
    }));
    gainXP(amt);
  };

  const delSkill = id => setU(u => ({ ...u, skills: u.skills.filter(s=>s.id!==id) }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>⚔️ Skills</div>
        <Btn onClick={() => setShowAdd(s=>!s)} size="sm" variant={showAdd?"ghost":"primary"}>{showAdd?"Cancel":"+ New Skill"}</Btn>
      </div>

      {showAdd && (
        <GlassCard glow={T.primary} style={{ border:`1px solid ${T.primary}55` }}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <FancyInput value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Skill name..." />
            <div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600, letterSpacing:"0.06em" }}>ICON</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(p=>({...p,icon:ic}))} style={{
                    width:34, height:34, borderRadius:9, border:`2px solid ${form.icon===ic ? T.primary : T.borderSolid}`,
                    background: form.icon===ic ? `${T.primary}22` : "#2B2848",
                    fontSize:17, cursor:"pointer", transition:"all 0.15s",
                  }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600, letterSpacing:"0.06em" }}>COLOR</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {COLORS.map(cl => (
                  <button key={cl} onClick={() => setForm(p=>({...p,color:cl}))} style={{
                    width:28, height:28, borderRadius:8, background:cl, border:"none", cursor:"pointer",
                    outline: form.color===cl ? `2px solid white` : "2px solid transparent", outlineOffset:2,
                    transition:"outline 0.15s",
                  }} />
                ))}
              </div>
            </div>
            <Btn onClick={addSkill}>Create Skill</Btn>
          </div>
        </GlassCard>
      )}

      {user.skills.map(s => {
        const si = calcLvl(s.xp);
        return (
          <GlassCard key={s.id} style={{ border:`1px solid ${s.color}33` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{
                width:50, height:50, borderRadius:15, fontSize:26, flexShrink:0,
                background: `${s.color}22`, display:"flex", alignItems:"center", justifyContent:"center",
                border: `1px solid ${s.color}55`, boxShadow:`0 0 15px ${s.color}33`,
              }}>{s.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600 }}>{s.name}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{s.xp.toLocaleString()} total XP</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, color:s.color }}>Lv.{si.l}</div>
                <button onClick={() => delSkill(s.id)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:10 }}>remove</button>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.muted, marginBottom:5 }}>
                <span>{si.cur} / {si.max} XP to Lv.{si.l+1}</span>
                <span>{Math.round(si.pct)}%</span>
              </div>
              <ProgressBar pct={si.pct} color={s.color} h={10} />
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[10,25,50].map(amt => (
                <button key={amt} onClick={() => trainSkill(s.id, amt)} style={{
                  flex:1, padding:"8px 4px", borderRadius:10, border:`1px solid ${s.color}33`,
                  background: `${s.color}11`, color:s.color, cursor:"pointer",
                  fontSize:11, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif",
                  transition:"background 0.15s",
                }}>+{amt} XP</button>
              ))}
            </div>
          </GlassCard>
        );
      })}

      {user.skills.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 0", color:T.muted }}>
          <div style={{ fontSize:44 }}>⚔️</div>
          <div style={{ marginTop:10, fontSize:13 }}>No skills yet. Create your first one!</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// AI COACH TAB
// ══════════════════════════════════════════════
function AITab({ user }) {
  const [analysis,     setAnalysis]     = useState("");
  const [analyzing,    setAnalyzing]    = useState(false);
  const [chat,         setChat]         = useState([]);
  const [chatInput,    setChatInput]    = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);
  const chatRef = useRef(null);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [chat]);

  const analyze = async () => {
    setAnalyzing(true); setAnalysis("");
    const lvl    = calcLvl(user.xp);
    const recent = user.tasks.slice(-15);
    const dnPct  = recent.length ? Math.round((recent.filter(t=>t.status==="done").length/recent.length)*100) : 0;
    try {
      const r = await callAI(
        "You are Ascend AI Coach, a sharp, encouraging productivity coach. Give 3-4 specific, actionable insights. Use bullet points. Max 200 words. Be direct and motivating.",
        `User stats: Level ${lvl.l}, ${user.xp} total XP, ${user.streak}-day streak, ${dnPct}% task completion rate, ${user.goals.length} active goals, ${user.skills.length} skills tracked. Recent tasks: ${JSON.stringify(recent.map(t=>({title:t.title,status:t.status})))}`
      );
      setAnalysis(r);
    } catch { setAnalysis("Analysis failed. Check your connection."); }
    setAnalyzing(false);
  };

  const send = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim(); setChatInput("");
    setChat(p => [...p, { role:"user", text:msg }]);
    setChatLoading(true);
    const lvl = calcLvl(user.xp);
    try {
      const reply = await callAI(
        `You are Ascend AI Coach — supportive, sharp, results-focused. User: Level ${lvl.l}, ${user.xp} XP, ${user.streak}-day streak, ${user.goals.length} quests active. Be concise (max 120 words), use 1-2 emojis max, give actionable advice.`,
        msg,
        chat.slice(-6),
      );
      setChat(p => [...p, { role:"assistant", text:reply }]);
    } catch { setChat(p => [...p, { role:"assistant", text:"Connection error. Try again." }]); }
    setChatLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>✦ AI Coach</div>

      {/* Workload analysis */}
      <GlassCard glow={T.accent} style={{ border:`1px solid ${T.accent}44` }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600, marginBottom:10 }}>
          📊 Performance Analysis
        </div>
        {analysis && (
          <div style={{ fontSize:13, color:T.sub, lineHeight:1.7, whiteSpace:"pre-wrap", marginBottom:12 }}>{analysis}</div>
        )}
        {!analysis && !analyzing && (
          <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>
            Get a personalized breakdown of your progress patterns and smart recommendations.
          </div>
        )}
        <Btn onClick={analyze} disabled={analyzing} size="sm">
          {analyzing ? "⏳ Analyzing patterns..." : "⚡ Analyze My Progress"}
        </Btn>
      </GlassCard>

      {/* Chat */}
      <GlassCard style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600 }}>💬 Coach Chat</div>
        {chat.length > 0 && (
          <div ref={chatRef} style={{ maxHeight:260, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingRight:4 }}>
            {chat.map((m,i) => (
              <div key={i} style={{
                padding:"10px 14px", borderRadius:14, fontSize:13, lineHeight:1.6,
                background: m.role==="user" ? `${T.primary}22` : "#2B2848",
                border: `1px solid ${m.role==="user" ? T.primary+"44" : T.borderSolid}`,
                alignSelf: m.role==="user" ? "flex-end" : "flex-start",
                maxWidth:"88%", color: m.role==="user" ? T.primary : T.sub,
              }}>{m.text}</div>
            ))}
            {chatLoading && (
              <div style={{ padding:"10px 14px", borderRadius:14, background:"#2B2848", border:`1px solid ${T.borderSolid}`, color:T.muted, fontSize:13, alignSelf:"flex-start" }}>
                ✦ Thinking...
              </div>
            )}
          </div>
        )}
        {chat.length === 0 && (
          <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>
            Ask me anything — about your goals, habits, motivation, or strategy.
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Ask your coach..." style={{
              flex:1, padding:"11px 14px", borderRadius:12, background:"#2B2848",
              border:`1px solid ${T.borderSolid}`, color:T.text, fontSize:13,
              outline:"none", fontFamily:"'Inter',sans-serif",
            }} />
          <button onClick={send} disabled={chatLoading} style={{
            width:44, height:44, borderRadius:12, border:"none", cursor:chatLoading?"not-allowed":"pointer",
            background:`linear-gradient(135deg,${T.primary},${T.accent})`,
            color:"white", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 4px 16px ${T.primary}44`, flexShrink:0,
          }}>→</button>
        </div>
      </GlassCard>
    </div>
  );
}

// ══════════════════════════════════════════════
// FOCUS TAB
// ══════════════════════════════════════════════
function FocusTab({ user, gainXP, setU }) {
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, running, failed, success

  useEffect(() => {
    if (!active && status !== "success" && status !== "failed") {
      setTimeLeft(duration * 60);
      setStatus("idle");
    }
  }, [duration, active, status]);

  useEffect(() => {
    let int;
    if (active && timeLeft > 0) {
      int = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (active && timeLeft <= 0) {
      setActive(false);
      setStatus("success");
      const xp = duration === 15 ? 30 : duration === 25 ? 60 : 150;
      gainXP(xp);
      setU(u => ({
        ...u, 
        xpLog: [...(u.xpLog||[]), { amount:xp, source:`Deep Focus (${duration}m)`, date:today() }]
      }));
    }
    return () => clearInterval(int);
  }, [active, timeLeft, duration, gainXP, setU]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && active) {
        setActive(false);
        setStatus("failed");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [active]);

  const start = () => {
    if (status === "failed" || status === "success") setTimeLeft(duration * 60);
    setStatus("running");
    setActive(true);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pct = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>⌛ Deep Focus</div>
      
      <GlassCard glow={status === "running" ? T.accent : status === "failed" ? T.red : status === "success" ? T.green : T.primary} style={{ textAlign:"center", padding:"30px 20px" }}>
        {status === "failed" && (
          <div style={{ color:T.red, fontSize:14, fontWeight:700, marginBottom:20, animation:"fadeUp 0.3s" }}>
            ✕ FOCUS BROKEN! You left the app.
          </div>
        )}
        {status === "success" && (
          <div style={{ color:T.green, fontSize:14, fontWeight:700, marginBottom:20, animation:"fadeUp 0.3s" }}>
            ✓ FOCUS COMPLETE! +XP Awarded
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:30, opacity: active ? 0.3 : 1, pointerEvents: active ? "none" : "auto" }}>
          {[15, 25, 50].map(m => (
            <button key={m} onClick={() => { setDuration(m); setStatus("idle"); setTimeLeft(m*60); }} style={{
              padding:"8px 16px", borderRadius:12, border:`1px solid ${duration===m ? T.primary : T.borderSolid}`,
              background: duration===m ? `${T.primary}33` : "#2B2848", color: duration===m ? T.primary : T.text,
              fontSize:14, fontWeight:600, cursor:"pointer", transition:"all 0.2s"
            }}>{m} min</button>
          ))}
        </div>

        <div style={{ position:"relative", width:200, height:200, margin:"0 auto 30px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="200" height="200" style={{ position:"absolute", top:0, left:0, transform:"rotate(-90deg)" }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="#2B2848" strokeWidth="8" />
            <circle cx="100" cy="100" r="90" fill="none" stroke={status==="running"?T.accent:status==="failed"?T.red:status==="success"?T.green:T.primary} strokeWidth="8"
              strokeDasharray="565" strokeDashoffset={565 - (565 * pct) / 100}
              style={{ transition:"stroke-dashoffset 1s linear, stroke 0.3s" }} strokeLinecap="round" />
          </svg>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:48, fontWeight:700, color: status==="failed" ? T.red : T.text }}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {!active ? (
          <Btn onClick={start} size="lg" style={{ width:"100%", maxWidth:250 }}>
            {status === "idle" ? "▶ Start Focus" : "↺ Retry Focus"}
          </Btn>
        ) : (
          <Btn onClick={() => { setActive(false); setStatus("failed"); }} variant="danger" style={{ width:"100%", maxWidth:250 }}>
            ⏹ Give Up
          </Btn>
        )}

        <div style={{ color:T.muted, fontSize:12, marginTop:20, lineHeight:1.5 }}>
          If you minimize the app, switch tabs, or check your notifications, you will fail and lose your progress. Stay focused!
        </div>
      </GlassCard>
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function Ascend() {
  const [authed,     setAuthed]     = useState(false);
  const [codeInput,  setCodeInput]  = useState("");
  const [shake,      setShake]      = useState(false);
  const [setupDone,  setSetupDone]  = useState(false);
  const [nameInput,  setNameInput]  = useState("");
  const [user,       setUser]       = useState(DEFAULT_USER);
  const [tab,        setTab]        = useState("dash");
  const [xpPops,     setXpPops]     = useState([]);
  const [lvlUpMsg,   setLvlUpMsg]   = useState(null);
  
  const [geminiKey,  setGeminiKey]  = useState(() => localStorage.getItem("ascend_gemini_key") || "");
  const [keyInput,   setKeyInput]   = useState("");
  const [keyError,   setKeyError]   = useState("");
  const [testingKey, setTestingKey] = useState(false);

  // Load fonts
  useEffect(() => {
    if (!document.getElementById("asc-fonts")) {
      const el = document.createElement("link");
      el.id="asc-fonts"; el.rel="stylesheet";
      el.href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(el);
    }
  }, []);

  // Load from storage
  useEffect(() => {
    window.storage?.get("asc_v2").then(r => {
      if (r?.value) {
        const u = JSON.parse(r.value);
        setUser(u);
        if (u.name) setSetupDone(true);
      }
    }).catch(()=>{});
  }, []);

  const persist = u => { try { window.storage?.set("asc_v2", JSON.stringify(u)); } catch{} };

  const setU = useCallback(fn => {
    setUser(prev => {
      const next = typeof fn === "function" ? fn(prev) : { ...prev, ...fn };
      persist(next);
      return next;
    });
  }, []);

  // Streak logic
  const bumpStreak = () => {
    const t = today();
    setU(u => {
      if (u.lastActive === t) return u;
      const yest = new Date(); yest.setDate(yest.getDate()-1);
      const ys   = yest.toISOString().slice(0,10);
      return { ...u, streak: u.lastActive===ys ? u.streak+1 : 1, lastActive:t };
    });
  };

  // XP gain with popup + level-up check
  const gainXP = useCallback((amount) => {
    const id = uid();
    setXpPops(p => [...p, { id, amount }]);
    setTimeout(() => setXpPops(p => p.filter(x=>x.id!==id)), 2500);
    setUser(prev => {
      const oldLvl = calcLvl(prev.xp).l;
      const newXP  = prev.xp + amount;
      const newLvl = calcLvl(newXP).l;
      if (newLvl > oldLvl) { setLvlUpMsg(newLvl); setTimeout(() => setLvlUpMsg(null), 3500); }
      const next = { ...prev, xp: newXP };
      persist(next);
      return next;
    });
  }, []);

  // ── LOCK SCREEN ────────────────────────────────────
  if (!authed) return (
    <div style={{
      minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter',sans-serif", position:"relative", overflow:"hidden",
    }}>
      {/* Animated bg blobs */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:`radial-gradient(ellipse, ${T.primary}18 0%, transparent 70%)`, top:"-10%", left:"-10%", animation:"drift1 12s ease-in-out infinite" }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:`radial-gradient(ellipse, ${T.accent}15 0%, transparent 70%)`, bottom:"-5%", right:"-5%", animation:"drift2 10s ease-in-out infinite" }} />

      <div style={{ width:"100%", maxWidth:380, padding:"0 28px", zIndex:1, animation: shake ? "shake 0.5s":"fadeUp 0.6s ease-out" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div style={{
            width:84, height:84, borderRadius:26, margin:"0 auto 20px",
            background:`linear-gradient(135deg,${T.primary},${T.accent})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:44, boxShadow:`0 0 50px ${T.primary}55, 0 20px 40px #00000044`,
            animation:"pulse 3s ease-in-out infinite",
          }}>⚡</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:40, fontWeight:700, color:T.text, letterSpacing:"-1px" }}>ASCEND</div>
          <div style={{ color:T.muted, marginTop:6, fontSize:13, letterSpacing:"0.06em" }}>YOUR PERSONAL EVOLUTION ENGINE</div>
        </div>

        <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:"0.12em", marginBottom:8 }}>ACCESS CODE</div>
        <input
          value={codeInput}
          onChange={e => setCodeInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleAccess()}
          type="password" placeholder="Enter your access code..."
          style={{
            width:"100%", padding:"15px 20px", borderRadius:14, marginBottom:12,
            background:"#221F3299", backdropFilter:"blur(12px)",
            border:`1px solid ${shake ? T.red+"88" : T.borderSolid}`,
            color:T.text, fontSize:15, outline:"none",
            fontFamily:"'Inter',sans-serif", letterSpacing:"0.1em",
            transition:"border-color 0.2s",
          }}
        />
        {shake && <div style={{ color:T.red, fontSize:12, marginBottom:10, textAlign:"center" }}>Invalid code. Contact the admin.</div>}

        <button onClick={handleAccess} style={{
          width:"100%", padding:16, borderRadius:14, border:"none",
          background:`linear-gradient(135deg,${T.primary},${T.accent})`,
          color:"white", fontSize:15, fontWeight:700, cursor:"pointer",
          fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.04em",
          boxShadow:`0 8px 32px ${T.primary}55`, transition:"transform 0.15s",
        }}>Enter Ascend →</button>

        <div style={{ textAlign:"center", marginTop:20, color:T.muted, fontSize:11 }}>🔒 Private access — by invitation only</div>
      </div>
      <style>{`
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-30px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,20px)} }
        @keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-7px)} 80%{transform:translateX(7px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{box-shadow:0 0 50px ${T.primary}55,0 20px 40px #00000044} 50%{box-shadow:0 0 80px ${T.primary}88,0 20px 40px #00000044} }
      `}</style>
    </div>
  );

  function handleAccess() {
    if (codeInput.trim().toUpperCase() === GATE) { setAuthed(true); bumpStreak(); }
    else { setShake(true); setTimeout(()=>setShake(false),600); }
  }

  // ── SETUP SCREEN ─────────────────────────────────
  if (!setupDone) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, animation:"fadeUp 0.5s ease-out" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>👋</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:T.text }}>Welcome to Ascend</div>
          <div style={{ color:T.muted, marginTop:8, fontSize:14 }}>Let's set up your profile</div>
        </div>
        <div style={{ fontSize:11, color:T.muted, fontWeight:700, letterSpacing:"0.1em", marginBottom:8 }}>YOUR NAME</div>
        <input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&finishSetup()}
          placeholder="What should we call you?" style={{
            width:"100%", padding:"15px 20px", borderRadius:14, marginBottom:16,
            background:"#221F32", border:`1px solid ${T.borderSolid}`,
            color:T.text, fontSize:15, outline:"none", fontFamily:"'Inter',sans-serif",
          }} />
        <Btn onClick={finishSetup} disabled={!nameInput.trim()} size="lg" style={{ width:"100%" }}>Begin My Journey →</Btn>
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );

  function finishSetup() {
    if (!nameInput.trim()) return;
    setU(u => ({ ...u, name: nameInput.trim() }));
    setSetupDone(true);
  }

  // ── GEMINI KEY SCREEN ────────────────────────────
  if (!geminiKey) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, animation:"fadeUp 0.5s ease-out" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>🤖</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:26, fontWeight:700, color:T.text }}>Connect AI Coach</div>
          <div style={{ color:T.muted, marginTop:8, fontSize:13, lineHeight:1.6 }}>
            Ascend uses Google Gemini for AI features.<br/>
            Your free API key stays on your device only.
          </div>
        </div>

        <div style={{ background:"#221F3266", borderRadius:16, padding:"18px 20px", border:`1px solid ${T.borderSolid}55`, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.primary, marginBottom:10, letterSpacing:"0.06em" }}>HOW TO GET YOUR FREE KEY (2 min)</div>
          {[
            ["1", "Go to", "aistudio.google.com", "https://aistudio.google.com"],
            ["2", "Sign in with Google → click \"Get API Key\"", "", ""],
            ["3", "Click \"Create API key\" → copy it", "", ""],
            ["4", "Paste it below — completely free!", "", ""],
          ].map(([n, text, link, href]) => (
            <div key={n} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
              <div style={{ width:20, height:20, borderRadius:6, background:`${T.primary}33`, color:T.primary, fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{n}</div>
              <div style={{ fontSize:12, color:T.sub, lineHeight:1.5 }}>
                {text}{" "}
                {link && <a href={href} target="_blank" rel="noreferrer" style={{ color:T.accent, textDecoration:"underline" }}>{link}</a>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:"0.12em", marginBottom:8 }}>YOUR GEMINI API KEY</div>
        <input
          value={keyInput}
          onChange={e => { setKeyInput(e.target.value); setKeyError(""); }}
          onKeyDown={e => e.key === "Enter" && saveKey()}
          placeholder="AIza..."
          style={{
            width:"100%", padding:"14px 18px", borderRadius:13, marginBottom:10,
            background:"#221F32", border:`1px solid ${keyError ? T.red+"88" : T.borderSolid}`,
            color:T.text, fontSize:14, outline:"none", fontFamily:"'Inter',sans-serif",
            transition:"border-color 0.2s",
          }}
        />
        {keyError && <div style={{ color:T.red, fontSize:12, marginBottom:10 }}>{keyError}</div>}

        <Btn onClick={saveKey} disabled={!keyInput.trim() || testingKey} size="lg" style={{ width:"100%" }}>
          {testingKey ? "⏳ Testing key..." : "✓ Save & Connect"}
        </Btn>

        <div style={{ textAlign:"center", marginTop:14, color:T.muted, fontSize:11 }}>
          🔒 Key is saved only on your device — never sent anywhere else
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
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{ role:"user", parts:[{ text:"say hi" }] }], generationConfig:{ maxOutputTokens:10 } }) }
      );
      const d = await res.json();
      if (d.error) { setKeyError("❌ Invalid key: " + d.error.message); setTestingKey(false); return; }
      localStorage.setItem("ascend_gemini_key", k);
      setGeminiKey(k);
    } catch { setKeyError("❌ Connection failed. Check your internet and try again."); }
    setTestingKey(false);
  }

  // ── MAIN APP ──────────────────────────────────────
  const lvl = calcLvl(user.xp);
  const TABS = [
    { id:"dash",   icon:"⊞", label:"Dashboard" },
    { id:"goals",  icon:"🗺", label:"Quests"    },
    { id:"focus",  icon:"⌛", label:"Focus"     },
    { id:"tasks",  icon:"✓",  label:"Tasks"     },
    { id:"skills", icon:"⚔",  label:"Skills"    },
    { id:"ai",     icon:"✦",  label:"Coach"     },
  ];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Inter',sans-serif", position:"relative" }}>
      {/* XP pop-ups */}
      {xpPops.map(p => (
        <div key={p.id} style={{
          position:"fixed", top:"18%", left:"50%", transform:"translateX(-50%)",
          fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:26,
          color:T.accent, zIndex:9999, pointerEvents:"none",
          animation:"xpFloat 2.5s ease-out forwards",
          textShadow:`0 0 24px ${T.accent}`,
        }}>+{p.amount} XP ⚡</div>
      ))}

      {/* Level-up overlay */}
      {lvlUpMsg && (
        <div style={{
          position:"fixed", inset:0, zIndex:9998,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(26,24,37,0.88)", backdropFilter:"blur(14px)",
        }}>
          <div style={{
            textAlign:"center", padding:"48px 56px", borderRadius:28,
            background:"linear-gradient(135deg,#221F32,#2B2848)",
            border:`2px solid ${T.primary}`,
            boxShadow:`0 0 80px ${T.primary}55, 0 0 200px ${T.primary}22`,
            animation:"popBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <div style={{ fontSize:80, marginBottom:8, animation:"spin 1s ease-out" }}>🏆</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:40, fontWeight:800, color:T.primary, lineHeight:1.1 }}>
              LEVEL {lvlUpMsg}!
            </div>
            <div style={{ color:T.sub, marginTop:10, fontSize:15 }}>You're ascending higher, {user.name}!</div>
            <div style={{ marginTop:16 }}><Tag color={T.primary}>⚡ {user.xp.toLocaleString()} total XP</Tag></div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ maxWidth:500, margin:"0 auto", padding:"0 16px 100px" }}>
        {/* Header */}
        <div style={{ padding:"24px 0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ color:T.muted, fontSize:12 }}>Good to see you,</div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:21, fontWeight:700 }}>{user.name}</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {user.streak > 0 && (
                <div style={{ background:`${T.amber}22`, border:`1px solid ${T.amber}55`, borderRadius:10, padding:"5px 11px", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13, color:T.amber }}>
                  🔥 {user.streak}
                </div>
              )}
              <div style={{ background:`linear-gradient(135deg,${T.primary},${T.accent})`, borderRadius:10, padding:"5px 11px", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13, boxShadow:`0 0 16px ${T.primary}55` }}>
                ⚡ Lv.{lvl.l}
              </div>
            </div>
          </div>
          {/* XP Bar */}
          <div style={{ background:"#221F3299", backdropFilter:"blur(12px)", borderRadius:14, padding:"12px 16px", border:`1px solid ${T.borderSolid}55` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <div style={{ fontSize:11, color:T.muted }}>Level {lvl.l} → {lvl.l+1}</div>
              <div style={{ fontSize:11, color:T.primary, fontWeight:600 }}>{lvl.cur.toLocaleString()} / {lvl.max.toLocaleString()} XP</div>
            </div>
            <ProgressBar pct={lvl.pct} h={10} />
            <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>{(lvl.max-lvl.cur).toLocaleString()} XP to next level</div>
          </div>
        </div>

        {/* Tab content */}
        {tab === "dash"   && <DashTab  user={user} gainXP={gainXP} setU={setU} />}
        {tab === "goals"  && <GoalsTab user={user} setU={setU} gainXP={gainXP} />}
        {tab === "focus"  && <FocusTab user={user} gainXP={gainXP} setU={setU} />}
        {tab === "tasks"  && <TasksTab user={user} setU={setU} gainXP={gainXP} />}
        {tab === "skills" && <SkillsTab user={user} setU={setU} gainXP={gainXP} />}
        {tab === "ai"     && <AITab    user={user} />}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:100,
        background:"#1A182599", backdropFilter:"blur(24px) saturate(1.5)",
        borderTop:`1px solid ${T.borderSolid}55`,
        display:"flex", justifyContent:"space-around", padding:"10px 0 18px",
      }}>
        {TABS.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:"none", border:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            color: tab===id ? T.primary : T.muted,
            transition:"color 0.2s", padding:"4px 12px",
            position:"relative",
          }}>
            {tab===id && (
              <div style={{
                position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)",
                width:32, height:2, background:T.primary, borderRadius:99,
                boxShadow:`0 0 8px ${T.primary}`,
              }} />
            )}
            <span style={{ fontSize:21, lineHeight:1 }}>{icon}</span>
            <span style={{ fontSize:9, fontWeight:tab===id?700:500, letterSpacing:"0.04em" }}>{label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes xpFloat   { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} 30%{transform:translateX(-50%) translateY(-25px) scale(1.2)} 100%{opacity:0;transform:translateX(-50%) translateY(-110px) scale(0.8)} }
        @keyframes popBounce { from{transform:scale(0.2);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { from{transform:rotate(-20deg) scale(0.5)} to{transform:rotate(0) scale(1)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        input::placeholder, textarea::placeholder { color:${T.muted}; }
        input,textarea { caret-color:${T.primary}; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:${T.borderSolid}; border-radius:3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(0.5); }
      `}</style>
    </div>
  );
}
