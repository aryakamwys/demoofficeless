"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  LogOut,
  Menu,
  Car,
  ChevronDown,
  Settings,
} from "lucide-react";
import { useState } from "react";

const tripsSubItems = [
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Manage Service", href: "/services", icon: Settings },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Claims", href: "/claims", icon: FileText },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employee Master",
  "/upload": "Upload Statement",
  "/claims": "Claims",
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/claims/")) return "Claim Detail";
  return pageTitles[pathname] || "Perkom";
}

interface HeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Header({ collapsed, onToggle }: HeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [tripsOpen, setTripsOpen] = useState(true);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const isTripsActive = tripsSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center gap-2 px-6 border-b">
            <Image
              src="/ogoperkom.png"
              alt="Perkom Logo"
              width={180}
              height={48}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <nav className="space-y-1 p-3">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/dashboard"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              Dashboard
            </Link>

            {/* Trips Module */}
            <button
              onClick={() => setTripsOpen(!tripsOpen)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isTripsActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Car className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Trips</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  tripsOpen && "rotate-180"
                )}
              />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                tripsOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-2">
                {tripsSubItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
