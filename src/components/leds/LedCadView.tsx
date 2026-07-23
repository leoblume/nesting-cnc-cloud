import { Package } from "lucide-react";
import { LedRegistrationPanel } from "./LedRegistrationPanel";
import { createLedModel, deleteLedModel, isSupabaseConfigured } from "@/lib/leds/ledModelsRepo";
import type { LedModel } from "@/lib/leds/ledEngine";

export function LedCadView({
  ledModels, setLedModels, ledModelsLoading,
  selectedLedId, setSelectedLedId,
}: {
  ledModels: LedModel[];
  setLedModels: (fn: (p: LedModel[]) => LedModel[]) => void;
  ledModelsLoading: boolean;
  selectedLedId: string | null;
  setSelectedLedId: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/20">
          <Package className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Cadastro de LEDs</h2>
          <p className="text-xs text-muted-foreground">Registre os modelos de LED com foto e dimensões para uso nos cálculos</p>
          <p className="text-[10px] mt-0.5 text-muted-foreground/80">
            {isSupabaseConfigured
              ? "☁️ Cadastro salvo no servidor (Supabase) — compartilhado com todos os usuários."
              : "⚠️ Servidor não configurado — cadastro salvo apenas neste navegador (defina VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)."}
          </p>
        </div>
      </div>
      <LedRegistrationPanel
        leds={ledModels}
        loading={ledModelsLoading}
        onAdd={async (m) => {
          setLedModels((p) => [...p, m]);
          setSelectedLedId(m.id);
          const { model, savedToServer } = await createLedModel(m);
          if (!savedToServer) {
            console.warn(`LED "${model.name}" salvo apenas localmente.`);
          }
        }}
        onRemove={(id) => {
          setLedModels((p) => p.filter((l) => l.id !== id));
          if (selectedLedId === id) setSelectedLedId(null);
          deleteLedModel(id);
        }}
        selectedId={selectedLedId}
        onSelect={setSelectedLedId}
      />
    </div>
  );
}
