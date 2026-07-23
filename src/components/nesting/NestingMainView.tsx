import { Loader2, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import type { NestResult } from "@/lib/nesting/nesting";
import type { groupParts } from "@/lib/nesting/parser";

interface Stats {
  total: number;
  models: number;
  placed: number;
  unplaced: number;
  utilization: number;
  sheets: number;
  perSheet: any[];
}

export function NestingMainView({
  containerRef, canvasRef,
  result, parts, activeSheet, setActiveSheet, currentSheetParts,
  nesting, nestProgress,
  groups, stats,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  result: NestResult | null;
  parts: unknown[];
  activeSheet: number;
  setActiveSheet: (fn: (s: number) => number) => void;
  currentSheetParts: unknown[];
  nesting: boolean;
  nestProgress: { done: number; total: number } | null;
  groups: ReturnType<typeof groupParts>;
  stats: Stats | null;
}) {
  return (
    <>
      <main ref={containerRef} className="relative flex flex-1 items-center justify-center bg-background overflow-hidden">
        {result ? (
          <canvas ref={canvasRef} className="block" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full border border-border p-4"><Layers className="h-8 w-8 text-muted-foreground/40" /></div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {parts.length > 0 ? "Clique em Calcular Nesting para visualizar as peças na chapa" : "Importe um PDF vetorial e clique em Interpretar PDF"}
            </p>
          </div>
        )}
        {result && result.sheets.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
            <button onClick={() => setActiveSheet((s) => Math.max(0, s - 1))} disabled={activeSheet === 0} className="disabled:opacity-30 hover:text-primary"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs font-medium">
              Chapa {activeSheet + 1} / {result.sheets.length}
              <span className="ml-2 text-muted-foreground">({currentSheetParts.length} peça{currentSheetParts.length !== 1 ? "s" : ""})</span>
            </span>
            <button onClick={() => setActiveSheet((s) => Math.min(result.sheets.length - 1, s + 1))} disabled={activeSheet === result.sheets.length - 1} className="disabled:opacity-30 hover:text-primary"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </main>

      {nesting && (
        <div className="border-t border-border bg-background px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculando nesting…
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {nestProgress ? `${nestProgress.done}/${nestProgress.total} peças · ${nestProgress.total ? Math.round((nestProgress.done / nestProgress.total) * 100) : 0}%` : "…"}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
              style={{ width: `${nestProgress && nestProgress.total ? Math.max(4, (nestProgress.done / nestProgress.total) * 100) : 4}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 border-t border-border">
        <div className="border-r border-border p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peças Detectadas</h3>
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma peça detectada ainda.</p>
          ) : (
            <div className="space-y-1 text-xs max-h-28 overflow-y-auto pr-1">
              {groups.map((g, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{g.width.toFixed(0)} × {g.height.toFixed(0)} mm</span>
                  <span className="font-medium">× {g.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relatório Técnico</h3>
          {!stats ? (
            <p className="text-xs text-muted-foreground">Execute o nesting para gerar o relatório.</p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Chapas usadas</span><span>{stats.sheets}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peças posicionadas</span><span>{stats.placed}/{stats.total}</span></div>
              {stats.unplaced > 0 && <div className="flex justify-between text-destructive"><span>Sem posição</span><span>{stats.unplaced}</span></div>}
              <div className="border-t border-border pt-2 mt-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Aproveitamento (retangular)</p>
                <div className="flex justify-between font-bold text-green-400"><span className="text-muted-foreground font-normal">Geral</span><span>{(stats.utilization * 100).toFixed(1)}%</span></div>
                {stats.perSheet.map((s: any) => (
                  <div key={s.index} className="flex justify-between text-muted-foreground">
                    <span>Chapa {s.index} ({s.count} pç)</span>
                    <span className={s.bboxUtil >= 0.7 ? "text-green-400" : s.bboxUtil >= 0.5 ? "text-yellow-400" : "text-red-400"}>{(s.bboxUtil * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Sobra útil por chapa</p>
                {stats.perSheet.map((s: any) => (
                  <div key={s.index} className="flex justify-between">
                    <span className="text-muted-foreground">Chapa {s.index}</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {s.leftoverW.toFixed(0)} × {s.leftoverH.toFixed(0)} mm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
