import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShareRow {
  walletAddress: string;
  basisPoints: number;
}

const TOTAL_BASIS_POINTS = 10_000;

/** Editor for a list of split recipients. `shares` are stored as basis
 *  points (100 bps = 1%) but edited as percentages for clarity. */
export function SplitShareEditor({
  shares,
  onChange,
  disabled = false,
}: {
  shares: ShareRow[];
  onChange: (shares: ShareRow[]) => void;
  disabled?: boolean;
}) {
  const totalPct = shares.reduce((s, r) => s + r.basisPoints / 100, 0);
  const totalValid = Math.abs(totalPct - 100) < 0.001;
  const hasInvalid = shares.some((r) => r.basisPoints <= 0);

  const setRow = (i: number, patch: Partial<ShareRow>) => {
    onChange(shares.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (shares.length >= 20) return;
    onChange([...shares, { walletAddress: "", basisPoints: 0 }]);
  };

  const removeRow = (i: number) => {
    onChange(shares.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      {shares.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row.walletAddress}
            onChange={(e) => setRow(i, { walletAddress: e.target.value })}
            placeholder="G… recipient wallet"
            className="flex-1 font-mono text-sm"
            disabled={disabled}
          />
          <div className="flex w-24 items-center gap-1">
            <Input
              value={row.basisPoints > 0 ? String(row.basisPoints / 100) : ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRow(i, { basisPoints: Number.isFinite(v) ? Math.round(v * 100) : 0 });
              }}
              placeholder="%"
              inputMode="decimal"
              className="font-mono text-sm text-right"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-red-400"
            onClick={() => removeRow(i)}
            disabled={disabled || shares.length === 1}
            aria-label={`Remove recipient ${i + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow} disabled={disabled || shares.length >= 20}>
        <Plus className="size-3.5" /> Add recipient
      </Button>

      <div
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2 font-mono text-xs",
          totalValid && shares.length > 0
            ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
            : "border-amber-400/30 bg-amber-400/5 text-amber-300",
        )}
      >
        <span>
          total: {totalPct.toFixed(totalPct % 1 === 0 ? 0 : 2)}% · {Math.round(totalPct * 100)} / 10,000 bps
        </span>
        <span>{totalValid && shares.length > 0 && !hasInvalid ? "✓ valid" : hasInvalid ? "shares must be > 0" : "must equal 100%"}</span>
      </div>
    </div>
  );
}
