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
  const [servicesOpen, setServicesOpen] = useState(() => pathname.startsWith("/services"));

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
        <div className="flex h-24 items-center border-b border-slate-100 overflow-hidden justify-center px-4">
          {collapsed ? (
            <div className="flex w-full items-center justify-center">
              <Image
                src="/ogoperkom.png"
                alt="Perkom"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <Image
                src="/ogoperkom.png"
                alt="Perkom Logo"
                width={240}
                height={80}
                className="h-20 w-auto object-contain scale-110 origin-center"
                priority
              />
            </div>
          )}
        </div>

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
                    "flex w-full items-center gap-3 py-2.5 px-3 mb-1 text-sm font-medium transition-colors relative rounded-r-lg",
                    isTripsActive
                      ? "text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {isTripsActive && (
                    <div className="absolute left-[-8px] top-0 bottom-0 w-1 bg-blue-600 rounded-r-md" />
                  )}
                  <Car className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-left">Trips</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
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
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                    {tripsSubItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 py-2 px-3 text-sm font-medium transition-colors rounded-lg",
                            isActive
                              ? "bg-blue-50/50 text-blue-700"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
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

            {/* Manage Service Module */}
            <div className="pt-2 mt-2 border-t border-slate-100">
              {collapsed ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn("flex items-center justify-center rounded-lg p-2 cursor-default", pathname.startsWith("/services") ? "text-sidebar-primary" : "text-sidebar-foreground/50")}>
                        <Settings className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Manage Service</TooltipContent>
                  </Tooltip>
                  <SidebarLink href="/services" icon={LayoutDashboard} label="Dashboard" isActive={pathname === "/services"} collapsed={collapsed} />
                  <SidebarLink href="/services/upload" icon={Upload} label="Upload Klaim" isActive={pathname === "/services/upload"} collapsed={collapsed} />
                </>
              ) : (
                <div>
                  <button
                    onClick={() => setServicesOpen(!servicesOpen)}
                    className={cn(
                      "flex w-full items-center gap-3 py-2.5 px-3 mb-1 text-sm font-medium transition-colors relative rounded-r-lg",
                      pathname.startsWith("/services") ? "text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {pathname.startsWith("/services") && <div className="absolute left-[-8px] top-0 bottom-0 w-1 bg-blue-600 rounded-r-md" />}
                    <Settings className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">Manage Service</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", servicesOpen && "rotate-180")} />
                  </button>
                  <div className={cn("overflow-hidden transition-all duration-200 ease-in-out", servicesOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0")}>
                    <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                      <Link href="/services" className={cn("flex items-center gap-3 py-2 px-3 text-sm font-medium transition-colors rounded-lg", pathname === "/services" ? "bg-blue-50/50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>
                        <LayoutDashboard className="h-4 w-4 shrink-0" /> Dashboard
                      </Link>
                      <Link href="/services/upload" className={cn("flex items-center gap-3 py-2 px-3 text-sm font-medium transition-colors rounded-lg", pathname === "/services/upload" ? "bg-blue-50/50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>
                        <Upload className="h-4 w-4 shrink-0" /> Upload Klaim
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </ScrollArea>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-slate-100 flex flex-col gap-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  onClick={onToggle}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand menu</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium"
              onClick={onToggle}
            >
              <ChevronLeft className="h-4 w-4" />
              Collapse menu
            </Button>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
              className="w-full justify-start gap-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium"
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
              "flex items-center justify-center p-2 mb-1 transition-colors relative group",
              isActive
                ? "text-blue-700 bg-blue-50 rounded-lg"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-lg"
            )}
          >
            {isActive && (
              <div className="absolute left-[-8px] top-0 bottom-0 w-1 bg-blue-600 rounded-r-md" />
            )}
            <Icon className="h-5 w-5 shrink-0" />
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
        "flex items-center gap-3 py-2.5 px-3 mb-1 text-sm font-medium transition-colors relative rounded-r-lg",
        isActive
          ? "bg-blue-50/50 text-blue-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {isActive && (
        <div className="absolute left-[-8px] top-0 bottom-0 w-1 bg-blue-600 rounded-r-md" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}
