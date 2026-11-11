"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pb-6 pt-7">
        <Link href="/hooks" onClick={onNavigate} className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-pink">
          <span className="font-heading block text-[1.65rem] leading-none">@theclearcode</span>
          <span className="mt-2 block text-xs uppercase tracking-[0.18em] text-brand-pink/90">content dashboard</span>
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.95rem] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-pink",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/85 hover:bg-white/10 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-end justify-between border-t border-sidebar-border px-6 py-5">
        <span className="text-xs leading-relaxed text-sidebar-foreground/70">
          the clear code.
        </span>
        {/* c. lettermark — the brand watermark */}
        <span aria-hidden className="font-heading text-4xl leading-none text-brand-pink">c.</span>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 bg-sidebar lg:block">
      <div className="sticky top-0 h-dvh">
        <SidebarBody />
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <span className="font-heading text-xl">@theclearcode</span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="rounded-full p-2 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-pink">
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
