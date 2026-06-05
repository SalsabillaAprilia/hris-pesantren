import React, { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LucideIcon } from "lucide-react";

interface DetailHeaderProps {
  title: string | ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  avatarUrl?: string | null;
  fallbackInitials?: string;
  onAvatarClick?: () => void;
  actions?: ReactNode;
}

export function DetailHeader({
  title,
  subtitle,
  badge,
  avatarUrl,
  fallbackInitials,
  onAvatarClick,
  actions,
}: DetailHeaderProps) {
  // Hanya gunakan mode Avatar jika avatarUrl atau fallbackInitials secara eksplisit di-pass
  const hasAvatar = avatarUrl !== undefined || fallbackInitials !== undefined;

  return (
    <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
      <div className="flex items-start justify-between">
        {hasAvatar ? (
          // Mode: Karyawan (dengan Avatar)
          <div className="flex items-center gap-4">
            <Avatar
              className={`h-16 w-16 border-2 border-white shadow-md ${onAvatarClick ? "cursor-pointer hover:scale-105 hover:shadow-lg transition-all" : ""}`}
              onClick={onAvatarClick}
            >
              <AvatarImage src={avatarUrl || ""} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {fallbackInitials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 py-1">
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">{title}</DialogTitle>
              {(subtitle || badge) && (
                <div className="flex items-center gap-2">
                  {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
                  {subtitle && badge && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>}
                  {badge}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Mode: Compact (Tugas / KPI) - Tidak ada spacing avatar kosong
          <div className="space-y-1.5 py-1">
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">{title}</DialogTitle>
            {(subtitle || badge) && (
              <div className="flex items-center gap-2">
                {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
                {subtitle && badge && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>}
                {badge}
              </div>
            )}
          </div>
        )}
        
        {/* Actions (Tombol Edit/Delete) di kanan */}
        {actions && (
          <div className="flex items-center gap-2 pr-6">
            {actions}
          </div>
        )}
      </div>
    </DialogHeader>
  );
}

interface DetailSectionProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

export function DetailSection({ icon: Icon, title, children }: DetailSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-6">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {title}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pl-3 border-l-2 border-muted/50 py-1">
        {children}
      </div>
    </section>
  );
}

interface DetailItemProps {
  label: string;
  value: ReactNode;
  isHighlight?: boolean;
  className?: string;
}

export function DetailItem({ label, value, isHighlight = false, className = "" }: DetailItemProps) {
  const isStringOrNumber = typeof value === "string" || typeof value === "number";
  const isEmpty = value === null || value === undefined || value === "";

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</Label>
      {isStringOrNumber || isEmpty ? (
        <p className={`text-sm font-medium ${isHighlight ? "text-primary" : "text-slate-800"}`}>
          {isEmpty ? "—" : value}
        </p>
      ) : (
        <div className={`text-sm font-medium ${isHighlight ? "text-primary" : "text-slate-800"}`}>
          {value}
        </div>
      )}
    </div>
  );
}
