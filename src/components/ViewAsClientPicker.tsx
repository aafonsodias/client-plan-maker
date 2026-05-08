import { useEffect, useMemo, useState } from "react";
import { Eye, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ClientAvatar } from "@/components/ClientAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs, type ViewAsClient } from "@/contexts/ViewAsContext";
import { useNavigate } from "@tanstack/react-router";

/**
 * Trainer button: "Ver como cliente". Opens a popover with searchable
 * list of the trainer's clients and enters preview mode for the chosen one.
 * On enter, navigates to /me so the trainer immediately sees the client's
 * home (white-labelled) without having to remember the URL.
 */
export function ViewAsClientPicker({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "secondary" | "ghost" | "default";
  className?: string;
}) {
  const { enter } = useViewAs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ViewAsClient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || clients !== null) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, photo_url")
        .order("full_name", { ascending: true });
      setClients((data as ViewAsClient[] | null) ?? []);
      setLoading(false);
    })();
  }, [open, clients]);

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) => c.full_name.toLowerCase().includes(needle));
  }, [clients, q]);

  const pick = (c: ViewAsClient) => {
    enter(c);
    setOpen(false);
    setQ("");
    void navigate({ to: "/me" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} className={className}>
          <Eye className="mr-2 h-4 w-4" /> Ver como cliente
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar cliente…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {clients && clients.length === 0 ? "Sem clientes ainda." : "Nada encontrado."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <ClientAvatar name={c.full_name} photoUrl={c.photo_url} size={28} />
                    <span className="truncate">{c.full_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          A escrita fica desactivada em modo pré-visualização.
        </div>
      </PopoverContent>
    </Popover>
  );
}