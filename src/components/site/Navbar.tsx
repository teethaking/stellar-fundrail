import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/Logo";
import { WalletButton } from "@/components/site/WalletButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/streams", label: "Streams" },
  { to: "/splitter", label: "Splitter" },
  { to: "/activity", label: "Activity" },
  { to: "/docs", label: "Docs" },
  { to: "/about", label: "About" },
];

export function Navbar() {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch {
      // ignore
    }
  };

  const initials = (user?.name ?? user?.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors",
        scrolled
          ? "border-border/70 bg-[#05070D]/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="FundRail home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
                    isActive && "bg-white/5 text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <WalletButton compact />
          {isLoading ? null : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-white/5 transition-colors hover:bg-white/10"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-cyan-400/15 text-xs font-semibold text-cyan-200">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => navigate("/dashboard")}
                  className="cursor-pointer gap-2"
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer gap-2 text-red-400 focus:text-red-400"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}
            >
              Sign in
            </Button>
          )}

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-border/70 text-foreground lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/70 bg-[#05070D]/95 px-4 pb-4 pt-2 backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
                    isActive && "bg-white/5 text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            {!isAuthenticated && !isLoading && (
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}
              >
                Sign in
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
