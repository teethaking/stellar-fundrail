import { Link } from "react-router";
import { Github, Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatUnitsCompact, shortAddress } from "@/lib/stellar";

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string;
  githubUrl?: string;
  website?: string;
  walletAddress: string;
  tags: string[];
  totalReceived: number;
  supporterCount: number;
  createdAt: number;
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const hue = hashHue(project.slug);

  return (
    <Link
      to={`/project/${project.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/60 transition-all hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-card"
    >
      <div
        className="flex h-24 items-center justify-center border-b border-border/50"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 45% 18%), hsl(${hue} 60% 10%))`,
        }}
      >
        <span className="text-4xl font-bold text-white/90 drop-shadow">
          {project.name.charAt(0).toUpperCase()}
        </span>
        <span className="absolute right-3 top-3">
          <Badge variant="secondary" className="bg-black/25 text-[10px] text-white/90">
            {project.tags[0]}
          </Badge>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-mono text-base font-semibold tracking-tight">
            {project.name}
          </h3>
        </div>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4">
          <div>
            <p className="text-sm font-semibold text-cyan-200">
              {formatUnitsCompact(project.totalReceived)}{" "}
              <span className="text-xs font-normal text-muted-foreground">USDC</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              {project.supporterCount.toLocaleString()} supporters
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {project.githubUrl && <Github className="size-4" />}
            {project.website && <Globe className="size-4" />}
            <span className="font-mono text-[10px]">{shortAddress(project.walletAddress, 3)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
