import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Explore = lazy(() => import("./pages/Explore.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.tsx"));
const Streams = lazy(() => import("./pages/Streams.tsx"));
const Splitter = lazy(() => import("./pages/Splitter.tsx"));
const Activity = lazy(() => import("./pages/Activity.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

// Framer Motion wrapper for route page transitions
function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Read the Convex deployment URL from build-time env.
// On a freshly cloned repo or a CI build where VITE_CONVEX_URL isn't set, this
// is undefined — instead of crashing with a blank page, we render a clear
// configuration message (see MissingConvexConfig below).
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

/** Clear, self-explanatory screen shown when the Convex deployment URL is not
 *  configured at build time (e.g. deploying to Vercel without env vars). */
function MissingConvexConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 text-center">
        <p className="text-sm font-semibold tracking-tight">
          Backend not configured
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This deployment was built without <code className="font-mono text-cyan-300">VITE_CONVEX_URL</code>,
          so the app can't reach its backend. Add the env var in your hosting
          provider's project settings (Vercel → Settings → Environment Variables)
          and redeploy.
        </p>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
          VITE_CONVEX_URL=https://&lt;deployment&gt;.convex.cloud
        </p>
      </div>
    </div>
  );
}

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// Animated route wrapper — provides smooth page transitions
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoading />} key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Page><Landing /></Page>} />
          <Route path="/auth" element={<Page><AuthPage redirectAfterAuth="/dashboard" /></Page>} />
          <Route path="/explore" element={<Page><Explore /></Page>} />
          <Route path="/project/:slug" element={<Page><ProjectDetail /></Page>} />
          <Route path="/dashboard" element={<Page><RequireAuth><Dashboard /></RequireAuth></Page>} />
          <Route path="/streams" element={<Page><Streams /></Page>} />
          <Route path="/splitter" element={<Page><Splitter /></Page>} />
          <Route path="/activity" element={<Page><Activity /></Page>} />
          <Route path="/docs" element={<Page><Docs /></Page>} />
          <Route path="/about" element={<Page><About /></Page>} />
          <Route path="*" element={<Page><NotFound /></Page>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}


const app = (
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <RouteSyncer />
            <AnimatedRoutes />
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      ) : (
        <MissingConvexConfig />
      )}
    </RootErrorBoundary>
  </StrictMode>
);

const container = document.getElementById("root")!;
createRoot(container).render(app);
