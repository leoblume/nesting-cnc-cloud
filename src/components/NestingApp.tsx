import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers, Lightbulb, Package } from "lucide-react";
import { HeaderActions } from "@/components/HeaderActions";

import { parsePdf, groupParts, type ParsedPart } from "@/lib/nesting/parser";
import { runNesting, type NestResult, type NestingOptions } from "@/lib/nesting/nesting";
import { renderSheet } from "@/lib/nesting/render";
import { detectOverlaps } from "@/lib/nesting/overlapCheck";

import { fetchLedModels, getCachedLedModels } from "@/lib/leds/ledModelsRepo";
import { calcLedPitch, calcLedsForPart, calcLedsForBbox, LED_DENSITY_DEFAULT, type LedModel, type LedAssignment, type LedMode } from "@/lib/leds/ledEngine";

import { NestingSidebar } from "@/components/nesting/NestingSidebar";
import { NestingMainView } from "@/components/nesting/NestingMainView";
import { LedCalculatorView } from "@/components/leds/LedCalculatorView";
import { LedCadView } from "@/components/leds/LedCadView";
import { BudgetSummaryDialog } from "@/components/leds/BudgetSummaryDialog";

export default function NestingApp() {
  // ── Parte 1: Nesting (arquivo, encaixe, chapas) ──────────────────────────
  const [fileName, setFileName] = useState("");
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [parts, setParts] = useState<ParsedPart[]>([]);
  const [groups, setGroups] = useState<ReturnType<typeof groupParts>>([]);
  const [parsing, setParsing] = useState(false);
  const [nesting, setNesting] = useState(false);
  const [nestProgress, setNestProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<NestResult | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"nesting" | "leds" | "ledcad">("nesting");
  const [showBudget, setShowBudget] = useState(false);
  const [opts, setOpts] = useState<NestingOptions>({ sheetWidth: 1210, sheetHeight: 2420, gap: 5, margin: 10, allowRotation: true, allowMirror: false, rotationStep: 90 });

  // ── Parte 2: LEDs (cadastro + cálculo de posicionamento) ────────────────
  const [ledModels, setLedModels] = useState<LedModel[]>(() => getCachedLedModels());
  const [ledModelsLoading, setLedModelsLoading] = useState(true);
  const [selectedLedId, setSelectedLedId] = useState<string | null>(() => {
    try { return localStorage.getItem("nestcnc_led_selected"); } catch { return null; }
  });
  const [ledAssignments, setLedAssignments] = useState<LedAssignment>({});
  const [renderedLedId, setRenderedLedId] = useState<string | null>(null);
  const [ledKey, setLedKey] = useState(0);
  const [ledMode, setLedMode] = useState<LedMode>("retroiluminada");
  const [ledDensity, setLedDensity] = useState<number>(LED_DENSITY_DEFAULT);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setOpt = <K extends keyof NestingOptions>(key: K, val: NestingOptions[K]) => setOpts((p) => ({ ...p, [key]: val }));

  const selectedLed = ledModels.find((l) => l.id === selectedLedId) ?? null;

  const assignLedToGroup = useCallback((groupKey: string, ledId: string) => {
    setLedAssignments((prev) => ({ ...prev, [groupKey]: ledId }));
    setLedKey((k) => k + 1);
  }, []);

  const clearGroupAssignment = useCallback((groupKey: string) => {
    setLedAssignments((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
    setLedKey((k) => k + 1);
  }, []);

  const handleUpdateLed = useCallback(() => {
    setLedKey((k) => k + 1);
    setRenderedLedId(selectedLedId);
  }, [selectedLedId]);

  const ledModelsKey = JSON.stringify(ledModels.map(l => `${l.id}:${l.width}x${l.height}`));
  useEffect(() => {
    setRenderedLedId(selectedLedId);
    setLedKey((k) => k + 1);
  }, [selectedLedId, ledModelsKey, ledMode, ledDensity]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Selecione um PDF."); e.target.value = ""; return; }
    try {
      const buffer = await file.arrayBuffer();
      setPdfBuffer(buffer); setFileName(file.name); setParts([]); setGroups([]); setResult(null); setParseError(null);
    } catch { alert("Não foi possível ler o arquivo."); } finally { e.target.value = ""; }
  };

  const onParse = async () => {
    if (!pdfBuffer || parsing) return;
    setParsing(true); setResult(null); setParseError(null);
    try {
      const p = await parsePdf(pdfBuffer);
      if (!p.length) { setParseError("Nenhuma geometria vetorial válida encontrada."); }
      else { setParts(p); setGroups(groupParts(p)); }
    } catch (e) { setParseError((e as Error).message); } finally { setParsing(false); }
  };

  const onNest = useCallback(async () => {
    if (!parts.length) return;
    setNesting(true);
    setNestProgress({ done: 0, total: parts.length });
    try {
      const r = await runNesting(parts, opts, (done, total) => setNestProgress({ done, total }));
      setResult(r);
      setActiveSheet(0);
    } finally {
      setNesting(false);
      setNestProgress(null);
    }
  }, [parts, opts]);

  useEffect(() => {
    let cancelled = false;
    setLedModelsLoading(true);
    fetchLedModels().then((models) => {
      if (!cancelled) { setLedModels(models); setLedModelsLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      if (selectedLedId) localStorage.setItem("nestcnc_led_selected", selectedLedId);
      else localStorage.removeItem("nestcnc_led_selected");
    } catch {}
  }, [selectedLedId]);

  const redraw = useCallback(() => {
    if (!result || !canvasRef.current || !containerRef.current) return;
    renderSheet(canvasRef.current, result.sheets[activeSheet] ?? [], opts.sheetWidth, opts.sheetHeight, opts.margin);
  }, [result, activeSheet, opts.sheetWidth, opts.sheetHeight, opts.margin]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    if (!result || !canvasRef.current || !containerRef.current) return;
    const obs = new ResizeObserver(redraw);
    obs.observe(containerRef.current!);
    return () => obs.disconnect();
  }, [redraw]);

  // Verificação de peças sobrepostas — roda sempre que um novo resultado sai do nesting
  const overlaps = useMemo(() => (result ? detectOverlaps(result.sheets) : []), [result]);

  const stats = useMemo(() => {
    if (!result) return null;
    const placed = result.sheets.reduce((s, sh) => s + sh.length, 0);
    const sheetArea = opts.sheetWidth * opts.sheetHeight;
    const perSheet = result.sheets.map((sh, i) => {
      const bboxUsed = sh.reduce((s, p) => s + p.bboxArea, 0);
      const polyUsed = sh.reduce((s, p) => s + p.area, 0);
      let maxX = opts.margin, maxY = opts.margin;
      for (const p of sh) { if (p.bbox.maxX > maxX) maxX = p.bbox.maxX; if (p.bbox.maxY > maxY) maxY = p.bbox.maxY; }
      const leftoverW = Math.max(0, opts.sheetWidth - maxX - opts.margin);
      const leftoverH = Math.max(0, opts.sheetHeight - 2 * opts.margin);
      return { index: i + 1, count: sh.length, bboxUtil: sheetArea > 0 ? bboxUsed / sheetArea : 0, polyUtil: sheetArea > 0 ? polyUsed / sheetArea : 0, bboxArea: bboxUsed, polyArea: polyUsed, wasteArea: sheetArea - bboxUsed, leftoverW, leftoverH };
    });
    return { placed, unplaced: result.unplaced.length, models: groups.length, total: parts.length, utilization: result.utilization, sheets: result.sheets.length, totalBboxArea: result.totalBboxArea, totalPartArea: result.totalPartArea, totalSheetArea: result.totalSheetArea, sheetArea, perSheet };
  }, [result, parts, groups, opts.sheetWidth, opts.sheetHeight, opts.margin]);

  const ledAssignmentsKey = JSON.stringify(ledAssignments);

  const ledSummary = useMemo(() => {
    if (!groups.length || !ledModels.length) return null;
    const hasAnyLed = groups.some((g) => {
      const id = ledAssignments[g.key] ?? selectedLedId;
      return !!id && ledModels.some((l) => l.id === id);
    });
    if (!hasAnyLed) return null;

    const rows = groups.map((g) => {
      const assignedId = ledAssignments[g.key] ?? selectedLedId;
      const ledModel = ledModels.find((l) => l.id === assignedId) ?? null;
      if (!ledModel) return { width: g.width, height: g.height, qty: g.quantity, ledsPerPiece: 0, totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, totalPower: 0, ledName: "–" };

      const poly = g.parts[0]?.outer ?? [];
      const holes = g.parts[0]?.holes ?? [];

      let ledsPerPiece = 0, pitch = 0, pitchX = 0, pitchY = 0;
      if (poly.length) {
        const r = calcLedsForPart(poly, holes, ledModel, ledMode, ledDensity);
        ledsPerPiece = r.totalLeds; pitch = r.pitch; pitchX = r.pitchX; pitchY = r.pitchY;
      } else {
        const r = calcLedsForBbox(g.width, g.height, ledModel, ledMode, ledDensity);
        ledsPerPiece = r.totalLeds; pitch = r.pitch; pitchX = r.pitchX; pitchY = r.pitchY;
      }

      const totalPower = ledsPerPiece * ledModel.power * g.quantity;
      return {
        width: g.width, height: g.height,
        qty: g.quantity,
        ledsPerPiece,
        totalLeds: ledsPerPiece * g.quantity,
        pitch, pitchX, pitchY,
        totalPower,
        ledName: ledModel.name,
      };
    });

    const totalLeds = rows.reduce((s, r) => s + r.totalLeds, 0);
    const totalPower = rows.reduce((s, r) => s + r.totalPower, 0);
    return { rows, totalLeds, totalPower };
  }, [groups, ledModels, selectedLedId, ledAssignmentsKey, ledKey, ledMode, ledDensity]);

  const currentSheetParts = result?.sheets[activeSheet] ?? [];
  const activeLedForDisplay = ledModels.find((l) => l.id === renderedLedId) ?? null;

  const computedPitch = selectedLed ? calcLedPitch(selectedLed, 0, ledDensity) : null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-6 sm:py-3">
        <button
          onClick={() => window.location.reload()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-80"
          title="Recarregar página"
        >
          <Layers className="h-5 w-5" />
        </button>
        <div className="min-w-0 hidden sm:block">
          <h1 className="text-base font-semibold tracking-tight truncate">NestCNC</h1>
          <p className="text-xs text-muted-foreground truncate">Aproveitamento automático de chapas</p>
        </div>
        <div className="ml-auto flex gap-1 rounded-lg border border-border p-1 order-3 sm:order-none sm:ml-4">
          <button onClick={() => setActiveTab("nesting")} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3 ${activeTab === "nesting" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nesting</span>
          </button>
          <button onClick={() => setActiveTab("leds")} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3 ${activeTab === "leds" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Lightbulb className="h-3.5 w-3.5" /> <span className="hidden sm:inline">LEDs</span>
          </button>
          <button onClick={() => setActiveTab("ledcad")} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3 ${activeTab === "ledcad" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Package className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cadastro LED</span>
          </button>
        </div>
        <HeaderActions
          result={result}
          opts={opts}
          fileName={fileName}
          overlaps={overlaps}
          activeSheet={activeSheet}
          groups={groups}
          ledModels={ledModels}
          selectedLedId={selectedLedId}
          ledAssignments={ledAssignments}
          ledMode={ledMode}
          ledDensity={ledDensity}
          onOpenBudget={() => setShowBudget(true)}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NestingSidebar
          fileName={fileName}
          onFileChange={onFileChange}
          onParse={onParse}
          parsing={parsing}
          pdfBuffer={pdfBuffer}
          parseError={parseError}
          parts={parts}
          groups={groups}
          opts={opts}
          setOpt={setOpt}
          result={result}
          activeSheet={activeSheet}
          overlaps={overlaps}
          stats={stats}
          nesting={nesting}
          onNest={onNest}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTab === "nesting" && (
            <NestingMainView
              containerRef={containerRef}
              canvasRef={canvasRef}
              result={result}
              parts={parts}
              activeSheet={activeSheet}
              setActiveSheet={setActiveSheet}
              currentSheetParts={currentSheetParts}
              nesting={nesting}
              nestProgress={nestProgress}
              groups={groups}
              stats={stats}
            />
          )}

          {activeTab === "leds" && (
            <LedCalculatorView
              groups={groups}
              ledModels={ledModels}
              computedPitch={computedPitch}
              selectedLedId={selectedLedId}
              setSelectedLedId={(id) => setSelectedLedId(id)}
              setRenderedLedId={setRenderedLedId}
              setLedKey={setLedKey}
              ledAssignments={ledAssignments}
              assignLedToGroup={assignLedToGroup}
              clearGroupAssignment={clearGroupAssignment}
              ledSummary={ledSummary}
              ledKey={ledKey}
              activeLedForDisplay={activeLedForDisplay}
              handleUpdateLed={handleUpdateLed}
              goToLedCad={() => setActiveTab("ledcad")}
              fileName={fileName}
              ledMode={ledMode}
              setLedMode={setLedMode}
              ledDensity={ledDensity}
              setLedDensity={setLedDensity}
            />
          )}

          {activeTab === "ledcad" && (
            <LedCadView
              ledModels={ledModels}
              setLedModels={setLedModels}
              ledModelsLoading={ledModelsLoading}
              selectedLedId={selectedLedId}
              setSelectedLedId={setSelectedLedId}
            />
          )}
        </div>
      </div>

      <BudgetSummaryDialog
        open={showBudget}
        onOpenChange={setShowBudget}
        stats={stats}
        opts={opts}
        groups={groups}
        ledSummary={ledSummary}
        fileName={fileName}
      />
    </div>
  );
}
