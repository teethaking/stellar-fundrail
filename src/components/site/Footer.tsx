import { Link } from "react-router";
import { LogoMark } from "@/components/site/Logo";
import { STELLAR_NETWORK } from "@/lib/stellar";

const PRODUCT = [
  { to: "/explore", label: "Explore projects" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/streams", label: "Funding streams" },
  { to: "/splitter", label: "Payment splits" },
  { to: "/activity", label: "Activity" },
];

const RESOURCES = [
  { to: "/docs", label: "Developer docs" },
  { to: "/about", label: "About" },
  { href: "https://developers.stellar.org", label: "Stellar developers" },
  { href: "https://drips.network", label: "Drips protocol" },
  { href: "https://soroban.stellar.org", label: "Soroban smart contracts" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-[#04060B]">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-7" />
              <span className="font-semibold tracking-tight">
                Fund<span className="text-cyan-300">Rail</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              Decentralized funding and contribution platform for public goods,
              built with Rust + Soroban smart contracts on the Stellar network.
              Open-source, transparent, and streaming by default.
            </p>
            <p className="mt-4 font-mono text-xs text-muted-foreground/80">
              {STELLAR_NETWORK.name} · {STELLAR_NETWORK.passphrase}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Resources</h3>
            <ul className="mt-4 space-y-2.5">
              {RESOURCES.map((l) =>
                "to" in l ? (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ) : (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            FundRail — open-source public-goods funding. MIT-licensed reference
            implementation, testnet demo.
          </p>
          <p className="font-mono">
            No ETH. No EVM. Just Rust + Soroban.
          </p>
        </div>
      </div>
    </footer>
  );
}
