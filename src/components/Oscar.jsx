"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { loadBookmarks, loadIssueJson, uploadIssueJson, parseIssueJson, addBookmark, removeBookmark, subscribeToChanges, loadCategories, setCategory as dbSetCategory, loadVotes, addVote, removeVote, loadVotingState, setVotingOpen as dbSetVotingOpen, loadPairs, createPair as dbCreatePair, updatePair as dbUpdatePair, deletePair as dbDeletePair } from "@/lib/db";


const CATEGORIES = ["characters","people","abstraction","environments","design","surreal + horror","architecture + interiors","transportation","plants","food","fine art","humor","sci-fi","fashion","animals"];
const MAX_CATEGORIZE = 1000;
const TEAM = ["Daniel","Hongrae","Chase"];
const COLORS = { Daniel:"#4d8fcc", Hongrae:"#e87a3a", Chase:"#6aaa6a" };
const REF_TYPES = ["Image Prompt","Style Reference","Character Reference","Omni Reference","Personalization"];
const SIZES = ["full bleed","inset small","inset large"];

const ThemeCtx = createContext("light");

const imgUrl = img => `https://cdn.midjourney.com/${img.id}/0_${img.parent_grid}_640_N.webp`;
const hasRefs = p => /https?:\/\/\S+/.test(p||"");
const selStyle = (dark) => ({ background:"transparent", border:`1px solid var(--bd)`, color:"var(--tx2)", fontSize:10, fontFamily:"'DM Mono',monospace", padding:"2px 4px", outline:"none", cursor:"pointer" });

function aspectPad(a) {
  if (!a) return "100%";
  const [w,h] = a.split(":").map(Number);
  if (!w||!h) return "100%";
  return `${Math.min((h/w)*100,200).toFixed(1)}%`;
}

function groupByChunks(images, n) {
  if (!images.length) return [];
  const sorted = [...images].sort((a,b)=>new Date(a.enqueue_time)-new Date(b.enqueue_time));
  const size = Math.ceil(sorted.length/n);
  return Array.from({length:n},(_,i)=>{
    const slice = sorted.slice(i*size,(i+1)*size);
    if (!slice.length) return null;
    const f = d => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    return { key:`c${i}`, label:`${f(slice[0].enqueue_time)} – ${f(slice[slice.length-1].enqueue_time)}`, images:slice };
  }).filter(Boolean);
}

function cleanPrompt(prompt, refTypeList) {
  let p = (prompt||"").replace(/https?:\/\/\S+/g,"").trim();
  const params = [];
  p = p.replace(/(--[\w.-]+(?:\s+(?!--)\S+)*)/g,m=>{params.push(m.trim());return "";}).replace(/\s+/g," ").trim().toLowerCase();
  const vParam = params.find(x=>x.startsWith("--v"));
  const rest = params.filter(x=>!x.startsWith("--v"));
  const paramLine = [vParam,...rest].filter(Boolean).join(" ");
  const refLine = refTypeList?.length ? refTypeList.map(t=>`[${t}]`).join(" ") : "";
  return [p,refLine,paramLine].filter(Boolean).join("\n");
}

