import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ContactSectionProps {
  form: any;
  setForm: (form: any) => void;
  mode: "create" | "edit";
}

export function ContactSection({ form, setForm, mode }: ContactSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Kontak & Alamat
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Email (Username) *</Label>
          <Input 
            type="email" 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
            required 
            disabled={mode === "edit"} 
            className={`h-9 text-sm text-slate-900 shadow-sm ${mode === "edit" ? "bg-muted font-medium" : ""}`} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Nomor WhatsApp</Label>
          <Input 
            value={form.whatsapp_number} 
            onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} 
            placeholder="0812XXXXXXXX" 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Kartu Identitas</Label>
          <Select value={form.identity_card_type} onValueChange={(v) => setForm({ ...form, identity_card_type: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="KTP" className="text-sm">KTP</SelectItem>
              <SelectItem value="SIM" className="text-sm">SIM</SelectItem>
              <SelectItem value="Passport" className="text-sm">Passport</SelectItem>
              <SelectItem value="KITAS" className="text-sm">KITAS</SelectItem>
              <SelectItem value="Lainnya" className="text-sm">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">ID Kartu Identitas</Label>
          <Input 
            value={form.identity_card_number} 
            onChange={(e) => setForm({ ...form, identity_card_number: e.target.value })} 
            placeholder="NIK/No. Identitas" 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Alamat Sesuai Kartu Identitas</Label>
          <Textarea 
            value={form.address} 
            onChange={(e) => setForm({ ...form, address: e.target.value })} 
            rows={2} 
            className="text-sm text-slate-900 shadow-sm resize-none"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Alamat Domisili</Label>
          <Textarea 
            value={form.address_domicile} 
            onChange={(e) => setForm({ ...form, address_domicile: e.target.value })} 
            rows={2} 
            className="text-sm text-slate-900 shadow-sm resize-none"
          />
        </div>
      </div>
    </div>
  );
}
