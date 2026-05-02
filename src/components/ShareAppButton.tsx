import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Lets the trainer hand the app to someone in seconds. Uses the native
 * Web Share sheet on mobile (best UX), falls back to copying the public
 * landing URL on desktop.
 */
export function ShareAppButton() {
  const onShare = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/` : "https://forge.lovable.app/";
    const shareData = {
      title: "Forge — Workout plans for personal trainers",
      text: "Estou a usar isto para escrever planos de treino. Experimenta com 1 cliente — grátis.",
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      // user cancelled — silent
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui partilhar.");
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onShare}
      title="Partilhar a app"
      className="h-8"
    >
      <Share2 className="h-4 w-4" />
      <span className="ml-1.5 hidden lg:inline">Partilhar</span>
    </Button>
  );
}