// ── GLOBAL STYLES ──────────────────────────────────────────────
function GlobalStyles() {
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "osc-styles";
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      :root{
        --bg:#f0eeea;--sf:#ffffff;--sf2:#f8f7f4;--sf3:#eceae4;
        --bd:#e4e2da;--bd2:#c8c6be;
        --tx:#1c1b18;--tx2:#8a8880;--tx3:#c4c2ba;
        --ac:#1c1b18;--ac-tx:#f8f7f4;
        --bmb-off:rgba(255,255,255,.65);--img-ph:#e8e6e0;
        --hdr-bg:#ffffff;
      }
      .dark{
        --bg:#0e0e0c;--sf:#161614;--sf2:#1e1e1c;--sf3:#252522;
        --bd:#282826;--bd2:#3c3c38;
        --tx:#ddd8cf;--tx2:#666660;--tx3:#303030;
        --ac:#aaa8a0;--ac-tx:#0e0e0c;
        --bmb-off:rgba(0,0,0,.55);--img-ph:#1a1a18;
        --hdr-bg:#0e0e0c;
      }
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:var(--bg)}
      ::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:3px}
      .iw{position:relative;overflow:hidden;background:var(--img-ph);cursor:pointer}
      .iw img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .32s ease;display:block}
      .iw:hover img{transform:scale(1.04)}
      .iov{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,transparent 52%);opacity:0;transition:opacity .2s;pointer-events:none}
      .iw:hover .iov{opacity:1}
      .imt{position:absolute;bottom:0;left:0;right:0;padding:9px;opacity:0;transition:opacity .2s;pointer-events:none}
      .iw:hover .imt{opacity:1}
      .bmb{position:absolute;top:7px;right:7px;width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;backdrop-filter:blur(6px);transition:all .15s;z-index:2}
      .bmb.off{background:var(--bmb-off);color:var(--tx3)}
      .bmb.on{background:var(--ac);color:var(--ac-tx)}
      .bmb:hover{transform:scale(1.12)}
      .sgb{position:absolute;bottom:7px;right:7px;width:22px;height:22px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;backdrop-filter:blur(6px);background:var(--bmb-off);color:var(--tx3);opacity:0;transition:all .15s;z-index:3}
      .iw:hover .sgb{opacity:1}
      .sgb:hover{background:var(--ac);color:var(--ac-tx);transform:scale(1.1)}
      .tl{background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--tx3);font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:0 16px;height:100%;font-family:'DM Mono',monospace;transition:color .15s;white-space:nowrap}
      .tl:hover{color:var(--tx2)}
      .tl.on{color:var(--tx);border-bottom-color:var(--tx)}
      .pl{background:none;border:1px solid var(--bd);color:var(--tx2);cursor:pointer;padding:3px 9px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-family:'DM Mono',monospace;transition:all .15s;white-space:nowrap}
      .pl:hover,.pl.on{border-color:var(--bd2);color:var(--tx)}
      .pl.em{border-color:var(--tx);color:var(--tx);background:var(--sf3)}
      .ab{background:var(--ac);color:var(--ac-tx);border:none;cursor:pointer;padding:7px 16px;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;transition:opacity .15s;font-family:'DM Mono',monospace}
      .ab:hover{opacity:.85}
      .ab:disabled{opacity:.3;cursor:not-allowed}
      .vc{border:none;cursor:pointer;padding:3px 8px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.05em;transition:all .15s}
      .vc.off{background:var(--sf2);color:var(--tx3);border:1px solid var(--bd)}
      .vc.on{background:var(--ac);color:var(--ac-tx);border:1px solid var(--ac)}
      .vc:hover{border-color:var(--bd2);color:var(--tx)}
      .pc{background:var(--sf);border:1px solid var(--bd);padding:10px;margin-bottom:9px}
      .rtt label{display:flex;align-items:center;gap:5px;cursor:pointer;padding:3px 0;font-size:10px;color:var(--tx2);font-family:'DM Mono',monospace;white-space:nowrap}
      .rtt label:hover{color:var(--tx)}
      .rtt input[type=checkbox]{cursor:pointer}
      .fs-img{transition:transform .26s cubic-bezier(.25,.46,.45,.94),opacity .26s ease}
      .fs-img.swipe-left{transform:translateX(-160px) rotate(-7deg);opacity:0;pointer-events:none}
      .fs-img.swipe-right{transform:translateX(160px) rotate(7deg);opacity:0;pointer-events:none}
    `;
    if (!document.getElementById("osc-styles")) document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

/** Re-apply in-flight vote toggles after a server reload (realtime can fire before insert lands). */
function applyPendingVoteOps(server, pending) {
  if (!pending.size) return server;
  const result = {};
  for (const [voter, set] of Object.entries(server)) {
    result[voter] = new Set(set);
  }
  for (const [key, op] of pending) {
    const sep = key.indexOf(":");
    const voter = key.slice(0, sep);
    const imageId = key.slice(sep + 1);
    if (!result[voter]) result[voter] = new Set();
    if (op === "add") result[voter].add(imageId);
    else result[voter].delete(imageId);
  }
  return result;
}

// ── APP ────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const [images, setImages] = useState([]);
  const [bookmarks, setBookmarks] = useState({});
  const [categories, setCategories] = useState({});
  const [votes, setVotes] = useState({});
  const [submitted, setSubmitted] = useState(new Set());
  const [pairs, setPairs] = useState([]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [refTypes, setRefTypes] = useState({});
  const [tab, setTab] = useState("browse");
  const pendingVoteOpsRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    loadIssueJson()
      .then(data => { if (!cancelled && data) setImages(data); })
      .catch(err => console.error("Failed to load issue JSON:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBookmarks()
      .then(data => { if (!cancelled) setBookmarks(data); })
      .catch(err => console.error("Failed to load bookmarks:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCategories()
      .then(data => { if (!cancelled) setCategories(data); })
      .catch(err => console.error("Failed to load categories:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadVotes()
      .then(data => { if (!cancelled) setVotes(data); })
      .catch(err => console.error("Failed to load votes:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadVotingState()
      .then(data => { if (!cancelled) setVotingOpen(data); })
      .catch(err => console.error("Failed to load voting state:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPairs()
      .then(data => { if (!cancelled) setPairs(data); })
      .catch(err => console.error("Failed to load pairs:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let voteReloadTimer;
    const unsub = subscribeToChanges({
      onBookmarkChange: () => {
        loadBookmarks().then(setBookmarks).catch(err => console.error("Failed to reload bookmarks:", err));
      },
      onVoteChange: () => {
        clearTimeout(voteReloadTimer);
        voteReloadTimer = setTimeout(() => {
          loadVotes()
            .then(data => setVotes(applyPendingVoteOps(data, pendingVoteOpsRef.current)))
            .catch(err => console.error("Failed to reload votes:", err));
        }, 400);
      },
      onCategoryChange: () => {
        loadCategories().then(setCategories).catch(err => console.error("Failed to reload categories:", err));
      },
      onVotingStateChange: () => {
        loadVotingState().then(setVotingOpen).catch(err => console.error("Failed to reload voting state:", err));
      },
    });
    return () => {
      clearTimeout(voteReloadTimer);
      unsub();
    };
  }, []);

  const myBm = bookmarks[user] || new Set();
  const allBm = new Set(Object.values(bookmarks).flatMap(s=>[...s]));
  const myVotes = votes[user] || new Set();
  const voteCount = id => Object.values(votes).filter(s=>s.has(id)).length;
  const confirmedPairs = pairs.filter(p=>p.type==="confirmed");
  const proposals = pairs.filter(p=>p.type==="proposal");
  const confirmedPairedIds = new Set(confirmedPairs.flatMap(p=>[p.a.id,p.b.id]));

  const toggleBm = useCallback((id) => {
    if (!user) return;
    setBookmarks(prev => {
      const m = new Set(prev[user] || []);
      const had = m.has(id);
      if (had) m.delete(id); else m.add(id);
      const op = had ? removeBookmark(id, user) : addBookmark(id, user);
      op.catch(err => {
        console.error("Bookmark failed:", err);
        setBookmarks(prev);
      });
      return { ...prev, [user]: m };
    });
  }, [user]);
  const toggleVote = useCallback(id => {
    if (!user) return;
    const key = `${user}:${id}`;
    setVotes(prev => {
      const m = new Set(prev[user] || []);
      const had = m.has(id);
      const op = had ? "remove" : "add";
      if (had) m.delete(id); else m.add(id);
      pendingVoteOpsRef.current.set(key, op);
      (had ? removeVote(id, user) : addVote(id, user))
        .catch(err => {
          console.error("Vote failed:", err?.message ?? err, err?.code ? { code: err.code } : "");
          pendingVoteOpsRef.current.delete(key);
          setVotes(p => {
            const s = new Set(p[user] || []);
            if (had) s.add(id); else s.delete(id);
            return { ...p, [user]: s };
          });
        })
        .finally(() => pendingVoteOpsRef.current.delete(key));
      return { ...prev, [user]: m };
    });
  }, [user]);

  const updateCategory = useCallback((id, cat) => {
    setCategories(prev => ({ ...prev, [id]: cat }));
    dbSetCategory(id, cat).catch(err => console.error("Failed to save category:", err));
  }, []);

  const toggleVotingOpen = useCallback(() => {
    setVotingOpen(prev => {
      const next = !prev;
      dbSetVotingOpen(next).catch(err => console.error("Failed to save voting state:", err));
      return next;
    });
  }, []);
  const submitVotes = () => setSubmitted(s=>new Set([...s,user]));

  const handleUpload = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const raw = ev.target.result;
        const parsed = parseIssueJson(raw);
        setImages(parsed);
        setTab("browse");
        uploadIssueJson(raw).catch(err => console.error("Failed to upload issue JSON:", err));
      } catch { alert("Invalid JSON"); }
    };
    r.readAsText(f);
  };

  const toBase64 = async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result.split(',')[1], media_type: blob.type || 'image/webp' });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const CATEGORIZE_PROMPT = `You are categorizing Midjourney AI images for a print magazine.
Choose exactly one category. Use the image as the primary signal; the prompt is secondary context.

- characters: fictional/stylized figures, not realistic portraits
- people: realistic human subjects
- abstraction: non-representational shapes, textures, patterns
- environments: landscapes, nature scenes, outdoor settings
- design: graphic design, typography, product design, flat illustration
- surreal + horror: dreamlike, disturbing, or grotesque imagery
- architecture + interiors: buildings, rooms, urban spaces
- transportation: vehicles, aircraft, ships
- plants: botanical, flora, nature close-ups
- food: meals, ingredients, beverages
- fine art: painterly, classical art styles
- humor: comedic, whimsical, absurd
- sci-fi: futuristic, space, technology
- fashion: clothing, styling, editorial
- animals: creatures, wildlife, pets

