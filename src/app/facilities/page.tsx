"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Landmark, DoorOpen } from "lucide-react";

const FACILITY_STATUS_BADGE: Record<string, string> = {
  Operational: "bg-emerald-500/10 text-emerald-500",
  Maintenance: "bg-amber-500/10 text-amber-600",
};

const facilities = [
  { name: "Ministry Headquarters", type: "Office Complex", location: "Kaduna South", status: "Operational" },
  { name: "Works Depot", type: "Warehouse", location: "Rigasa", status: "Maintenance" },
  { name: "ICT Training Center", type: "Training Facility", location: "Barnawa", status: "Operational" },
];

export default function FacilitiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facilities</h1>
          <p className="text-muted-foreground">Monitor ministries, departments, buildings, and rooms in one view.</p>
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Facility
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Active facilities", value: "27", icon: Building2 },
          { title: "Departments covered", value: "16", icon: Landmark },
          { title: "Rooms tracked", value: "184", icon: DoorOpen },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{item.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facility portfolio</CardTitle>
          <p className="text-sm text-muted-foreground">Manage location and occupancy data</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {facilities.map((facility) => (
              <div key={facility.name} className="min-w-0 rounded-2xl border border-border bg-background/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{facility.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{facility.type}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 sm:mt-0 sm:shrink-0">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {facility.location}
                  </span>
                  <Badge className={`${FACILITY_STATUS_BADGE[facility.status] ?? "bg-muted text-muted-foreground"}`}>
                    {facility.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
