import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { ProjectCard } from "@/components/site/ProjectCard";
import { RegisterProjectDialog } from "@/components/projects/RegisterProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Compass, Loader2, Plus, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function Explore() {
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list, { limit: 100 });
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects ?? []) for (const t of p.tags) set.add(t);
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    if (!projects) return undefined;
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (tag && !p.tags.includes(tag)) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [projects, q, tag]);

  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="Public registry"
        title="Explore funded projects"
        description="Every project in the registry is public: its wallet, its funding history, and everyone who supports it. No gatekeepers — register your own in under a minute."
      >
        <Button
          className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
          onClick={() => setRegisterOpen(true)}
        >
          <Plus className="size-4" /> Register project
        </Button>
      </PageHeader>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, tags, descriptions…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTag(null)}
            className={`cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
              tag === null
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            all
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                tag === t
                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {!filtered ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading registry…
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="min-h-72 border-border/60">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Compass className="size-6" />
            </EmptyMedia>
            <EmptyTitle>No projects match</EmptyTitle>
            <EmptyDescription>
              Try a different search or tag, or be the first to register a project with this
              description.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button variant="outline" onClick={() => setRegisterOpen(true)}>
              <Plus className="size-4" /> Register project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div
              key={p.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35 }}
            >
              <ProjectCard project={p} />
            </motion.div>
          ))}
        </div>
      )}

      <RegisterProjectDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={(slug) => navigate(`/project/${slug}`)} />
    </SiteLayout>
  );
}