Reply with ONLY the category name, exactly as written above.`;

  const categorizeAll = async (imgs, onProgress) => {
    const toProcess = imgs.slice(0, MAX_CATEGORIZE);
    for (let i=0; i<toProcess.length; i++) {
      const img = toProcess[i];
      if (categories[img.id]) { onProgress(i+1); continue; }
      try {
        const { data: imgData, media_type } = await toBase64(imgUrl(img));
        const res = await fetch("/api/claude", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:20,
            messages:[{role:"user",content:[
              {type:"image",source:{type:"base64",media_type,data:imgData}},
              {type:"text",text:`${CATEGORIZE_PROMPT}\n\nPrompt: "${img.prompt.substring(0,250)}"`}
            ]}] })
        });
        const data = await res.json();
        if (!res.ok) { console.error('[categorize] Anthropic error', res.status, JSON.stringify(data)); continue; }
        const raw=(data.content?.[0]?.text||"").trim().toLowerCase();
        const cat=CATEGORIES.find(c=>raw===c||raw.startsWith(c));
        if (cat) updateCategory(img.id, cat);
      } catch (e) { console.error('[categorize] fetch error', e); }
      onProgress(i+1);
    }
    onProgress(imgs.length);
  };

  const collImages = images.filter(i=>allBm.has(i.id));
  const sortedColl = [...collImages].sort((a,b)=>voteCount(b.id)-voteCount(a.id));

  if (!user) return (
    <ThemeCtx.Provider value={dark?"dark":"light"}>
      <GlobalStyles/>
      <div className={dark?"dark":""} style={{background:"var(--bg)",minHeight:"100vh"}}>
        <NamePicker onSelect={setUser} dark={dark} onToggleDark={()=>setDark(v=>!v)}/>
      </div>
    </ThemeCtx.Provider>
  );

  return (
    <ThemeCtx.Provider value={dark?"dark":"light"}>
      <GlobalStyles/>
      <div className={dark?"dark":""} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--tx)",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 22px",borderBottom:"1px solid var(--bd)",height:50,flexShrink:0,position:"sticky",top:0,zIndex:100,background:"var(--hdr-bg)"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:"var(--tx)",letterSpacing:"-.02em"}}>Oscar</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",letterSpacing:".1em"}}>ISS. 38</span>
          </div>
          <nav style={{display:"flex",height:"100%"}}>
            {["browse","collection","vote","pair","export"].map(t=>(
              <button key={t} className={`tl ${tab===t?"on":""}`} onClick={()=>setTab(t)}>
                {t}
                {t==="collection"&&allBm.size>0&&<span style={{marginLeft:5,fontSize:9,color:tab==="collection"?"var(--tx)":"var(--tx3)"}}>{allBm.size}</span>}
                {t==="vote"&&collImages.length>0&&<span style={{marginLeft:5,fontSize:9,color:tab==="vote"?"var(--tx)":"var(--tx3)"}}>{collImages.length}</span>}
                {t==="pair"&&pairs.length>0&&<span style={{marginLeft:5,fontSize:9,color:tab==="pair"?"var(--tx)":"var(--tx3)"}}>{confirmedPairs.length}{proposals.length>0&&`+${proposals.length}p`}</span>}
              </button>
            ))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx2)"}}>{user}</span>
            <button className="pl" onClick={()=>setUser(null)} style={{padding:"2px 7px",fontSize:9}}>switch</button>
            <ShortcutsTooltip/>
            <button className="pl" onClick={()=>setDark(v=>!v)} style={{padding:"3px 8px",fontSize:11}}>{dark?"☀":"☾"}</button>
          </div>
        </header>
        <main style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {tab==="browse"&&<BrowseTab images={images} myBm={myBm} allBm={allBm} onBm={toggleBm} onUpload={handleUpload}/>}
          {tab==="collection"&&<CollectionTab collImages={collImages} categories={categories} onCategoryChange={updateCategory} bookmarks={bookmarks} myBm={myBm} allBm={allBm} onBm={toggleBm} votingOpen={votingOpen} toggleVotingOpen={toggleVotingOpen} categorizeAll={categorizeAll} refTypes={refTypes} setRefTypes={setRefTypes}/>}
          {tab==="vote"&&<VoteTab images={sortedColl} votes={votes} myVotes={myVotes} voteCount={voteCount} toggleVote={toggleVote} myBm={myBm} allBm={allBm} onBm={toggleBm} categories={categories} votingOpen={votingOpen} submitted={submitted} onSubmit={submitVotes} user={user}/>}
          {tab==="pair"&&<PairTab images={images} sortedColl={sortedColl} pairs={pairs} setPairs={setPairs} categories={categories} voteCount={voteCount} confirmedPairedIds={confirmedPairedIds} user={user}/>}
          {tab==="export"&&<ExportTab pairs={confirmedPairs} images={images} categories={categories} votes={votes} bookmarks={bookmarks} refTypes={refTypes}/>}
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}

// ── NAME PICKER ────────────────────────────────────────────────
function NamePicker({ onSelect, dark, onToggleDark }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",position:"relative"}}>
      <button onClick={onToggleDark} style={{position:"absolute",top:18,right:22,background:"none",border:"1px solid var(--bd)",color:"var(--tx2)",cursor:"pointer",padding:"3px 10px",fontFamily:"'DM Mono',monospace",fontSize:11}}>{dark?"☀":"☾"}</button>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:42,fontWeight:500,color:"var(--tx)",marginBottom:6,letterSpacing:"-.02em"}}>Oscar</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",letterSpacing:".18em",marginBottom:52}}>ISSUE 38</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx2)",marginBottom:18,letterSpacing:".06em"}}>who are you?</div>
      <div style={{display:"flex",gap:10}}>
        {TEAM.map(n=><button key={n} className="ab" onClick={()=>onSelect(n)} style={{padding:"10px 28px",fontSize:13,letterSpacing:".04em"}}>{n}</button>)}
      </div>
      {!adding ? (
        <button onClick={()=>setAdding(true)} style={{marginTop:24,background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",letterSpacing:".06em",textDecoration:"underline",textUnderlineOffset:3}}>or add new voter</button>
      ) : (
        <div style={{marginTop:22,display:"flex",gap:8,alignItems:"center"}}>
          <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&newName.trim()&&onSelect(newName.trim())} placeholder="name" style={{background:"var(--sf)",border:"1px solid var(--bd)",color:"var(--tx)",padding:"6px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,outline:"none",width:160}}/>
          <button className="ab" onClick={()=>newName.trim()&&onSelect(newName.trim())} style={{padding:"7px 16px",fontSize:11}}>join</button>
          <button onClick={()=>setAdding(false)} className="pl" style={{padding:"6px 10px"}}>cancel</button>
        </div>
      )}
    </div>
  );
}

// ── SHORTCUTS TOOLTIP ──────────────────────────────────────────
function ShortcutsTooltip() {
  const [show, setShow] = useState(false);
  const shortcuts = [["G","grid mode"],["F","fullscreen mode"],["Esc","back to grid"],["Space","next image"],["B","bookmark + next"],["⌫","undo"],["⌘ click","bookmark in grid"],["← →","navigate"]];
  return (
    <div style={{position:"relative"}} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <button className="pl" style={{padding:"3px 8px",fontSize:9}}>⌨ shortcuts</button>
      {show&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--sf)",border:"1px solid var(--bd)",padding:"12px 14px",zIndex:300,minWidth:220,boxShadow:"0 4px 16px rgba(0,0,0,.08)"}}>
          {shortcuts.map(([k,d])=>(
            <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7,gap:16}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx)",background:"var(--sf2)",border:"1px solid var(--bd)",padding:"1px 6px",letterSpacing:".04em",whiteSpace:"nowrap"}}>{k}</span>
              <span style={{fontSize:11,color:"var(--tx2)",textAlign:"right"}}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BROWSE TAB ─────────────────────────────────────────────────
function BrowseTab({ images, myBm, allBm, onBm, onUpload }) {
  const [mode, setMode] = useState("grid");
  const [numChunks, setNumChunks] = useState(3);
  const [chunkFilter, setChunkFilter] = useState(null);
  const [bmFilter, setBmFilter] = useState(false);
  const [colSize, setColSize] = useState("M");
  const COL_COUNTS = {S:10, M:7, L:5, XL:3};
  const [chunkPages, setChunkPages] = useState({});
  const [fsIdx, setFsIdx] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [swipeDir, setSwipeDir] = useState(null);

  const chunks = groupByChunks(images, numChunks);
  const displayedChunks = chunkFilter ? chunks.filter(c=>c.key===chunkFilter) : chunks;
  const flatImages = displayedChunks.flatMap(c=>c.images);

  const flatImagesRef = useRef(flatImages);
  const fsIdxRef = useRef(fsIdx);
  useEffect(() => { flatImagesRef.current = flatImages; }, [flatImages.length]);
  useEffect(() => { fsIdxRef.current = fsIdx; }, [fsIdx]);

  // Global g/f shortcuts
  useEffect(() => {
    const h = e => {
      if (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if (e.key==="g"||e.key==="G") setMode("grid");
      else if (e.key==="f"||e.key==="F") setMode("fullscreen");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const doAdvance = useCallback((bookmark) => {
    const dir = bookmark ? "right" : "left";
    setSwipeDir(dir);
    setTimeout(() => {
      if (bookmark) {
        const img = flatImagesRef.current[fsIdxRef.current];
        if (img) { onBm(img.id); setUndoStack(s=>[...s,{id:img.id}]); }
      }
      setFsIdx(i => Math.min(i+1, flatImagesRef.current.length-1));
      setSwipeDir(null);
    }, 270);
  }, [onBm]);

  // Fullscreen keyboard handler
  useEffect(() => {
    if (mode!=="fullscreen") return;
    const h = e => {
      if (e.key==="Escape") { setMode("grid"); return; }
      if (e.key===" ") { e.preventDefault(); doAdvance(false); }
      else if (e.key.toLowerCase()==="b") doAdvance(true);
      else if (e.key==="ArrowLeft") { setSwipeDir(null); setFsIdx(i=>Math.max(i-1,0)); }
      else if (e.key==="ArrowRight") { setSwipeDir(null); setFsIdx(i=>Math.min(i+1,flatImagesRef.current.length-1)); }
      else if (e.key==="Backspace") {
        e.preventDefault();
        setUndoStack(s=>{
          const last=s[s.length-1];
          if (last) onBm(last.id);
          return last?s.slice(0,-1):s;
        });
        setFsIdx(i=>Math.max(i-1,0));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode, doAdvance, onBm]);

  if (images.length===0) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"calc(100vh - 50px)",gap:18}}>
      <div style={{width:52,height:52,border:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)",fontSize:20}}>↑</div>
      <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",letterSpacing:".12em"}}>UPLOAD JSON TO BEGIN</p>
      <label className="ab" style={{cursor:"pointer",padding:"10px 24px"}}>Upload JSON<input type="file" accept=".json" onChange={onUpload} style={{display:"none"}}/></label>
    </div>
  );

  const fsImg = flatImages[fsIdx];
  const fsBm = fsImg && myBm.has(fsImg.id);

  return (
    <>
    {mode==="fullscreen" && fsImg && (
      <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",background:"var(--bg)"}}>
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 36px",position:"relative",overflow:"hidden",cursor:"pointer"}} onClick={()=>setMode("grid")}>
          <button onClick={e=>{e.stopPropagation();setSwipeDir(null);setFsIdx(i=>Math.max(i-1,0));}} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"var(--sf)",border:"1px solid var(--bd)",color:"var(--tx2)",width:34,height:56,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>&#8249;</button>
          <img src={imgUrl(fsImg)} alt="" className={`fs-img${swipeDir?` swipe-${swipeDir}`:""}`} style={{maxHeight:"calc(100vh - 120px)",maxWidth:"100%",objectFit:"contain",display:"block",cursor:"default"}} onClick={e=>e.stopPropagation()} onError={e=>e.target.style.opacity=".2"}/>
          <button onClick={e=>{e.stopPropagation();setSwipeDir(null);setFsIdx(i=>Math.min(i+1,flatImages.length-1));}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"var(--sf)",border:"1px solid var(--bd)",color:"var(--tx2)",width:34,height:56,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>&#8250;</button>
        </div>
        <div style={{width:288,borderLeft:"1px solid var(--bd)",padding:22,display:"flex",flexDirection:"column",gap:16,overflowY:"auto",background:"var(--sf)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{fsIdx+1} / {flatImages.length}</span>
            <button className="pl" onClick={()=>setMode("grid")}>back to grid</button>
          </div>
          <div>
            <div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:".1em",marginBottom:8}}>PROMPT</div>
            <p style={{fontSize:11,color:"var(--tx2)",lineHeight:1.75,fontFamily:"'DM Mono',monospace"}}>{fsImg.prompt}</p>
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx2)"}}>@{fsImg.user_name}</div>
          <button className={fsBm?"ab":"pl"} onClick={()=>doAdvance(true)} style={{padding:"9px 0",fontSize:11,letterSpacing:".06em",textAlign:"center",cursor:"pointer",width:"100%"}}>
            {fsBm?"bookmarked":"bookmark  [B]"}
          </button>
          <div style={{borderTop:"1px solid var(--bd)",paddingTop:14,fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",lineHeight:2.5}}>
            Space  next · B  bookmark + next<br/>Backspace  undo · Esc  back to grid
          </div>
        </div>
      </div>
    )}
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 50px)",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderBottom:"1px solid var(--bd)",flexShrink:0,flexWrap:"wrap",background:"var(--sf2)"}}>
        <button className={`pl ${mode==="grid"?"on":""}`} onClick={()=>setMode("grid")}>grid [G]</button>
        <button className={`pl ${mode==="fullscreen"?"on":""}`} onClick={()=>setMode("fullscreen")}>fullscreen [F]</button>
        <div style={{width:1,height:14,background:"var(--bd)",margin:"0 3px"}}/>
        <button className={`pl ${!chunkFilter&&!bmFilter?"on":""}`} onClick={()=>{setChunkFilter(null);setBmFilter(false);}}>all</button>
        {chunks.map((c,i)=><button key={c.key} className={`pl ${chunkFilter===c.key?"on":""}`} onClick={()=>{setChunkFilter(c.key);setBmFilter(false);}} style={{fontSize:9}}>{c.label} <span style={{opacity:.4}}>{c.images.length}</span></button>)}
        <button className={`pl ${bmFilter?"on":""}`} onClick={()=>{setBmFilter(v=>!v);setChunkFilter(null);}}>bookmarked <span style={{opacity:.4}}>{allBm.size}</span></button>
        <div style={{width:1,height:14,background:"var(--bd)",margin:"0 3px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>split</span>
          <button className="pl" onClick={()=>setNumChunks(n=>Math.max(1,n-1))} style={{padding:"2px 7px"}}>−</button>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx)",minWidth:14,textAlign:"center"}}>{numChunks}</span>
          <button className="pl" onClick={()=>setNumChunks(n=>Math.min(10,n+1))} style={{padding:"2px 7px"}}>+</button>
        </div>
        <div style={{width:1,height:14,background:"var(--bd)",margin:"0 3px"}}/>
        {["S","M","L","XL"].map(s=>(
          <button key={s} className={`pl ${colSize===s?"on":""}`} onClick={()=>setColSize(s)} style={{padding:"2px 8px"}}>{s}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:7,alignItems:"center"}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{images.length.toLocaleString()}</span>
          <label className="pl" style={{cursor:"pointer"}}>replace<input type="file" accept=".json" onChange={onUpload} style={{display:"none"}}/></label>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"18px 18px 40px"}}>
        {displayedChunks.map(chunk=>{
          const allImgs = bmFilter ? chunk.images.filter(i=>allBm.has(i.id)) : chunk.images;
          if (!allImgs.length) return null;
          const ps = chunkPages[chunk.key] || 200;
          const imgs = allImgs.slice(0, ps);
          return (
            <div key={chunk.key} style={{marginBottom:34}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:13}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",letterSpacing:".1em"}}>{chunk.label}</span>
                <span style={{fontSize:9,color:"var(--tx3)"}}>{allImgs.length}</span>
                <div style={{flex:1,height:1,background:"var(--bd)"}}/>
              </div>
              <MGrid images={imgs} myBm={myBm} allBm={allBm} onBm={onBm} colCount={COL_COUNTS[colSize]}
                onFullscreen={img=>{const idx=flatImages.findIndex(i=>i.id===img.id);setFsIdx(Math.max(0,idx));setMode("fullscreen");}}/>
              {allImgs.length > ps && (
                <button className="pl" onClick={()=>setChunkPages(p=>({...p,[chunk.key]:ps+400}))} style={{marginTop:10,width:"100%",padding:"7px 0",textAlign:"center"}}>
                  load more · {allImgs.length - ps} remaining
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

// ── MASONRY GRID ───────────────────────────────────────────────
function MGrid({ images, myBm, allBm, onBm, onFullscreen, showCat, categories, onCatChange, showVotes, votes, myVotes, voteCount, onVote, showSel, selId, onSel, suggestion, onSuggest, showRefs, refTypes, onRefTypeChange, colCount=7 }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${colCount},1fr)`,gap:7}}>
      {images.map(img=>(
        <div key={img.id}>
          <ICard img={img} bm={myBm?.has(img.id)} bmO={allBm?.has(img.id)&&!myBm?.has(img.id)}
            onBm={onBm} onFull={onFullscreen}
            showCat={showCat} cat={categories?.[img.id]} onCat={onCatChange}
            showVotes={showVotes} voted={myVotes?.has(img.id)} vc={voteCount?.(img.id)||0} onVote={onVote} votes={votes}
            showSel={showSel} sel={selId===img.id} suggested={suggestion===img.id} onSel={onSel}
            onSuggest={onSuggest}
            showRefs={showRefs} refs={refTypes?.[img.id]||[]} onRefChange={v=>onRefTypeChange?.(img.id,v)}/>
        </div>
      ))}
    </div>
  );
}

