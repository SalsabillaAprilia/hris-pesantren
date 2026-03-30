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
      <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Kontak & Alamat
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold">Email (Username) *</Label>
          <Input 
            type="email" 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
            required 
            disabled={mode === "edit"} 
            className={mode === "edit" ? "bg-muted font-medium" : ""} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold text-green-700">Nomor WhatsApp</Label>
          <Input 
            value={form.whatsapp_number} 
            onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} 
            placeholder="0812XXXXXXXX" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Tipe Identitas</Label>
          <Select value={form.identity_card_type} onValueChange={(v) => setForm({ ...form, identity_card_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="KTP">KTP</SelectItem>
              <SelectItem value="SIM">SIM</SelectItem>
              <SelectItem value="Passport">Passport</SelectItem>
              <SelectItem value="Lainnya">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Nomor Identitas</Label>
          <Input 
            value={form.identity_card_number} 
            onChange={(e) => setForm({ ...form, identity_card_number: e.target.value })} 
            placeholder="NIK/No. Identitas" 
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-medium">Alamat Sesuai KTP</Label>
          <Textarea 
            value={form.address} 
            onChange={(e) => setForm({ ...form, address: e.target.value })} 
            rows={2} 
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-medium">Alamat Domisili</Label>
          <Textarea 
            value={form.address_domicile} 
            onChange={(e) => setForm({ ...form, address_domicile: e.target.value })} 
            rows={2} 
          />
        </div>
      </div>
    </div>
  );
}
