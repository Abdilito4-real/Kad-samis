"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-4 dark:bg-background dark:bg-none">
      <div className="w-full max-w-lg rounded-[32px] border border-border bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <SearchX className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The route you requested is unavailable or has moved. Return to the dashboard and continue with your workflow.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
