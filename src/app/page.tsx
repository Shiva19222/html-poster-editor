"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";

type ElementType = "text" | "image";

type BaseEl = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  styles?: React.CSSProperties;
};

type TextEl = BaseEl & { type: "text"; content: string };
type ImageEl = BaseEl & { type: "image"; src: string; alt?: string };
type EditorEl = TextEl | ImageEl;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function Page() {
  // Elements and selection
  const [elements, setElements] = useState<EditorEl[]>([
    { id: uid(), type: "text", x: 40, y: 40, content: "Summer Sale", styles: { fontSize: 36, fontWeight: 700, color: "#111" } },
    { id: uid(), type: "text", x: 40, y: 100, content: "Up to 50% off on select items!", styles: { fontSize: 20, color: "#444" } },
    { id: uid(), type: "image", x: 420, y: 60, width: 240, height: 240, src: "https://placehold.co/240x240/png", alt: "placeholder", styles: { borderRadius: 8 } },
  ]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const selectionSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const primary = useMemo(() => elements.find(e => e.id === primaryId) || null, [elements, primaryId]);

  // Stage interaction
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const [vGuides, setVGuides] = useState<number[]>([]);
  const [hGuides, setHGuides] = useState<number[]>([]);

  // Undo/redo
  type Snapshot = { elements: EditorEl[]; selectedIds: string[]; primaryId: string | null };
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  function pushHistory(nextEls: EditorEl[], nextSel: string[] = selectedIds, nextPrimary: string | null = primaryId) {
    setPast(p => [...p, { elements, selectedIds, primaryId }]);
    setFuture([]);
    setElements(nextEls);
    setSelectedIds(nextSel);
    setPrimaryId(nextPrimary);
  }
  function undo() {
    setPast(p => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture(f => [{ elements, selectedIds, primaryId }, ...f]);
      setElements(prev.elements);
      setSelectedIds(prev.selectedIds);
      setPrimaryId(prev.primaryId);
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture(f => {
      if (!f.length) return f;
      const nxt = f[0];
      setPast(p => [...p, { elements, selectedIds, primaryId }]);
      setElements(nxt.elements);
      setSelectedIds(nxt.selectedIds);
      setPrimaryId(nxt.primaryId);
      return f.slice(1);
    });
  }

  // Selection
  function selectOnClick(ev: React.MouseEvent, id: string) {
    if (ev.ctrlKey || ev.metaKey) {
      setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
      setPrimaryId(id);
    } else {
      setSelectedIds([id]);
      setPrimaryId(id);
    }
  }

  // Add/remove/update
  function addText() {
    const t: TextEl = { id: uid(), type: "text", x: 60, y: 60, content: "New Text", styles: { fontSize: 18, color: "#111" } };
    pushHistory([...elements, t], [t.id], t.id);
  }
  function addImage() {
    const img: ImageEl = { id: uid(), type: "image", x: 80, y: 80, width: 160, height: 160, src: "https://placehold.co/160x160/png", alt: "image" };
    pushHistory([...elements, img], [img.id], img.id);
  }
  function removeSelected() {
    if (!selectedIds.length) return;
    if (!confirm("Delete selected element(s)?")) return;
    const next = elements.filter(e => !selectionSet.has(e.id));
    pushHistory(next, [], null);
  }
  function updatePrimary(patch: Partial<EditorEl>) {
    if (!primaryId) return;
    const next = elements.map(e => (e.id === primaryId ? ({ ...(e as any), ...(patch as any) } as EditorEl) : e));
    pushHistory(next, selectedIds, primaryId);
  }

  // Drag move with snapping
  function handlePointerDown(e: React.PointerEvent, el: EditorEl) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setIsDragging(true);
    if (!selectionSet.has(el.id)) setSelectedIds([el.id]);
    setPrimaryId(el.id);
    dragOffset.current = { dx: (e.clientX - rect.left) / zoom, dy: (e.clientY - rect.top) / zoom };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent, el: EditorEl) {
    if (!isDragging || primaryId !== el.id) return;
    const stage = document.getElementById("stage"); if (!stage) return;
    const s = stage.getBoundingClientRect();
    const localX = (e.clientX - s.left - pan.x) / zoom;
    const localY = (e.clientY - s.top - pan.y) / zoom;
    let nx = localX - dragOffset.current.dx;
    let ny = localY - dragOffset.current.dy;
    if (!e.shiftKey) { const g = 10; nx = Math.round(nx / g) * g; ny = Math.round(ny / g) * g; }
    const elW = el.width || 0, elH = el.height || 0;
    const thr = 5; const vg: number[] = [], hg: number[] = [];
    // Stage center
    const cx = nx + elW / 2, cy = ny + elH / 2;
    if (Math.abs(cx - 360) <= thr) { nx = 360 - elW / 2; vg.push(360); }
    if (Math.abs(cy - 360) <= thr) { ny = 360 - elH / 2; hg.push(360); }
    // Other elements
    for (const o of elements) {
      if (o.id === el.id) continue;
      const oW = o.width || 0, oH = o.height || 0;
      const exs = [o.x, o.x + oW, o.x + oW / 2];
      const eys = [o.y, o.y + oH, o.y + oH / 2];
      const mxs = [nx, nx + elW, nx + elW / 2];
      const mys = [ny, ny + elH, ny + elH / 2];
      for (const ex of exs) for (const mx of mxs) if (Math.abs(mx - ex) <= thr) { nx += ex - mx; vg.push(ex); }
      for (const ey of eys) for (const my of mys) if (Math.abs(my - ey) <= thr) { ny += ey - my; hg.push(ey); }
    }
    setVGuides(vg.slice(0, 3)); setHGuides(hg.slice(0, 3));
    const fx = Math.max(0, Math.min(720 - elW, nx));
    const fy = Math.max(0, Math.min(720 - elH, ny));
    if (selectedIds.length > 1) {
      const dx = fx - el.x, dy = fy - el.y;
      setElements(prev => prev.map(x => selectionSet.has(x.id)
        ? { ...x, x: Math.max(0, Math.min(720 - (x.width || 0), x.x + dx)), y: Math.max(0, Math.min(720 - (x.height || 0), x.y + dy)) }
        : x));
    } else {
      setElements(prev => prev.map(x => (x.id === el.id ? { ...x, x: fx, y: fy } : x)));
    }
  }
  function handlePointerUp() { setIsDragging(false); }

  // Pan & zoom
  function onStagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!panMode) return; isPanning.current = true; panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onStagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panMode || !isPanning.current || !panStart.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }
  function onStagePointerUp() { isPanning.current = false; panStart.current = null; }
  function onWheel(e: React.WheelEvent<HTMLDivElement>) { e.preventDefault(); const f = -e.deltaY > 0 ? 1.1 : 0.9; setZoom(z => Math.min(4, Math.max(0.25, z * f))); }

  // Properties
  function onChangeTextContent(v: string) { if (primary && primary.type === "text") updatePrimary({ content: v } as Partial<TextEl>); }
  function onImagePropChange(key: "src" | "alt" | "width" | "height", v: string) {
    if (primary && primary.type === "image") {
      if (key === "width" || key === "height") updatePrimary({ [key]: parseInt(v || "0", 10) || undefined } as any);
      else updatePrimary({ [key]: v } as any);
    }
  }

  // Export
  function exportHTML() {
    const doc = document.implementation.createHTMLDocument("Poster");
    const meta = doc.createElement("meta"); meta.setAttribute("name", "generator"); meta.setAttribute("content", "HTML Poster Editor"); doc.head.appendChild(meta);
    const style = doc.createElement("style"); style.textContent = `*{box-sizing:border-box}body{margin:0}#stage{position:relative;width:720px;height:720px;overflow:hidden;border:1px solid #e5e7eb}`; doc.head.appendChild(style);
    const stage = doc.createElement("div"); stage.id = "stage";
    elements.forEach(el => {
      const node = doc.createElement("div"); node.style.position = "absolute"; node.style.left = `${el.x}px`; node.style.top = `${el.y}px`;
      if (el.width) node.style.width = `${el.width}px`; if (el.height) node.style.height = `${el.height}px`;
      if (el.type === "text") node.textContent = (el as TextEl).content;
      if (el.type === "image") { const img = doc.createElement("img"); const i = el as ImageEl; img.src = i.src; if (i.alt) img.alt = i.alt; if (el.width) img.width = el.width; if (el.height) img.height = el.height; img.style.display = "block"; node.appendChild(img); }
      if (el.styles) Object.assign(node.style, el.styles as any);
      stage.appendChild(node);
    });
    doc.body.appendChild(stage);
    const blob = new Blob(["<!DOCTYPE html>\n" + doc.documentElement.outerHTML], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "poster.html"; a.click(); URL.revokeObjectURL(url);
  }

  // Import (sanitized) using offscreen measurement
  function importFromCleanHTML(clean: string) {
    const host = document.createElement("div"); host.style.position = "fixed"; host.style.left = "-99999px"; host.style.top = "-99999px"; host.style.width = "720px"; host.style.height = "720px"; host.style.overflow = "hidden"; host.innerHTML = clean; document.body.appendChild(host);
    const stageEl = (host.querySelector("#stage") as HTMLElement) || host; const base = stageEl.getBoundingClientRect();
    const imported: EditorEl[] = [];
    stageEl.querySelectorAll("*").forEach(n => {
      const el = n as HTMLElement; const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(720, Math.round(r.left - base.left))); const y = Math.max(0, Math.min(720, Math.round(r.top - base.top)));
      const w = Math.round(r.width) || undefined; const h = Math.round(r.height) || undefined;
      if (el.tagName.toLowerCase() === "img" && (el as HTMLImageElement).src) imported.push({ id: uid(), type: "image", x, y, width: w, height: h, src: (el as HTMLImageElement).src, alt: (el as HTMLImageElement).alt });
      else if (el.children.length === 0 && el.textContent && el.textContent.trim()) imported.push({ id: uid(), type: "text", x, y, content: el.textContent.trim(), styles: { color: getComputedStyle(el).color, fontSize: parseInt(getComputedStyle(el).fontSize) } });
    });
    document.body.removeChild(host);
    if (imported.length) pushHistory(imported, [], null);
  }
  function importFromFile(file: File) {
    const reader = new FileReader(); reader.onload = () => { const raw = String(reader.result || ""); const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: ["div","span","p","h1","h2","h3","h4","h5","h6","img","strong","em","b","i","u","br"], ALLOWED_ATTR: ["style","src","alt","width","height"] }); importFromCleanHTML(clean); }; reader.readAsText(file);
  }
  function importFromPasted(raw: string) { const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: ["div","span","p","h1","h2","h3","h4","h5","h6","img","strong","em","b","i","u","br"], ALLOWED_ATTR: ["style","src","alt","width","height"] }); importFromCleanHTML(clean); }

  // Persistence
  const STORAGE_KEY = "html-poster-editor:v1";
  function saveProject() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements })); } catch {} }
  function loadProject() { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; const parsed = JSON.parse(raw) as { elements: EditorEl[] }; if (parsed?.elements?.length) pushHistory(parsed.elements, [], null); } catch {} }
  function clearProject() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" && selectedIds.length) { e.preventDefault(); removeSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedIds.length) {
        e.preventDefault(); const adds: EditorEl[] = [];
        for (const el of elements) if (selectionSet.has(el.id)) adds.push({ ...(el as any), id: uid(), x: el.x + 10, y: el.y + 10 } as EditorEl);
        pushHistory([...elements, ...adds], adds.map(a => a.id), adds.length ? adds[0].id : primaryId);
      }
    }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [elements, selectedIds, primaryId]);

  // UI Modal state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteHtml, setPasteHtml] = useState("");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-2">
          <span className="font-semibold">HTML Poster Editor</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={() => setZoom(z => Math.max(0.25, z * 0.9))}>-</button>
              <span className="text-xs w-16 text-center">{Math.round(zoom * 100)}%</span>
              <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={() => setZoom(z => Math.min(4, z * 1.1))}>+</button>
              <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
              <button className={`text-sm px-2 py-1 border rounded ${panMode ? "bg-blue-600 text-white" : "bg-gray-50 hover:bg-gray-100"}`} onClick={() => setPanMode(v => !v)}>Pan</button>
            </div>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={() => setShowPasteModal(true)}>Paste HTML</button>
            <label className="text-sm px-2 py-1 border rounded cursor-pointer bg-gray-50 hover:bg-gray-100">
              Import HTML
              <input type="file" accept=".html,text/html" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFromFile(f); }} />
            </label>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={addText}>Add Text</button>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={addImage}>Add Image</button>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={removeSelected} disabled={!selectedIds.length}>Delete</button>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={saveProject}>Save</button>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={loadProject}>Load</button>
            <button className="text-sm px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100" onClick={clearProject}>Clear</button>
            <button className="text-sm px-2 py-1 border rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={exportHTML}>Export</button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 grid grid-cols-12 gap-4">
        {/* Element tree */}
        <aside className="col-span-2">
          <div className="border rounded bg-white p-3 space-y-2">
            <div className="font-medium">Elements</div>
            <div className="max-h-[640px] overflow-auto text-sm">
              {elements.map(el => (
                <div key={el.id} className={`px-2 py-1 rounded cursor-pointer ${selectionSet.has(el.id) ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`} onClick={(ev) => selectOnClick(ev, el.id)}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{el.type}</span>
                    <span className="text-[11px] text-gray-500">{Math.round(el.x)},{Math.round(el.y)}</span>
                  </div>
                  {el.type === "text" && <div className="truncate text-xs text-gray-600">{(el as TextEl).content}</div>}
                  {el.type === "image" && <div className="truncate text-xs text-gray-600">{(el as ImageEl).src}</div>}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="col-span-7">
          <div className="border rounded bg-white p-4 flex justify-center">
            <div id="stage" className="relative bg-white border shadow-sm" style={{ width: 720, height: 720, overflow: "hidden" }} onPointerUp={() => { handlePointerUp(); onStagePointerUp(); }} onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onWheel={onWheel}>
              <div style={{ width: 720, height: 720, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "relative" }}>
                {vGuides.map((x, i) => (<div key={`vg-${i}`} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 1, background: "#60a5fa" }} />))}
                {hGuides.map((y, i) => (<div key={`hg-${i}`} style={{ position: "absolute", top: y, left: 0, right: 0, height: 1, background: "#60a5fa" }} />))}
                {elements.map(el => {
                  const isSel = selectionSet.has(el.id);
                  const common: React.CSSProperties = { position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height, cursor: isDragging && isSel ? "grabbing" : "grab", outline: isSel ? "2px solid #3b82f6" : "none", borderRadius: 4, padding: el.type === "text" ? 2 : 0 };
                  if (el.type === "text") return (
                    <div key={el.id} style={{ ...common, ...(el.styles || {}) }} onPointerDown={(e) => handlePointerDown(e, el)} onPointerMove={(e) => handlePointerMove(e, el)} onClick={(ev) => selectOnClick(ev, el.id)} contentEditable={isSel} suppressContentEditableWarning onInput={(e) => onChangeTextContent((e.target as HTMLElement).innerText)}>
                      {(el as TextEl).content}
                    </div>
                  );
                  return (
                    <div key={el.id} style={common} onPointerDown={(e) => handlePointerDown(e, el)} onPointerMove={(e) => handlePointerMove(e, el)} onClick={(ev) => selectOnClick(ev, el.id)}>
                      <img src={(el as ImageEl).src} alt={(el as ImageEl).alt || ""} style={{ display: "block", width: el.width || "auto", height: el.height || "auto", ...(el.styles || {}) }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="col-span-3">
          <div className="border rounded bg-white p-3 space-y-3">
            <div className="font-medium">Properties</div>
            {!primary && <div className="text-sm text-gray-500">Select an element to edit its properties.</div>}
            {primary && primary.type === "text" && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Font size</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="number" value={parseInt(String(primary.styles?.fontSize || 16))} onChange={(e) => updatePrimary({ styles: { ...(primary.styles || {}), fontSize: parseInt(e.target.value || "16", 10) } } as any)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Color</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="color" value={String(primary.styles?.color || "#111111")} onChange={(e) => updatePrimary({ styles: { ...(primary.styles || {}), color: e.target.value } } as any)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Weight</label>
                  <select className="col-span-2 border rounded px-2 py-1" value={String(primary.styles?.fontWeight || "400")} onChange={(e) => updatePrimary({ styles: { ...(primary.styles || {}), fontWeight: e.target.value as any } } as any)}>
                    <option value="400">Normal</option>
                    <option value="600">Semibold</option>
                    <option value="700">Bold</option>
                  </select>
                </div>
              </div>
            )}
            {primary && primary.type === "image" && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Src</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="text" value={(primary as ImageEl).src} onChange={(e) => onImagePropChange("src", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Alt</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="text" value={(primary as ImageEl).alt || ""} onChange={(e) => onImagePropChange("alt", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Width</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="number" value={primary.width || 0} onChange={(e) => onImagePropChange("width", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Height</label>
                  <input className="col-span-2 border rounded px-2 py-1" type="number" value={primary.height || 0} onChange={(e) => onImagePropChange("height", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <label>Replace</label>
                  <input className="col-span-2" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); onImagePropChange("src", url); }} />
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 h-10 text-xs text-gray-600 flex items-center gap-4">
          <span>Stage: 720×720</span>
          {primary && <span>Selected: {primary.type}</span>}
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </footer>

      {showPasteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4 space-y-3">
            <div className="font-medium">Paste HTML</div>
            <textarea className="w-full h-64 border rounded p-2 font-mono text-sm" placeholder="Paste sanitized HTML here (scripts will be stripped)" value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)} />
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setShowPasteModal(false)}>Cancel</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={() => { importFromPasted(pasteHtml); setShowPasteModal(false); setPasteHtml(""); }}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
