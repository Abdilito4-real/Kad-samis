"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  ClipboardCheck,
  Compass,
  FileText,
  Gauge,
  MapPinned,
  Menu,
  Moon,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { DownloadAppButton } from "@/components/download-app-button";

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#documentation", label: "Documentation" },
  { href: "#support", label: "Support" },
  { href: "#contact", label: "Contact" },
];

const stats = [
  { label: "Assets Registered", value: 25000, suffix: "+" },
  { label: "Government Facilities", value: 1500, suffix: "+" },
  { label: "Departments", value: 300, suffix: "+" },
  { label: "Maintenance Records", value: 80000, suffix: "+" },
];

const features = [
  {
    icon: ClipboardCheck,
    title: "Asset Registry",
    description: "Maintain a single authoritative register for all public assets, from land and buildings to equipment and vehicles.",
  },
  {
    icon: Wrench,
    title: "Maintenance Management",
    description: "Coordinate repairs, service schedules, and work orders with complete visibility across ministries and agencies.",
  },
  {
    icon: Building2,
    title: "Facility Monitoring",
    description: "Track the condition and utilization of facilities in real time to support planning and accountability.",
  },
  {
    icon: MapPinned,
    title: "QR Verification",
    description: "Verify assets quickly at the point of service via secure QR-based inspection and audit trails.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Deliver policy-ready insights for executives, auditors, and technical departments through rich dashboards.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Protect sensitive workflows with structured permissions, audit logs, and secure operational controls.",
  },
];

const workflow = ["Asset Registration", "Inspection", "Assignment", "Maintenance", "Audit", "Reporting", "Archive"];

const security = [
  "Supabase Security",
  "Encrypted Storage",
  "Audit Logs",
  "Role Permissions",
  "Secure Authentication",
  "Offline Sync",
];

