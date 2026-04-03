import Link from "next/link"
import Image from "next/image"
import {
  ArrowRightIcon,
  BarChart3Icon,
  BoxesIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  PackageCheckIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type LandingAuthUser = {
  name: string
  initials: string
}

const featureCards = [
  {
    icon: BoxesIcon,
    title: "Inventory that stays organized",
    description:
      "Group products by category, assign them to batches, and keep stock levels visible without hunting through spreadsheets.",
  },
  {
    icon: CircleDollarSignIcon,
    title: "Landed cost built into the workflow",
    description:
      "Capture shipping, tax, customs, storage, and misc costs so every product carries a real margin-ready cost basis.",
  },
  {
    icon: ScanSearchIcon,
    title: "Quick sale flow for busy teams",
    description:
      "Search a product, record quantity and selling price, and instantly see whether you are making profit, breaking even, or losing money.",
  },
  {
    icon: BarChart3Icon,
    title: "Sales history with trend visibility",
    description:
      "Review recent sales, compare daily sales value over time, and understand how pricing decisions affect total profit.",
  },
]

const workflowSteps = [
  {
    number: "01",
    title: "Add products and source pricing",
    description:
      "Bring in imported items with foreign currency pricing, exchange rates, links, and images.",
  },
  {
    number: "02",
    title: "Bundle costs into shipment batches",
    description:
      "Apply shipping and import expenses across grouped products to calculate cleaner landed costs.",
  },
  {
    number: "03",
    title: "Sell with confidence",
    description:
      "Use quick sale actions and sales records to protect margins and keep inventory moving.",
  },
]

const summaryStats = [
  { value: "Products", label: "Catalog and stock records in one place" },
  { value: "Batches", label: "Shipment-level costing and product assignment" },
  { value: "Sales", label: "Margin-aware sales logging and history" },
  { value: "Profit", label: "Net results visible across recent activity" },
]

export function LandingPage({ authUser }: { authUser?: LandingAuthUser }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#eff6fb_0%,#fbfdff_30%,#ffffff_100%)] text-slate-950">
      <div className="absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(2,132,199,0.12),transparent_28%)]" />

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32">
        <header className="fixed left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 items-center justify-between rounded-full border border-white/70 bg-white/80 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur md:w-[calc(100%-3rem)] md:px-4 lg:w-[calc(100%-4rem)]">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
              <Image
                src="/logos/logo_white.svg"
                alt="Bach"
                width={20}
                height={20}
                className="size-5"
                priority
              />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">Bach</p>
              <p className="text-xs max-lg:sr-only text-slate-500">Imports, inventory, margins</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-950">
              Features
            </a>
            <a href="#workflow" className="transition-colors hover:text-slate-950">
              Workflow
            </a>
            <a href="#insights" className="transition-colors hover:text-slate-950">
              Insights
            </a>
          </nav>

          {authUser ? (
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                {authUser.initials || "U"}
              </div>
              <Button asChild size="lg" className="rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90">
                <Link href="/app/dashboard">Open dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="lg" className="rounded-full px-4">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-teal-600 px-4 text-white hover:bg-teal-500"
              >
                <Link href="/signup">Create account</Link>
              </Button>
            </div>
          )}
        </header>

        <div className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="max-w-2xl">
            <Badge className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-700 hover:bg-teal-50">
              <SparklesIcon className="size-3.5" />
              Built for product imports and sales teams
            </Badge>

            <h1 className="mt-6 max-w-xl font-heading text-5xl font-semibold tracking-[-0.05em] text-balance text-slate-950 sm:text-6xl lg:text-7xl">
              Track landed costs. Sell faster. Know your real margin.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Bach gives growing commerce teams one place to manage imported products,
              batch expenses, inventory movement, and profit-aware sales.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
              >
                <Link href="/signup">
                  Start free
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
                <Link href="/signin">Open dashboard</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_24px_80px_rgba(148,163,184,0.18)] backdrop-blur sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">Currencies</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">Multi-source</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Batch costing</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">Expense-aware</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Sales flow</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">Quick record</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-10 hidden h-28 w-28 rounded-full bg-teal-200/50 blur-3xl lg:block" />
            <div className="absolute -right-6 bottom-10 hidden h-36 w-36 rounded-full bg-sky-200/50 blur-3xl lg:block" />

            <div className="relative rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[1.12fr_0.88fr]">
                <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-white/70">Today&apos;s snapshot</p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight">RWF 2.4M</p>
                    </div>
                    <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                      Live
                    </Badge>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/55">Stock</p>
                      <p className="mt-2 text-2xl font-semibold">1,284</p>
                      <p className="mt-2 text-xs text-white/60">Units available</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-teal-500/15 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/55">Profit</p>
                      <p className="mt-2 text-2xl font-semibold">+18.6%</p>
                      <p className="mt-2 text-xs text-white/60">Vs last 7 days</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-white/70">
                      <span>Sales trend</span>
                      <span>90 days</span>
                    </div>
                    <div className="mt-4 flex h-28 items-end gap-2">
                      {[24, 38, 42, 58, 64, 76, 88].map((height, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t-full bg-gradient-to-t from-teal-500 to-cyan-300"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Quick sale</p>
                        <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                          JBL Tune 720
                        </p>
                      </div>
                      <div className="rounded-2xl bg-teal-600 px-3 py-2 text-sm font-medium text-white">
                        RWF 95k
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Landed cost</span>
                        <span className="font-medium">RWF 68k</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Margin / unit</span>
                        <span className="font-medium text-teal-700">RWF 27k</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">Batch allocation</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">Dubai audio drop</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Shipping", "RWF 320k"],
                        ["Customs", "RWF 140k"],
                        ["Storage", "RWF 45k"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-medium text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#0f766e_0%,#155e75_100%)] p-5 text-white shadow-[0_20px_40px_rgba(13,148,136,0.24)]">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className="size-5" />
                      <p className="font-medium">One system for stock, costs, and sales</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/75">
                      Fewer spreadsheets, faster stock decisions, and clearer profitability.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-700">
                Core capabilities
              </p>
              <h2 className="mt-4 max-w-sm font-heading text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                A cleaner operating layer for imported inventory.
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                The design is modern, but the value is practical: faster inventory handling,
                clearer landed costs, and better sales decisions every day.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {featureCards.map((item) => {
                const Icon = item.icon

                return (
                  <article
                    key={item.title}
                    className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-6 transition-transform duration-200 hover:-translate-y-1 hover:bg-white"
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="insights" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <p className="text-6xl font-semibold tracking-[-0.06em] text-teal-600">3 views</p>
            <p className="mt-6 max-w-xs text-2xl font-semibold tracking-tight text-slate-950">
              Products, batches, and sales connected by the same data.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">
              Teams do not need separate tools to understand stock levels, shipment costs,
              and revenue performance.
            </p>
          </article>

          <article className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-[0_28px_80px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/50">Recent momentum</p>
                <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.04em]">
                  Margin visibility without manual math.
                </h2>
              </div>
              <PackageCheckIcon className="hidden size-10 text-teal-300 sm:block" />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/55">Quick sale action</p>
                <p className="mt-3 text-2xl font-semibold">2 taps</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Search product and record the transaction with margin context.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/55">Profit signal</p>
                <p className="mt-3 text-2xl font-semibold">Instant</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Selling price is compared against landed cost before the sale is saved.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 sm:col-span-2">
                <div className="flex flex-wrap gap-3">
                  {summaryStats.map((stat) => (
                    <div
                      key={stat.value}
                      className="min-w-[11rem] flex-1 rounded-[1.25rem] bg-white/6 p-4"
                    >
                      <p className="text-xl font-semibold">{stat.value}</p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="workflow" className="bg-slate-950 py-16 text-white lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-300">
              Workflow
            </p>
            <h2 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              From imported stock to profitable sales in three steps.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((step) => (
              <article
                key={step.number}
                className="rounded-[1.9rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <p className="text-5xl font-semibold tracking-[-0.07em] text-white/30">
                  {step.number}
                </p>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/70">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_35%,#dbeafe_100%)] p-8 shadow-[0_28px_80px_rgba(148,163,184,0.2)] sm:p-10 lg:p-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-700">
                Ready to switch
              </p>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Replace scattered stock notes and margin guesswork with one focused workspace.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                Start with products, connect them to shipment batches, and let every sale
                reflect the actual cost behind it.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
              >
                <Link href="/signup">
                  Create account
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
                <Link href="/signin">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
