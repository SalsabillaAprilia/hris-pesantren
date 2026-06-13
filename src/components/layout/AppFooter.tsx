import React from 'react';

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-auto border-t border-border bg-white py-4 px-6 shrink-0">
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-[13px] text-muted-foreground font-medium">
        <div>
          &copy; {currentYear} <span className="font-semibold text-slate-700">AmanaHR</span> by <span className="font-semibold text-slate-700">Aprilia's Project</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Beta Version</span>
        </div>
      </div>
    </footer>
  );
}
