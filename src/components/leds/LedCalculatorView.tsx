import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Lightbulb, RefreshCw, Trash2, Zap, Sun, SunMedium, Gauge } from "lucide-react";
import { LedDrawingCanvas } from "./LedDrawingCanvas";
import { LED_DENSITY_MIN, LED_DENSITY_MAX, LED_DENSITY_DEFAULT, type LedModel, type LedAssignment, type LedMode } from "@/lib/leds/ledEngine";
import type { groupParts } from "@/lib/nesting/parser";

interface LedSummary {
  rows: { width: number; height: number; qty: number; ledsPerPiece: number; totalLeds: number; ledName: string }[];
  totalLeds: number;
  totalPower: number;
}

export function LedCalculatorView({
  groups, ledModels,
  computedPitch,
  selectedLedId, setSelectedLedId, setRenderedLedId, setLedKey,
  ledAssignments, assignLedToGroup, clearGroupAssignment,
  ledSummary,
  ledKey, activeLedForDisplay, handleUpdateLed,
  fileName,
  ledMode, setLedMode,
  ledDensity, setLedDensity,
}: {
  groups: ReturnType<typeof groupParts>;
  ledModels: LedModel[];
  computedPitch: { pitchX: number; pitchY: number } | null;
  selectedLedId: string | null;
  setSelectedLedId: (id: string) => void;
  setRenderedLedId: (id: string) => void;
  setLedKey: (fn: (k: number) => number) => void;
  ledAssignments: LedAssignment;
  assignLedToGroup: (groupKey: string, ledId: string) => void;
  clearGroupAssignment: (groupKey: string) => void;
  ledSummary: LedSummary | null;
  ledKey: number;
  activeLedForDisplay: LedModel | null;
  handleUpdateLed: () => void;
  fileName: string;
  ledMode: LedMode;
  setLedMode: (m: LedMode) => void;
  ledDensity: number;
  setLedDensity: (d: number) => void;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-yellow-500/20">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Calculadora de LEDs</h2>
            <p className="text-[10px] text-muted-foreground">Posicionamento automático por forma real — cálculo local no navegador</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de letra</Label>
          <div className="flex rounded-lg border border-border p-1 gap-1">
            <button
              onClick={() => setLedMode("retroiluminada")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                ledMode === "retroiluminada" ? "bg-yellow-500/20 text-yellow-300" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SunMedium className="h-3.5 w-3.5" /> Retroiluminada
            </button>
            <button
              onClick={() => setLedMode("backlight")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                ledMode === "backlight" ? "bg-yellow-500/20 text-yellow-300" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="h-3.5 w-3.5" /> Backlight
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/70">
            {ledMode === "retroiluminada"
              ? "LEDs seguem o perímetro externo da letra (ou a linha central, se for um canal fino vazado)."
              : "LEDs preenchem toda a área da letra (chapa translúcida difusora)."}
          </p>
        </div>

        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-semibold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="h-3 w-3" /> Densidade dos LEDs
            </Label>
            {computedPitch && (
              <div className="text-[10px] text-yellow-300 font-mono whitespace-nowrap">
                pitch → <strong>{computedPitch.pitchX.toFixed(1)} / {computedPitch.pitchY.toFixed(1)} mm</strong>
              </div>
            )}
          </div>
          <Slider
            min={LED_DENSITY_MIN}
            max={LED_DENSITY_MAX}
            step={0.05}
            value={[ledDensity]}
            onValueChange={([v]) => setLedDensity(v)}
          />
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
            <span>← mais espaço (menos LEDs)</span>
            <button
              onClick={() => setLedDensity(LED_DENSITY_DEFAULT)}
              className="underline decoration-dotted hover:text-yellow-300"
              title="Restaurar padrão"
            >
              padrão
            </button>
            <span>mais denso (mais LEDs) →</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">LED padrão</Label>
          {ledModels.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum LED no catálogo (src/lib/leds/ledCatalog.txt)</p>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedLedId ?? ""} onValueChange={(v) => { setSelectedLedId(v); setRenderedLedId(v); setLedKey((k) => k + 1); }}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Selecionar LED" /></SelectTrigger>
                <SelectContent>
                  {ledModels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.width}×{l.height}mm)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {ledModels.length > 1 && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1">
              <Zap className="h-3 w-3" /> LED por peça
            </p>
            <div className="flex flex-col gap-1.5">
              {groups.map((g) => {
                const assignedId = ledAssignments[g.key] ?? selectedLedId ?? "";
                return (
                  <div key={g.key} className="flex items-center gap-1.5">
                    <div className="text-[10px] text-muted-foreground w-24 shrink-0 font-mono truncate">
                      {g.width.toFixed(0)}×{g.height.toFixed(0)} ×{g.quantity}
                    </div>
                    <Select value={assignedId} onValueChange={(v) => assignLedToGroup(g.key, v)}>
                      <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue placeholder="padrão" /></SelectTrigger>
                      <SelectContent>
                        {ledModels.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ledAssignments[g.key] && (
                      <button onClick={() => clearGroupAssignment(g.key)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ledSummary && (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Total de LEDs</p>
              <p className="text-xl font-bold text-yellow-400">{ledSummary.totalLeds.toLocaleString("pt-BR")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">Potência</p>
                <p className="text-base font-bold text-orange-400">{ledSummary.totalPower.toFixed(1)} W</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">Pitch (X / Y)</p>
                <p className="text-base font-bold text-blue-400">
                  {computedPitch ? `${computedPitch.pitchX.toFixed(1)} / ${computedPitch.pitchY.toFixed(1)} mm` : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {ledSummary && (
          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Por Modelo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Dim (mm)</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Qtd</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">LEDs/pç</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ledSummary.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-2 py-1 font-mono">{row.width.toFixed(0)}×{row.height.toFixed(0)}</td>
                      <td className="px-2 py-1 text-right">{row.qty}</td>
                      <td className="px-2 py-1 text-right text-yellow-400 font-medium">{row.ledsPerPiece}</td>
                      <td className="px-2 py-1 text-right font-bold">{row.totalLeds}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-2 py-1.5 text-muted-foreground" colSpan={3}>TOTAL</td>
                    <td className="px-2 py-1.5 text-right text-yellow-400">{ledSummary.totalLeds.toLocaleString("pt-BR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!groups.length ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Importe e interprete um PDF para visualizar os LEDs.</p>
          </div>
        ) : ledModels.length === 0 ? (
          <div className="flex flex-1 items-center justify-center flex-col gap-2">
            <Zap className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum LED no catálogo.</p>
            <p className="text-xs text-muted-foreground/70">Adicione um modelo em src/lib/leds/ledCatalog.txt</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Desenho de Posicionamento
                </span>
              </div>
              <Button onClick={handleUpdateLed} variant="outline" size="sm" className="h-6 text-[10px] border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10">
                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <LedDrawingCanvas
                key={ledKey}
                groups={groups}
                ledModels={ledModels}
                selectedLedId={activeLedForDisplay?.id ?? selectedLedId}
                ledAssignments={ledAssignments}
                ledMode={ledMode}
                ledDensity={ledDensity}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
