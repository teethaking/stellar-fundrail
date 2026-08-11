import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="fr-rail" x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="fr-signal" x1="6" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#0B101C" stroke="rgba(148,163,184,0.25)" />
      {/* rail tracks */}
      <path d="M7 21 L15 7" stroke="url(#fr-rail)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 22.5 L23 6.5" stroke="url(#fr-rail)" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      <path d="M19 24 L26 12.5" stroke="url(#fr-rail)" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
      {/* token on the rail */}
      <circle cx="15.4" cy="14.4" r="3.1" fill="url(#fr-signal)" />
      <circle cx="14.9" cy="13.9" r="1.1" fill="#0B101C" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-semibold tracking-tight text-[17px]">
        Fund<span className="text-cyan-300">Rail</span>
      </span>
    </span>
  );
}