const reasons = [
   "Improve Accountability",
  "Digital Transformation",
  "Centralized Asset Register",
  "Maintenance Optimization",
  "Government Transparency",
  "Real-Time Monitoring",
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 1200;
    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="text-3xl font-semibold text-foreground">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef5f8)] text-foreground transition-colors dark:bg-background dark:bg-none">
      <div className="mx-auto flex max-w-7xl flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-20 rounded-full border border-border bg-card/80 px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 overflow-hidden rounded-full border border-border bg-background shadow-sm">
                <img src="/images/auth/kaduna-state.svg" alt="Kaduna State logo" className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-foreground">Kadsamis</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Kaduna State Digital Portal</p>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="transition hover:text-primary">
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <DownloadAppButton variant="outline" className="hidden sm:inline-flex" />
              <a
                href="/auth/login"
                className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:px-4"
              >
                Login
              </a>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
                aria-label="Toggle theme"
              >
                {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMobileNavOpen((current) => !current)}
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileNavOpen}
                className="rounded-full border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500 md:hidden"
              >
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mobileNavOpen ? (
            <div className="mt-3 space-y-1 border-t border-border pt-3 md:hidden">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </header>

        <section id="about" className="grid items-center gap-10 px-2 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-4 lg:py-24">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-500">
              <BadgeCheck className="h-4 w-4" />
              Official Government Digital Platform
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Kadsamis
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              A centralized enterprise platform for registering, monitoring, maintaining, auditing, and managing government assets across Kaduna State ministries, departments, and agencies.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {[
                "Government Certified",
                "Secure Platform",
                "Real-time Monitoring",
                "Offline Ready",
                "Role-Based Access",
              ].map((item) => (
                <span key={item} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm">
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(16,185,129,0.22)] transition hover:translate-y-[-1px] hover:bg-primary/90"
              >
                Access Secure Portal <ArrowRight className="h-4 w-4" />
              </Link>
              <DownloadAppButton variant="outline" className="px-6 py-3" />
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-emerald-400/40 hover:text-emerald-500"
              >
                Learn More <Compass className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65 }} className="relative min-w-0">
            <div className="absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(circle,_rgba(16,185,129,0.16),_transparent_70%)] blur-3xl" />
            {/* Deliberately a fixed dark "product screenshot" panel, like a
                dashboard preview card — it stays dark regardless of site
                theme, same treatment as the login page's brand panel. */}
            <div className="rounded-[32px] border border-border bg-card/70 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,_#06120e,_#0b2a22_45%,_#0f172a)] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Operations Overview</p>
                    <p className="text-xl font-semibold">Enterprise Asset Command Center</p>
                  </div>
                  <div className="rounded-full bg-white/10 p-2">
                    <Gauge className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Total Assets</p>
                    <p className="mt-2 text-2xl font-semibold">₦12.8B</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Government Buildings</p>
                    <p className="mt-2 text-2xl font-semibold">1,284</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Maintenance Requests</p>
                    <p className="mt-2 text-2xl font-semibold">145</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Online Users</p>
                    <p className="mt-2 text-2xl font-semibold">42</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Asset map</span>
                    <span>Live status</span>
                  </div>
                  <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[1.25fr_0.75fr]">
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <MapPinned className="h-4 w-4 text-emerald-400" />
                        Kaduna State asset distribution
                      </div>
                      <div className="mt-3 h-24 rounded-xl bg-[radial-gradient(circle_at_20%_20%,_rgba(16,185,129,0.4),_transparent_35%),linear-gradient(135deg,_#0f172a,_#122d4f)]" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-sm text-slate-200">Inspections due</p>
                        <p className="mt-1 text-xl font-semibold">24</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-sm text-slate-200">Pending approvals</p>
                        <p className="mt-1 text-xl font-semibold">11</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-2 rounded-[28px] border border-border bg-card/75 px-6 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.07)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 overflow-hidden rounded-full border border-border bg-background shadow-sm">
                <img src="/images/auth/kaduna-state.svg" alt="Kaduna State logo" className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Official Digital Platform</p>
                <p className="text-sm text-muted-foreground">Powered by Kaduna State Facilities Management Agency (KADFAMA)</p>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              In partnership with the Kaduna State Government, Kadsamis provides a secure and modern foundation for public asset stewardship.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} className="rounded-[24px] border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="features" className="mt-20">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Core Capabilities</p>
            <h2 className="text-3xl font-semibold sm:text-4xl">Designed for enterprise asset governance</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Every module is built to support the daily needs of public institutions, technical teams, auditors, and leadership.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article key={feature.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.06 }} className="group rounded-[24px] border border-border bg-card/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="mt-20 rounded-[32px] border border-border bg-card/75 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Operational Workflow</p>
              <h2 className="mt-3 text-3xl font-semibold">From registration to reporting in one secure process</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {workflow.map((step, index) => (
                <div key={step} className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <span className="font-semibold text-primary">{index + 1}</span>
                  {step}
                  {index < workflow.length - 1 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-[32px] border border-border bg-card/80 p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Enterprise Security</p>
            <h2 className="mt-3 text-3xl font-semibold">Trusted by public institutions</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {security.map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-background p-4 text-sm font-medium text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Deliberately dark mockup, same as the operations panel above. */}
          <div className="min-w-0 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,_#06120e,_#0b2a22_45%,_#0f172a)] p-6 text-white shadow-[0_24px_70px_rgba(2,8,23,0.26)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Dashboard Preview</p>
                <h3 className="mt-2 text-2xl font-semibold">Executive command view</h3>
              </div>
              <div className="rounded-full bg-white/10 p-2">
                <MonitorSmartphone className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="min-w-0 rounded-[24px] border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Live dashboards</span>
                  <span>Secure</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="h-2 w-24 rounded-full bg-emerald-400" />
                    <div className="mt-3 h-16 rounded-xl bg-[linear-gradient(135deg,_rgba(16,185,129,0.35),_rgba(59,130,246,0.25))]" />
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-200">
                      <FileText className="h-4 w-4" />
                      Maintenance queue
                    </div>
                    <div className="mt-2 h-12 rounded-xl bg-black/30" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Departments</p>
                  <p className="mt-2 text-3xl font-semibold">300+</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Service coverage</p>
                  <p className="mt-2 text-3xl font-semibold">97%</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Audit readiness</p>
                  <p className="mt-2 text-3xl font-semibold">24/7</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason} className="rounded-[24px] border border-border bg-card/80 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{reason}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Public asset management becomes more transparent, measurable, and responsive with Kadsamis.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="support" className="mt-20 rounded-[32px] border border-border bg-[linear-gradient(135deg,_rgba(255,255,255,0.9),_rgba(236,253,245,0.9))] p-8 text-center shadow-[0_22px_65px_rgba(15,23,42,0.07)] dark:bg-[linear-gradient(135deg,_rgba(19,19,19,0.95),_rgba(16,185,129,0.08))]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Ready to manage Kaduna State assets?</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Access the secure enterprise portal</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Start from a trusted government experience and move directly into secure workflows for facilities, maintenance, and reporting.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/auth/login" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(16,185,129,0.22)] transition hover:bg-primary/90">
              Login to System
            </Link>
            <a href="#documentation" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-emerald-400/40 hover:text-emerald-500">
              View Documentation
            </a>
          </div>
        </section>
      </div>

      <footer id="contact" className="border-t border-border bg-card/70 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 overflow-hidden rounded-full border border-border bg-background shadow-sm">
              <img src="/images/auth/kaduna-state.svg" alt="Kaduna State logo" className="h-full w-full rounded-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Kaduna State Government</p>
              <p>KADFAMA • Kadsamis</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="#" className="transition hover:text-primary">Privacy Policy</a>
            <a href="#" className="transition hover:text-primary">Terms</a>
            <a href="#contact" className="transition hover:text-primary">Contact</a>
          </div>
          <div className="text-sm text-muted-foreground">
            ICT Department • Version 1.0.0
          </div>
        </div>
      </footer>
    </main>
  );
}