// ── IMAGE CARD ─────────────────────────────────────────────────
function ICard({ img, bm, bmO, onBm, onFull, showCat, cat, onCat, showVotes, voted, vc, onVote, votes, showSel, sel, suggested, onSel, onSuggest, showRefs, refs, onRefChange }) {
  const [err, setErr] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  const handleClick = e => {
    if (e.metaKey||e.ctrlKey) {
      if (onBm) { e.stopPropagation(); onBm(img.id); return; }
      if (onVote) { e.stopPropagation(); onVote(img.id); return; }
    }
    if (showSel) onSel?.(img); else onFull?.(img);
  };

  const outline = suggested ? "2px solid var(--tx2)" : sel ? "2px solid var(--tx)" : "none";

  return (
    <div style={{outline,outlineOffset:outline!=="none"?2:0}}>
      <div className="iw" style={{paddingBottom:aspectPad(img.aspect)}} onClick={handleClick}>
        {!err ? <img src={imgUrl(img)} alt="" loading="lazy" onError={()=>setErr(true)}/> : <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)",fontSize:9,fontFamily:"'DM Mono',monospace"}}>no image</div>}
        <div className="iov"/>
        <div className="imt">
          <div style={{fontSize:9,color:"#ccc",fontFamily:"'DM Mono',monospace"}}>@{img.user_name}</div>
        </div>
        {onBm&&<button className={`bmb ${bm?"on":"off"}`} onClick={e=>{e.stopPropagation();onBm(img.id);}}>{bm?"★":"☆"}</button>}
        {bmO&&!bm&&<div style={{position:"absolute",top:7,left:7,width:6,height:6,borderRadius:"50%",background:"var(--tx3)"}}/>}
        {showVotes&&vc>0&&<div style={{position:"absolute",top:7,left:"7px",background:"rgba(0,0,0,.6)",borderRadius:2,padding:"1px 5px",fontSize:8,fontFamily:"'DM Mono',monospace",color:"#fff"}}>{vc}</div>}
        {cat&&!showCat&&<div style={{position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.7)",padding:"1px 5px",fontSize:7,color:"#eee",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:".06em"}}>{cat}</div>}
        {showRefs&&hasRefs(img.prompt)&&<div style={{position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.7)",padding:"1px 5px",fontSize:7,color:"#ffa",fontFamily:"'DM Mono',monospace"}}>refs</div>}
        {onSuggest&&<button className="sgb" onClick={e=>{e.stopPropagation();onSuggest(img);}} title="AI suggest pair">✦</button>}
        {suggested&&<div style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,.6)",border:"1px solid var(--tx2)",borderRadius:2,padding:"1px 5px",fontSize:7,color:"var(--tx2)",fontFamily:"'DM Mono',monospace"}}>suggested</div>}
      </div>
      {(showCat||showVotes||showRefs)&&(
        <div style={{background:"var(--sf)",padding:"6px 7px",display:"flex",flexDirection:"column",gap:5,borderTop:"1px solid var(--bd)"}}>
          {showCat&&(
            <select value={cat||""} onChange={e=>{e.stopPropagation();onCat?.(img.id,e.target.value);}} onClick={e=>e.stopPropagation()} style={{background:"var(--sf)",border:"1px solid var(--bd)",color:cat?"var(--tx)":"var(--tx3)",fontSize:10,fontFamily:"'DM Mono',monospace",padding:"2px 4px",outline:"none",cursor:"pointer",width:"100%",textTransform:"capitalize"}}>
              <option value="">— category —</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {showRefs&&hasRefs(img.prompt)&&(
            <div style={{position:"relative"}}>
              <button onClick={e=>{e.stopPropagation();setRefOpen(v=>!v);}} className={`pl ${refs.length?"em":""}`} style={{width:"100%",textAlign:"left",padding:"2px 6px",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>
                {refs.length?refs.join(", "):"⚠ tag ref type"}
              </button>
              {refOpen&&(
                <div className="rtt" onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:"calc(100% + 3px)",left:0,background:"var(--sf)",border:"1px solid var(--bd)",padding:"8px 10px",zIndex:50,minWidth:180,boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
                  {REF_TYPES.map(t=>(
                    <label key={t}>
                      <input type="checkbox" checked={refs.includes(t)} onChange={e=>{onRefChange?.(e.target.checked?[...refs,t]:refs.filter(x=>x!==t));}}/>
                      {t}
                    </label>
                  ))}
                  <button onClick={()=>setRefOpen(false)} className="pl" style={{marginTop:6,width:"100%",textAlign:"center"}}>done</button>
                </div>
              )}
            </div>
          )}
          {showVotes&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <button className={`vc ${voted?"on":"off"}`} onClick={e=>{e.stopPropagation();onVote?.(img.id);}}>{voted?"✓ voted":"vote"}</button>
              {votes&&<div style={{display:"flex",gap:3}}>{TEAM.map(n=>votes[n]?.has(img.id)&&<div key={n} title={n} style={{width:6,height:6,borderRadius:"50%",background:COLORS[n]}}/>)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── FULLSCREEN VIEWER ──────────────────────────────────────────
function FSViewer({ images, startIdx, onClose, myBm, onBm, myVotes, onVote }) {
  const [idx, setIdx] = useState(startIdx);
  const idxRef = useRef(idx);
  const imgsRef = useRef(images);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { imgsRef.current = images; }, [images]);

  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") setIdx(i => Math.max(i-1, 0));
      if (e.key === "ArrowRight") setIdx(i => Math.min(i+1, imgsRef.current.length-1));
      if ((e.metaKey||e.ctrlKey) && onBm) { const img=imgsRef.current[idxRef.current]; if(img) onBm(img.id); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onBm]);

  const img = images[idx];
  if (!img) return null;
  const bm = myBm?.has(img.id);
  const voted = myVotes?.has(img.id);

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",background:"var(--bg)"}}>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 36px",position:"relative",overflow:"hidden",cursor:"pointer"}} onClick={onClose}>
        <button onClick={e=>{e.stopPropagation();setIdx(i=>Math.max(i-1,0));}} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"var(--sf)",border:"1px solid var(--bd)",color:"var(--tx2)",width:34,height:56,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>‹</button>
        <img src={imgUrl(img)} alt="" style={{maxHeight:"calc(100vh - 120px)",maxWidth:"100%",objectFit:"contain",display:"block",cursor:"default"}} onClick={e=>e.stopPropagation()} onError={e=>e.target.style.opacity=".2"}/>
        <button onClick={e=>{e.stopPropagation();setIdx(i=>Math.min(i+1,images.length-1));}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"var(--sf)",border:"1px solid var(--bd)",color:"var(--tx2)",width:34,height:56,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>›</button>
      </div>
      <div style={{width:288,borderLeft:"1px solid var(--bd)",padding:22,display:"flex",flexDirection:"column",gap:16,overflowY:"auto",background:"var(--sf)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{idx+1} / {images.length}</span>
          <button className="pl" onClick={onClose}>← grid</button>
        </div>
        <div>
          <div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:".1em",marginBottom:8}}>PROMPT</div>
          <p style={{fontSize:11,color:"var(--tx2)",lineHeight:1.75,fontFamily:"'DM Mono',monospace"}}>{img.prompt}</p>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx2)"}}>@{img.user_name}</div>
        {onBm&&<button className={bm?"ab":"pl"} onClick={()=>onBm(img.id)} style={{padding:"9px 0",fontSize:11,letterSpacing:".06em",textAlign:"center",width:"100%"}}>{bm?"✓ bookmarked":"bookmark"}</button>}
        {onVote&&<button className={voted?"ab":"pl"} onClick={()=>onVote(img.id)} style={{padding:"9px 0",fontSize:11,letterSpacing:".06em",textAlign:"center",width:"100%"}}>{voted?"✓ voted":"vote"}</button>}
        <div style={{borderTop:"1px solid var(--bd)",paddingTop:14,fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",lineHeight:2.5}}>
          ← →  navigate{onBm?" · ⌘  bookmark":""}{onVote?" · ⌘  vote":""}<br/>Esc  close · click bg  close
        </div>
      </div>
    </div>
  );
}

// ── COLLECTION TAB ─────────────────────────────────────────────
function CollectionTab({ collImages, categories, onCategoryChange, bookmarks, myBm, allBm, onBm, votingOpen, toggleVotingOpen, categorizeAll, refTypes, setRefTypes }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [catFilter, setCatFilter] = useState(null);
  const [showRefsOnly, setShowRefsOnly] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);
  const [fsIdx, setFsIdx] = useState(0);

  const setCategory = (id,cat) => onCategoryChange(id,cat);
  const setRefType = (id,types) => setRefTypes(p=>({...p,[id]:types}));
  const run = async () => { setRunning(true); setProgress(0); await categorizeAll(collImages,p=>setProgress(p)); setRunning(false); };
  const categorized = collImages.filter(i=>categories[i.id]).length;
  const refImages = collImages.filter(i=>hasRefs(i.prompt));
  const taggedRefs = refImages.filter(i=>refTypes[i.id]?.length);
  let filtered = catFilter ? collImages.filter(i=>categories[i.id]===catFilter) : collImages;
  if (showRefsOnly) filtered = filtered.filter(i=>hasRefs(i.prompt));
  const openFs = img => { setFsIdx(filtered.findIndex(i=>i.id===img.id)); setFsOpen(true); };

  return (
    <>
    {fsOpen&&<FSViewer images={filtered} startIdx={fsIdx} onClose={()=>setFsOpen(false)} myBm={myBm} onBm={onBm}/>}
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 50px)",overflow:"hidden"}}>
      <div style={{padding:"9px 18px",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:9,flexShrink:0,flexWrap:"wrap",background:"var(--sf2)"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{collImages.length} bookmarked</span>
        <div style={{width:1,height:14,background:"var(--bd)"}}/>
        <button className="ab" onClick={run} disabled={running||collImages.length===0}>
          {running?`categorizing… ${progress}/${collImages.length}`:`ai categorize${categorized>0?` (${categorized}/${collImages.length})`:""}`}
        </button>
        {refImages.length>0&&<button className={`pl ${showRefsOnly?"em":""}`} onClick={()=>setShowRefsOnly(v=>!v)}>⚠ refs · {taggedRefs.length}/{refImages.length} tagged</button>}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:votingOpen?"#6aaa6a":"var(--tx3)"}}>{votingOpen?"● open":"○ locked"}</span>
          <button className={`pl ${votingOpen?"em":""}`} onClick={toggleVotingOpen}>{votingOpen?"lock voting":"open voting"}</button>
        </div>
      </div>
      <div style={{padding:"7px 18px",borderBottom:"1px solid var(--bd)",display:"flex",gap:5,flexWrap:"wrap",flexShrink:0,background:"var(--sf2)"}}>
        <button className={`pl ${!catFilter?"on":""}`} onClick={()=>setCatFilter(null)}>all</button>
        {CATEGORIES.filter(c=>collImages.some(i=>categories[i.id]===c)).map(c=>(
          <button key={c} className={`pl ${catFilter===c?"on":""}`} onClick={()=>setCatFilter(c)} style={{textTransform:"capitalize"}}>{c} <span style={{opacity:.4}}>{collImages.filter(i=>categories[i.id]===c).length}</span></button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 18px 40px"}}>
        {Object.entries(bookmarks).map(([name,bmSet])=>{
          const imgs = filtered.filter(i=>bmSet.has(i.id));
          if (!imgs.length) return null;
          return (
            <div key={name} style={{marginBottom:30}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:COLORS[name]||"var(--tx3)"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",letterSpacing:".1em"}}>{name.toUpperCase()}</span>
                <span style={{fontSize:9,color:"var(--tx3)"}}>{imgs.length}</span>
                <div style={{flex:1,height:1,background:"var(--bd)"}}/>
              </div>
              <MGrid images={imgs} myBm={myBm} allBm={allBm} onBm={onBm} showCat categories={categories} onCatChange={setCategory} showRefs refTypes={refTypes} onRefTypeChange={setRefType} onFullscreen={openFs}/>
            </div>
          );
        })}
        {!collImages.length&&<div style={{color:"var(--tx3)",fontSize:12,textAlign:"center",paddingTop:60,fontFamily:"'DM Mono',monospace"}}>no bookmarks yet — go to browse</div>}
      </div>
    </div>
    </>
  );
}

// ── VOTE TAB ───────────────────────────────────────────────────
function VoteTab({ images, votes, myVotes, voteCount, toggleVote, myBm, allBm, onBm, categories, votingOpen, submitted, onSubmit, user }) {
  const [showOthers, setShowOthers] = useState(false);
  const [catFilter, setCatFilter] = useState(null);
  const [fsOpen, setFsOpen] = useState(false);
  const [fsIdx, setFsIdx] = useState(0);
  const myVoteCount = images.filter(i=>myVotes.has(i.id)).length;
  const hasSubmitted = submitted.has(user);
  const filtered = catFilter ? images.filter(i=>categories[i.id]===catFilter) : images;
  const openFs = img => { setFsIdx(filtered.findIndex(i=>i.id===img.id)); setFsOpen(true); };

  if (!votingOpen) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"calc(100vh - 50px)",flexDirection:"column",gap:10}}>
      <div style={{fontSize:28,color:"var(--tx3)"}}>⊘</div>
      <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",letterSpacing:".1em"}}>VOTING NOT YET OPEN</p>
      <p style={{fontSize:11,color:"var(--tx3)"}}>Unlock from the collection tab</p>
    </div>
  );

  return (
    <>
    {fsOpen&&<FSViewer images={filtered} startIdx={fsIdx} onClose={()=>setFsOpen(false)} myBm={myBm} onBm={onBm} myVotes={myVotes} onVote={toggleVote}/>}
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 50px)",overflow:"hidden"}}>
      <div style={{padding:"9px 18px",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap",background:"var(--sf2)"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx)"}}>{myVoteCount} voted</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{images.length} total</span>
        <div style={{width:1,height:14,background:"var(--bd)",margin:"0 3px"}}/>
        <button className={`pl ${showOthers?"on":""}`} onClick={()=>setShowOthers(v=>!v)}>{showOthers?"hide":"show"} others</button>
        <div style={{width:1,height:14,background:"var(--bd)",margin:"0 3px"}}/>
        <button className={`pl ${!catFilter?"on":""}`} onClick={()=>setCatFilter(null)}>all</button>
        {CATEGORIES.filter(c=>images.some(i=>categories[i.id]===c)).map(c=>(
          <button key={c} className={`pl ${catFilter===c?"on":""}`} onClick={()=>setCatFilter(c)} style={{textTransform:"capitalize"}}>{c}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {TEAM.map(n=>(
              <div key={n} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:submitted.has(n)?COLORS[n]:"var(--bd2)",transition:"background .3s"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:submitted.has(n)?"var(--tx)":"var(--tx3)"}}>{n}</span>
              </div>
            ))}
          </div>
          <button className={hasSubmitted?"pl em":"ab"} onClick={onSubmit} disabled={hasSubmitted} style={{fontSize:10,padding:"5px 14px"}}>
            {hasSubmitted?"✓ submitted":"submit votes"}
          </button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 18px 40px"}}>
        <MGrid images={filtered} myBm={myBm} allBm={allBm} myVotes={myVotes} voteCount={voteCount} onVote={toggleVote} showVotes votes={showOthers?votes:{}} onFullscreen={openFs}/>
      </div>
    </div>
    </>
  );
}

// ── PAIR TAB ───────────────────────────────────────────────────
function PairTab({ images, sortedColl, pairs, setPairs, categories, voteCount, confirmedPairedIds, user }) {
  const [catFilter, setCatFilter] = useState(null);
  const [poolMode, setPoolMode] = useState("unpaired");
  const [pairingA, setPairingA] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(null);

  const unpairedPool = sortedColl.filter(i=>!confirmedPairedIds.has(i.id));
  const pool = poolMode==="all" ? sortedColl : unpairedPool;
  const filteredPool = catFilter ? pool.filter(i=>categories[i.id]===catFilter) : pool;

  const handleSel = img => {
    if (!pairingA) { setPairingA(img); setSuggestion(null); return; }
    if (pairingA.id===img.id) { setPairingA(null); return; }
    const type = poolMode==="all" ? "proposal" : "confirmed";
    const newPair = {id:`${Date.now()}`,a:{id:pairingA.id,side:"L",size:"full bleed"},b:{id:img.id,side:"R",size:"full bleed"},creator:user,type};
    setPairs(p=>[...p,newPair]);
    dbCreatePair(newPair).catch(err => console.error("Failed to save pair:", err));
    setPairingA(null); setSuggestion(null);
  };

  const suggestPair = async img => {
    setSuggesting(img.id); setSuggestion(null);
    const candidates = filteredPool.filter(i=>i.id!==img.id).slice(0,20);
    try {
      const res = await fetch("/api/claude", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:120,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"url",url:imgUrl(img)}},
            {type:"text",text:`You're helping pair images for a print magazine spread. This is image A.\nCandidates:\n${candidates.map(c=>`ID: ${c.id}\nPrompt: "${c.prompt.substring(0,120)}"`).join("\n---\n")}\nWhich candidate makes the best magazine spread pair with image A? Consider visual harmony, tonal balance, thematic complementarity. Reply with ONLY the UUID.`}
          ]}]})
      });
      const data = await res.json();
      const match = (data.content?.[0]?.text||"").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) setSuggestion({forId:img.id,suggestedId:match[0]});
    } catch {}
    setSuggesting(null);
  };

  const upd = (pid,k,f,v) => {
    setPairs(p=>p.map(x=>x.id===pid?{...x,[k]:{...x[k],[f]:v}}:x));
    dbUpdatePair(pid, { [`${f}_${k}`]: v }).catch(err => console.error("Failed to update pair:", err));
  };
  const del = pid => {
    setPairs(p=>p.filter(x=>x.id!==pid));
    dbDeletePair(pid).catch(err => console.error("Failed to delete pair:", err));
  };
  const accept = pid => {
    setPairs(p=>p.map(x=>x.id===pid?{...x,type:"confirmed"}:x));
    dbUpdatePair(pid, { type: "confirmed" }).catch(err => console.error("Failed to update pair:", err));
  };
  const getImg = id => images.find(i=>i.id===id);
  const confirmedPairs = pairs.filter(p=>p.type==="confirmed");
  const proposals = pairs.filter(p=>p.type==="proposal");

  return (
    <div style={{display:"flex",height:"calc(100vh - 50px)",overflow:"hidden"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",borderRight:"1px solid var(--bd)",overflow:"hidden"}}>
        <div style={{padding:"7px 13px",borderBottom:"1px solid var(--bd)",display:"flex",gap:5,flexWrap:"wrap",flexShrink:0,alignItems:"center",background:"var(--sf2)"}}>
          <button className={`pl ${poolMode==="unpaired"?"on":""}`} onClick={()=>{setPoolMode("unpaired");setPairingA(null);setSuggestion(null);}}>unpaired ({unpairedPool.length})</button>
          <button className={`pl ${poolMode==="all"?"em":""}`} onClick={()=>{setPoolMode("all");setPairingA(null);setSuggestion(null);}}>all bookmarked ({sortedColl.length})</button>
          {poolMode==="all"&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)"}}>→ proposals</span>}
          <div style={{width:1,height:14,background:"var(--bd)",margin:"0 2px"}}/>
          <button className={`pl ${!catFilter?"on":""}`} onClick={()=>setCatFilter(null)}>all</button>
          {CATEGORIES.filter(c=>pool.some(i=>categories[i.id]===c)).map(c=>(
            <button key={c} className={`pl ${catFilter===c?"on":""}`} onClick={()=>setCatFilter(c)} style={{textTransform:"capitalize"}}>{c} <span style={{opacity:.4}}>{pool.filter(i=>categories[i.id]===c).length}</span></button>
          ))}
        </div>
        {pairingA&&(
          <div style={{padding:"6px 13px",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"var(--sf3)"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)"}}>@{images.find(i=>i.id===pairingA.id)?.user_name} selected · click another to {poolMode==="all"?"propose":"pair"}</span>
            <button onClick={()=>setPairingA(null)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:15}}>×</button>
          </div>
        )}
        {(suggestion||suggesting)&&(
          <div style={{padding:"5px 13px",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"var(--sf3)"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)"}}>{suggesting?"✦ finding best pair…":"✦ suggestion highlighted · click to pair"}</span>
            {suggestion&&<button onClick={()=>setSuggestion(null)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:15}}>×</button>}
          </div>
        )}
        <div style={{flex:1,overflowY:"auto",padding:"12px 13px"}}>
          <MGrid images={filteredPool} showSel showVotes selId={pairingA?.id} onSel={handleSel} categories={categories} voteCount={voteCount} onSuggest={!suggesting?suggestPair:null} suggestion={suggestion?.suggestedId}/>
          {!filteredPool.length&&<div style={{color:"var(--tx3)",fontSize:11,textAlign:"center",paddingTop:50,fontFamily:"'DM Mono',monospace"}}>no images{catFilter?" in this category":""}</div>}
        </div>
      </div>
      <div style={{width:400,overflowY:"auto",padding:"13px 13px 40px",flexShrink:0}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",letterSpacing:".1em",marginBottom:12}}>CONFIRMED · {confirmedPairs.length}</div>
        {!confirmedPairs.length&&<div style={{color:"var(--tx3)",fontSize:11,textAlign:"center",paddingTop:16,marginBottom:20}}>select from unpaired pool to pair</div>}
        {confirmedPairs.map((pair,i)=><PairCard key={pair.id} pair={pair} i={i} getImg={getImg} upd={upd} del={del} categories={categories}/>)}
        {proposals.length>0&&(
          <>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",letterSpacing:".1em",margin:"20px 0 10px"}}>PROPOSALS · {proposals.length}</div>
            {proposals.map((pair,i)=>(
              <div key={pair.id} style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:COLORS[pair.creator]||"var(--tx3)"}}/>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx2)"}}>{pair.creator} suggests</span>
                  <div style={{flex:1}}/>
                  <button className="ab" style={{padding:"3px 10px",fontSize:9}} onClick={()=>accept(pair.id)}>accept</button>
                  <button className="pl" style={{padding:"3px 8px"}} onClick={()=>del(pair.id)}>dismiss</button>
                </div>
                <PairCard pair={pair} i={i} getImg={getImg} upd={upd} del={null} categories={categories} dim/>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function PairCard({ pair, i, getImg, upd, del, categories, dim }) {
  const iA=getImg(pair.a.id), iB=getImg(pair.b.id);
  if (!iA||!iB) return null;
  const ss = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx2)", fontSize:10, fontFamily:"'DM Mono',monospace", padding:"2px 4px", outline:"none", cursor:"pointer" };
  return (
    <div className="pc" style={{opacity:dim?.8:1}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)"}}>PAIR {i+1}</span>
        {categories[pair.a.id]&&<span style={{fontSize:8,color:"var(--tx2)",textTransform:"capitalize"}}>{categories[pair.a.id]}</span>}
        <div style={{flex:1}}/>
        {del&&<button onClick={()=>del(pair.id)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:15,lineHeight:1,padding:0}}>×</button>}
      </div>
      <div style={{display:"flex",gap:7}}>
        {[["a",iA],["b",iB]].map(([k,img])=>(
          <div key={k} style={{flex:1}}>
            <div style={{position:"relative",paddingBottom:aspectPad(img.aspect),background:"var(--sf2)",marginBottom:5,overflow:"hidden"}}>
              <img src={imgUrl(img)} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} loading="lazy"/>
            </div>
            <div style={{display:"flex",gap:3}}>
              <select value={pair[k].side} onChange={e=>upd(pair.id,k,"side",e.target.value)} style={ss}><option value="L">L</option><option value="R">R</option></select>
              <select value={pair[k].size} onChange={e=>upd(pair.id,k,"size",e.target.value)} style={{...ss,flex:1,fontSize:8}}>{SIZES.map(s=><option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EXPORT TAB ─────────────────────────────────────────────────
function ExportTab({ pairs, images, categories, votes, bookmarks, refTypes }) {
  const getImg = id => images.find(i=>i.id===id);
  const vc = id => Object.values(votes).filter(s=>s.has(id)).length;

  const allBm = new Set(Object.values(bookmarks).flatMap(s=>[...s]));

  const fmtImg = (img) => ({
    id: img.id,
    username: img.user_name,
    prompt: img.prompt,
    category: categories[img.id] || null,
    mjUrl: `https://www.midjourney.com/jobs/${img.id}?index=0`,
    votes: vc(img.id),
    votedBy: Object.entries(votes).filter(([,s])=>s.has(img.id)).map(([n])=>n),
    bookmarkedBy: Object.entries(bookmarks).filter(([,s])=>s.has(img.id)).map(([n])=>n),
  });

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  };

  const bookmarkedImages = [...allBm].map(id=>getImg(id)).filter(Boolean).map(fmtImg)
    .sort((a,b)=>b.votes-a.votes);
  const votedImages = bookmarkedImages.filter(i=>i.votes>0);

  const data = pairs.map((p,i)=>{
    const fmt = (img,side,size) => img ? {
      id:img.id, username:img.user_name,
      cleanedPrompt:cleanPrompt(img.prompt,refTypes[img.id]),
      rawPrompt:img.prompt,
      category:categories[img.id],
      referenceTypes:refTypes[img.id]||[],
      hasImageRefs:hasRefs(img.prompt),
      mjUrl:`https://www.midjourney.com/jobs/${img.id}?index=0`,
      side, size, votes:vc(img.id)
    } : null;
    const iA=getImg(p.a.id), iB=getImg(p.b.id);
    return { pair:i+1, imageA:fmt(iA,p.a.side,p.a.size), imageB:fmt(iB,p.b.side,p.b.size) };
  });

  return (
    <div style={{padding:"28px",maxWidth:860}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",letterSpacing:".12em",marginBottom:22}}>EXPORT</div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:10,padding:"16px 18px",background:"var(--sf)",border:"1px solid var(--bd)"}}>
        <button className="ab" onClick={()=>downloadJson(bookmarkedImages,"oscar-issue-38-bookmarks.json")} disabled={!allBm.size}>Download bookmarks JSON</button>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx2)"}}>{allBm.size} bookmarked images</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginTop:3}}>all bookmarks · vote counts · who voted · category · mj links</div>
        </div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:10,padding:"16px 18px",background:"var(--sf)",border:"1px solid var(--bd)"}}>
        <button className="ab" onClick={()=>downloadJson(votedImages,"oscar-issue-38-voted.json")} disabled={!votedImages.length}>Download voted JSON</button>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx2)"}}>{votedImages.length} images with votes · sorted by vote count</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginTop:3}}>vote counts · who voted · category · mj links</div>
        </div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:10,padding:"16px 18px",background:"var(--sf)",border:"1px solid var(--bd)"}}>
        <button className="ab" onClick={()=>downloadJson(data,"oscar-issue-38-pairs.json")} disabled={!pairs.length}>Download pairs JSON</button>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx2)"}}>{pairs.length} confirmed pairs · {pairs.length*2} images</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginTop:3}}>cleaned prompts · ref types · categories · L/R · size · mj links</div>
        </div>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginBottom:14,letterSpacing:".08em"}}>PHASE 2: JPEG BATCH EXPORT · QR CODES · INDESIGN HANDOFF</div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {data.slice(0,8).map(p=>(
          <div key={p.pair} style={{display:"flex",gap:12,padding:"10px 14px",background:"var(--sf)",border:"1px solid var(--bd)",alignItems:"flex-start"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",minWidth:44,paddingTop:2}}>pair {p.pair}</span>
            {[p.imageA,p.imageB].map((img,idx)=>img&&(
              <div key={idx} style={{flex:1}}>
                <div style={{fontSize:9,color:"var(--tx)",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",marginBottom:2}}>{img.side} · {img.size}</div>
                <div style={{fontSize:9,color:"var(--tx2)",fontFamily:"'DM Mono',monospace"}}>@{img.username}</div>
                <div style={{fontSize:8,color:"var(--tx3)",marginTop:1,textTransform:"capitalize"}}>{img.category||"—"}</div>
                {img.referenceTypes.length>0&&<div style={{fontSize:8,color:"var(--tx2)",marginTop:1}}>{img.referenceTypes.join(", ")}</div>}
              </div>
            ))}
          </div>
        ))}
        {data.length>8&&<div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",textAlign:"center",padding:"4px 0"}}>+ {data.length-8} more pairs</div>}
        {!data.length&&<div style={{fontSize:11,color:"var(--tx3)",textAlign:"center",padding:"40px 0"}}>create confirmed pairs first</div>}
      </div>
    </div>
  );
}
