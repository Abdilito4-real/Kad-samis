"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { RequestHistory } from "@/components/requests/RequestHistory";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AgencyAdminReceivingRequestsPage() {
  const { user } = useAuth();

  if (user?.roleId !== "agency_admin") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Requests to Review</h1>
        <p className="text-muted-foreground">This receiving queue is available to Agency Admins.</p>
        <Button asChild variant="outline">
          <Link href="/requests"><ArrowLeft className="mr-2 h-4 w-4" />Back to Requests</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link>
        </Button>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Requests to Review</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Requests forwarded by the Electrical & Mechanical Request Handler for your Agency Admin review.
          </p>
        </div>
      </div>
      <RequestHistory queue="agency_admin" />
    </div>
  );
}
