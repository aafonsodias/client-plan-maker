import { Eye, X, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useViewAs, type ViewAsClient } from "@/contexts/ViewAsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ClientAvatar } from "@/components/ClientAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

/**
 * Persistent amber bar shown across the whole app whenever the trainer is
 * impersonating a client. Mounted once at the root.
 *
 * Lets the trainer:
 *   - see who they're previewing as
 *   - swap to another client without leaving the current page
 *   - exit and return to trainer view
 */
export function ViewAsBar() {
  const { isPreview, client, switchClient, exit } = useViewAs();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clients, setClients] = useState<ViewAsClient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!pickerOpen || clients !== null) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, photo_url")
        .order("full_name", { ascending: true });
      setClients((data as ViewAsClient[] | null) ?? []);
      setLoading(false);
    })();
  }, [pickerOpen, clients]);

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) => c.full_name.toLowerCase().includes(needle));
  }, [clients, q]);

  if (!isPreview || !client) return null;

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-500/40 bg-amber-500/10 backdrop-blur supports-[backdrop-filter]:bg-amber-500/10">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs text-amber-700 dark:text-amber-200">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Eye className="h-3.5 w-3.5" /> Modo cliente
        </span>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-amber-800 hover:bg-amber-500/25 dark:text-amber-100"
            >
              <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={20} />
              <span className="max-w-[12rem] truncate font-semibold">{client.full_name}</span>
              <ChevronsUpDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="border-b border-border p-2">
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Trocar de cliente…"
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nada encontrado.</p>
              ) : (
                <ul className="space-y-0.5">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          switchClient(c);
                          setPickerOpen(false);
                          setQ("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${c.id === client.id ? "bg-accent/60" : ""}`}
                      >
                        <ClientAvatar name={c.full_name} photoUrl={c.photo_url} size={24} />
                        <span className="truncate">{c.full_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <span className="hidden text-amber-700/70 dark:text-amber-200/70 sm:inline">
          A escrita está desactivada.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/me" })}
            className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-800 hover:bg-amber-500/25 dark:text-amber-100"
          >
            Casa do cliente
          </button>
          <button
            type="button"
            onClick={() => exit()}
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-800 hover:bg-amber-500/25 dark:text-amber-100"
            title="Sair do modo cliente"
          >
            <X className="h-3 w-3" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}