import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileDown, Printer, Lightbulb, Receipt } from "lucide-react";
import { printCutPlan } from "@/lib/nesting/cutPrint";
import { buildSheetDxf, downloadDxf } from "@/lib/nesting/dxfExport";
import { printLedPlan } from "@/lib/leds/ledPrint";
import type { NestResult, NestingOptions } from "@/lib/nesting/nesting";
import type { OverlapPair } from "@/lib/nesting/overlapCheck";
import type { LedModel, LedAssignment, LedMode } from "@/lib/leds/ledEngine";
import type { groupParts } from "@/lib/nesting/parser";

interface Props {
  result: NestResult | null;
  opts: NestingOptions;
  fileName: string;
  overlaps: OverlapPair[];
  activeSheet: number;
  groups: ReturnType<typeof groupParts>;
  ledModels: LedModel[];
  selectedLedId: string | null;
  ledAssignments: LedAssignment;
  ledMode: LedMode;
  ledDensity: number;
  onOpenBudget: () => void;
}

/**
 * Ações principais no header — responsivas.
 * - <sm: só ícones (tooltip revela o rótulo)
 * - md: ícones + rótulo curto
 * - lg+: ícones + rótulo completo
 * Compartilha uma única "faixa" visual para não poluir o cabeçalho.
 */
export function HeaderActions({
  result,
  opts,
  fileName,
  overlaps,
  activeSheet,
  groups,
  ledModels,
  selectedLedId,
  ledAssignments,
  ledMode,
  ledDensity,
  onOpenBudget,
}: Props) {
  const hasNesting = !!result;
  const hasLeds =
    groups.length > 0 &&
    ledModels.length > 0 &&
    (selectedLedId != null || Object.keys(ledAssignments).length > 0);

  const actions = [
    {
      key: "cut",
      icon: Printer,
      shortLabel: "Corte",
      fullLabel: "Plano de Corte",
      disabled: !hasNesting,
      disabledTitle: "Calcule o nesting primeiro",
      onClick: () =>
        result &&
        printCutPlan(result, opts, fileName || "sem-nome.pdf", overlaps),
    },
    {
      key: "led",
      icon: Lightbulb,
      shortLabel: "LEDs",
      fullLabel: "Plano de LEDs",
      disabled: !hasLeds,
      disabledTitle: "Selecione um LED para as peças",
      onClick: () =>
        printLedPlan(
          groups,
          ledModels,
          selectedLedId,
          ledAssignments,
          ledMode,
          ledDensity,
          fileName || "sem-nome.pdf",
        ),
    },
    {
      key: "dxf",
      icon: FileDown,
      shortLabel: "DXF",
      fullLabel: `DXF · Chapa ${activeSheet + 1}`,
      disabled: !hasNesting,
      disabledTitle: "Calcule o nesting primeiro",
      onClick: () => {
        if (!result) return;
        const dxf = buildSheetDxf(
          result.sheets[activeSheet] ?? [],
          opts.sheetWidth,
          opts.sheetHeight,
        );
        const base = (fileName || "nesting").replace(/\.pdf$/i, "");
        downloadDxf(dxf, `${base}-chapa${activeSheet + 1}.dxf`);
      },
    },
    {
      key: "budget",
      icon: Receipt,
      shortLabel: "Resumo",
      fullLabel: "Resumo do Orçamento",
      disabled: !hasNesting,
      disabledTitle: "Calcule o nesting primeiro",
      onClick: onOpenBudget,
      primary: true,
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card/40 p-1 shadow-sm">
        {actions.map((a) => {
          const Icon = a.icon;
          const btn = (
            <Button
              key={a.key}
              onClick={a.onClick}
              disabled={a.disabled}
              size="sm"
              variant={a.primary ? "default" : "ghost"}
              className={
                "h-8 gap-1.5 px-2 text-xs md:px-2.5 " +
                (a.primary ? "" : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {/* rótulo curto a partir de md, completo em lg */}
              <span className="hidden md:inline lg:hidden">{a.shortLabel}</span>
              <span className="hidden lg:inline">{a.fullLabel}</span>
            </Button>
          );
          return (
            <Tooltip key={a.key}>
              <TooltipTrigger asChild>
                <span>{btn}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {a.disabled ? a.disabledTitle : a.fullLabel}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
