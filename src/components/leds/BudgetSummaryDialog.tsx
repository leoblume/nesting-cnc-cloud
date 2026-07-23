import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Receipt } from "lucide-react";
import type { NestingOptions } from "@/lib/nesting/nesting";
import type { groupParts } from "@/lib/nesting/parser";

export function BudgetSummaryDialog({
  open,
  onOpenChange,
  stats,
  opts,
  groups,
  ledSummary,
  fileName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stats: any;
  opts: NestingOptions;
  groups: ReturnType<typeof groupParts>;
  ledSummary: { rows: any[]; totalLeds: number; totalPower: number } | null;
  fileName: string;
}) {
  if (!stats) return null;

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg print:max-w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Resumo do Orçamento
          </DialogTitle>
          <DialogDescription>
            {fileName || "Sem arquivo"} — visão rápida para montar o orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-md border border-border p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tamanho da chapa</span>
              <span className="font-medium">{opts.sheetWidth} × {opts.sheetHeight} mm{stats.sheets > 1 ? ` (× ${stats.sheets} chapas)` : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aproveitamento</span>
              <span className="font-medium text-green-500">{(stats.utilization * 100).toFixed(1)}%</span>
            </div>
            <div className={stats.perSheet.length > 1 ? "flex justify-between items-start" : "flex justify-between"}>
              <span className="text-muted-foreground">Tamanho da sobra</span>
              {stats.perSheet.length > 1 ? (
                <span className="font-mono text-right">
                  {stats.perSheet.map((s: any) => (
                    <div key={s.index}>Chapa {s.index}: {s.leftoverW.toFixed(0)} × {s.leftoverH.toFixed(0)} mm</div>
                  ))}
                </span>
              ) : (
                <span className="font-mono font-medium">
                  {stats.perSheet[0] ? `${stats.perSheet[0].leftoverW.toFixed(0)} × ${stats.perSheet[0].leftoverH.toFixed(0)} mm` : "—"}
                </span>
              )}
            </div>
          </section>

          <section className="rounded-md border border-border p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantidade de LEDs</span>
              <span className="font-medium text-amber-500">{ledSummary ? ledSummary.totalLeds.toLocaleString("pt-BR") : "—"}</span>
            </div>
            {ledSummary && ledSummary.rows.length > 0 && (() => {
              const byModel = new Map<string, number>();
              for (const row of ledSummary.rows) {
                byModel.set(row.ledName, (byModel.get(row.ledName) ?? 0) + row.totalLeds);
              }
              return (
                <div className="pl-2 flex flex-col gap-0.5">
                  {Array.from(byModel.entries()).map(([name, qty]) => (
                    <div key={name} className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Modelo: {name}</span>
                      <span className="font-medium">{qty.toLocaleString("pt-BR")} un</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potência total</span>
              <span className="font-medium">{ledSummary ? `${ledSummary.totalPower.toFixed(1)} W` : "—"}</span>
            </div>
            {!ledSummary && (
              <p className="text-[11px] text-muted-foreground/70 pt-0.5">Selecione um modelo de LED na aba LEDs para incluir aqui.</p>
            )}
          </section>
        </div>

        <Button onClick={handlePrint} variant="outline" className="w-full">
          <Printer className="mr-2 h-4 w-4" /> Imprimir / Salvar como PDF
        </Button>
      </DialogContent>
    </Dialog>
  );
}
