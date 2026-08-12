import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WalletButton } from "@/components/site/WalletButton";

export function WalletGate({
  title = "Connect a Stellar wallet",
  description = "Pair Freighter or use the demo wallet to see your streams, splits, and activity. Your Stellar address is your identity across FundRail.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-72 border-border/60">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-cyan-400/10 text-cyan-300">
          <Wallet className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-3">
        <WalletButton />
        {action}
      </EmptyContent>
    </Empty>
  );
}
