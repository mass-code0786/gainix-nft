"use client";

import { Bell } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { useTransactions } from "@/hooks/useTransactions";

export default function NotificationsPage() {
  const { notifications, unreadCount } = useTransactions();

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow="Notifications"
        title="Notifications"
        description="Updates from your market, wallet, and subscription activity."
      />

      <div className="section-shell">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="muted-label">Unread</p>
              <p className="font-display text-2xl font-semibold text-white">{unreadCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {notifications.map((item) => (
            <div key={item.id} className={`rounded-3xl border p-4 ${item.read ? "border-white/10 bg-black/20" : "border-gainix-400/20 bg-gainix-900/20"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimatedPage>
  );
}
