import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { isValidStellarAddress, parseUnits, shortAddress, simulateTxHash } from "@/lib/stellar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, Wallet } from "lucide-react";
import { toast } from "sonner";

const DAY = 86_400_000;

const DURATIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

export function CreateStreamDialog({
  open,
  onOpenChange,
  prefillRecipient,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillRecipient?: string;
  onCreated?: (id: string) => void;
}) {
  const { wallet } = useWallet();
  const createStream = useMutation(api.streams.createStream);

  const [recipient, setRecipient] = useState(prefillRecipient ?? "");
  const [token, setToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && prefillRecipient) setRecipient(prefillRecipient);
  }, [open, prefillRecipient]);

  const reset = () => {
    setRecipient(prefillRecipient ?? "");
    setToken("USDC");
    setAmount("");
    setDays(30);
    setError(null);
  };

  const handleClose = (value: boolean) => {
    if (!submitting) onOpenChange(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      setError("Connect a wallet first — use Freighter or the demo wallet.");
      return;
    }
    setError(null);

    if (!isValidStellarAddress(recipient.trim())) {
      setError("Recipient must be a valid Stellar address (G…)");
      return;
    }
    if (recipient.trim() === wallet.address) {
      setError("Recipient must be different from the sender");
      return;
    }
    let totalAmount: number;
    try {
      totalAmount = parseUnits(amount.trim());
    } catch {
      setError("Enter a valid amount");
      return;
    }
    if (totalAmount <= 0) {
      setError("Amount must be positive");
      return;
    }

    setSubmitting(true);
    try {
      const startTime = Date.now();
      const endTime = startTime + days * DAY;
      const id = await createStream({
        senderWallet: wallet.address,
        recipientWallet: recipient.trim(),
        token,
        totalAmount,
        startTime,
        endTime,
        txHash: simulateTxHash("stream"),
      });
      toast.success("Stream created", {
        description: `${token} stream started — funds accrue per second.`,
      });
      reset();
      onOpenChange(false);
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stream");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a funding stream</DialogTitle>
          <DialogDescription>
            Escrow {token} and stream it to a recipient per second. The sender can pause,
            resume, or cancel at any time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stream-recipient">Recipient wallet</Label>
            <Input
              id="stream-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="G…"
              className="font-mono text-sm"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Token</Label>
              <Select value={token} onValueChange={setToken} disabled={submitting}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="XLM">XLM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stream-amount">Total amount</Label>
              <Input
                id="stream-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="250.00"
                inputMode="decimal"
                className="font-mono text-sm"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  onClick={() => setDays(d.days)}
                  className={`cursor-pointer rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                    days === d.days
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                      : "border-border/70 text-muted-foreground hover:border-cyan-400/30 hover:text-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {!wallet && (
            <p className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
              <Wallet className="mt-0.5 size-4 shrink-0" />
              No wallet connected. Connect Freighter or the demo wallet from the navbar before
              creating a stream.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !wallet}
              className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
            >
              <Radio className="size-4" />
              {submitting ? "Creating…" : "Create stream"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
