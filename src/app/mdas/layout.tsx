import { AppShell } from "@/components/layout/AppShell";

export default function MdasLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
