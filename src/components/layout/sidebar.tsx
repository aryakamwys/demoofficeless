"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Car,
  Settings,
} from "lucide-react";
import { useState } from "react";

const tripsSubItems = [
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Manage Service", href: "/services", icon: Settings },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Claims", href: "/claims", icon: FileText },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [tripsOpen, setTripsOpen] = useState(() => {
    return tripsSubItems.some(
      (item) => pathname === item.href || pathname.startsWith(item.href)
    );
  });

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const isTripsActive = tripsSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:border-r bg-sidebar transition-all duration-300 ease-in-out relative",
          collapsed ? "lg:w-[68px]" : "lg:w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b overflow-hidden">
          {collapsed ? (
            <div className="flex w-full items-center justify-center px-2">
              <Image
                src="/ogoperkom.png"
                alt="Perkom"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-6">
              <Image
                src="/ogoperkom.png"
                alt="Perkom Logo"
                width={200}
                height={56}
                className="h-14 w-auto object-contain"
                priority
              />
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-slate-50 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-slate-600" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-slate-600" />
          )}
        </button>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {/* Dashboard */}
            <SidebarLink
              href="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              isActive={pathname === "/dashboard"}
              collapsed={collapsed}
            />

            {/* Trips Module */}
            {collapsed ? (
              // Collapsed: show icons only with tooltips
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-lg p-2 cursor-default",
                        isTripsActive
                          ? "text-sidebar-primary"
                          : "text-sidebar-foreground/50"
                      )}
                    >
                      <Car className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">Trips</TooltipContent>
                </Tooltip>
                {tripsSubItems.map((item) => (
                  <SidebarLink
                    key={item.name}
                    href={item.href}
                    icon={item.icon}
                    label={item.name}
                    isActive={
                      pathname === item.href || pathname.startsWith(item.href)
                    }
                    collapsed={collapsed}
                  />
                ))}
              </>
            ) : (
              // Expanded: show collapsible group
              <div>
                <button
                  onClick={() => setTripsOpen(!tripsOpen)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isTripsActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
                    {tripsSubItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Logout */}
        <div className="p-2 border-t">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  isActive,
  collapsed,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              "flex items-center justify-center rounded-lg p-2 transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
