import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { isValidStellarAddress } from "@/lib/stellar";
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
import { Textarea } from "@/components/ui/textarea";
import { Landmark, LogIn } from "lucide-react";
import { toast } from "sonner";

export function RegisterProjectDialog({
  open,
  onOpenChange,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: (slug: string) => void;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const createProject = useMutation(api.projects.createProject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && wallet && !walletAddress) setWalletAddress(wallet.address);
  }, [open, wallet, walletAddress]);

  const handleClose = (value: boolean) => {
    if (!submitting) onOpenChange(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidStellarAddress(walletAddress.trim())) {
      setError("Project wallet must be a valid Stellar address (G…)");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createProject({
        name: name.trim(),
        description: description.trim(),
        githubUrl: githubUrl.trim() || undefined,
        website: website.trim() || undefined,
        walletAddress: walletAddress.trim(),
        creatorWallet: wallet?.address,
        metadataUri: undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 6),
      });
      toast.success("Project registered", {
        description: `${name.trim()} is now live in the public registry.`,
      });
      onOpenChange(false);
      onRegistered?.(result.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a project</DialogTitle>
          <DialogDescription>
            Add your project to the public registry. Funding can then flow to its Stellar
            wallet via donations, streams, and splits.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? null : !isAuthenticated ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/70 p-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <LogIn className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Sign in to register a project</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Project ownership is tied to your account so only you can update it later.
              </p>
            </div>
            <Button
              onClick={() => navigate("/auth?returnTo=/explore")}
              className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
            >
              <LogIn className="size-4" /> Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="soroban-sdk-rs" className="text-sm" disabled={submitting} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this project do, and who maintains it?"
                className="min-h-20 text-sm"
                disabled={submitting}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-github">GitHub repository (optional)</Label>
                <Input id="project-github" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/org/repo" className="text-sm" disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-site">Website (optional)</Label>
                <Input id="project-site" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="text-sm" disabled={submitting} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-wallet">Funding wallet</Label>
              <Input
                id="project-wallet"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="G…"
                className="font-mono text-sm"
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-tags">Tags (comma separated)</Label>
              <Input id="project-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rust, contracts, tooling" className="text-sm" disabled={submitting} />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300">
                <Landmark className="size-4" />
                {submitting ? "Registering…" : "Register project"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
