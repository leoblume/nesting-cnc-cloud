import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Upload, AlertCircle, CheckCircle2, Play,
} from "lucide-react";
import { NumericField } from "@/components/common/NumericField";
import type { NestingOptions, NestResult } from "@/lib/nesting/nesting";
import type { ParsedPart } from "@/lib/nesting/parser";
import type { groupParts } from "@/lib/nesting/parser";
import type { OverlapPair } from "@/lib/nesting/overlapCheck";

interface Stats {
  placed: number;
  unplaced: number;
  models: number;
  total: number;
  utilization: number;
  sheets: number;
  perSheet: any[];
}

export function NestingSidebar({
  fileName, onFileChange, onParse, parsing, pdfBuffer, parseError, parts, groups,
  opts, setOpt,
  result, activeSheet, overlaps,
  stats,
  nesting, onNest,
}: {
  fileName: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onParse: () => void;
  parsing: boolean;
  pdfBuffer: ArrayBuffer | null;
  parseError: string | null;
  parts: ParsedPart[];
  groups: ReturnType<typeof groupParts>;
  opts: NestingOptions;
  setOpt: <K extends keyof NestingOptions>(key: K, val: NestingOptions[K]) => void;
  result: NestResult | null;
  activeSheet: number;
  overlaps: OverlapPair[];
  stats: Stats | null;
  nesting: boolean;
  onNest: () => void;
}) {
  return (
    <aside className="flex w-72 flex-col gap-1.5 overflow-y-auto border-r border-border bg-card p-2 text-[13px]">
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PDF Vetorial</h2>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-background p-2 text-center transition-colors hover:border-primary/50">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{fileName || "Clique ou arraste um PDF"}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
        </label>
        <Button onClick={onParse} disabled={!pdfBuffer || parsing} size="sm" className="mt-1.5 w-full">
          {parsing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Interpretar PDF
        </Button>
        {parseError && (
          <div className="mt-1 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div><p className="font-medium">Erro ao interpretar</p>{parseError.split("\n").map((l, i) => <p key={i} className="mt-0.5">{l}</p>)}</div>
          </div>
        )}
        {parts.length > 0 && !parseError && (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-1 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{parts.length} peça{parts.length !== 1 ? "s" : ""} ({groups.length} modelo{groups.length !== 1 ? "s" : ""})</span>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chapa</h2>
        <div className="grid grid-cols-2 gap-1.5">
          <NumericField label="Largura" unit="mm" value={opts.sheetWidth} onChange={(v) => setOpt("sheetWidth", v)} min={1} />
          <NumericField label="Altura" unit="mm" value={opts.sheetHeight} onChange={(v) => setOpt("sheetHeight", v)} min={1} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Processo</h2>
        <div className="grid grid-cols-2 gap-1.5">
          <NumericField label="Folga" unit="mm" value={opts.gap} onChange={(v) => setOpt("gap", v)} />
          <NumericField label="Margem" unit="mm" value={opts.margin} onChange={(v) => setOpt("margin", v)} />
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between"><Label className="text-xs">Permitir rotação</Label><Switch checked={opts.allowRotation} onCheckedChange={(v) => setOpt("allowRotation", v)} /></div>
          {opts.allowRotation && (
            <div className="flex flex-col gap-0.5 pl-0.5">
              <Label className="text-xs text-muted-foreground">Precisão de rotação</Label>
              <Select value={String(opts.rotationStep ?? 90)} onValueChange={(v) => setOpt("rotationStep", Number(v))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90° (rápido — padrão)</SelectItem>
                  <SelectItem value="45">45°</SelectItem>
                  <SelectItem value="30">30°</SelectItem>
                  <SelectItem value="15">15° (mais preciso)</SelectItem>
                  <SelectItem value="5">5° (lento, encaixe fino)</SelectItem>
                  <SelectItem value="1">1° (muito lento)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[9px] leading-tight text-muted-foreground/60">Ângulos menores testam mais posições e reduzem sobreposição/folga, mas o cálculo demora mais.</p>
            </div>
          )}
          <div className="flex items-center justify-between"><Label className="text-xs">Permitir espelhamento</Label><Switch checked={opts.allowMirror} onCheckedChange={(v) => setOpt("allowMirror", v)} /></div>
        </div>
        <p className="mt-1 text-[9px] leading-tight text-muted-foreground/60">Estratégia de encaixe: sempre maior aproveitamento de chapa.</p>
      </section>

      <Button onClick={onNest} disabled={!parts.length || nesting} size="sm" className="w-full">
        {nesting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />} Calcular Nesting
      </Button>

      {result && overlaps.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{overlaps.length} peça(s) sobreposta(s) detectada(s)!</span>
        </div>
      )}

      {stats && (
        <div className="rounded-md border border-border bg-background p-2 text-xs leading-tight space-y-0.5">
          <div className="flex justify-between"><span className="text-muted-foreground">Peças total</span><span>{stats.total}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Modelos</span><span>{stats.models}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Posicionadas</span><span>{stats.placed}</span></div>
          {stats.unplaced > 0 && <div className="flex justify-between text-destructive"><span>Não posicionadas</span><span>{stats.unplaced}</span></div>}
          <div className="flex justify-between font-medium"><span className="text-muted-foreground">Aproveit. retangular</span><span className="text-green-400">{(stats.utilization * 100).toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Chapas</span><span>{stats.sheets}</span></div>
        </div>
      )}

    </aside>
  );
}
