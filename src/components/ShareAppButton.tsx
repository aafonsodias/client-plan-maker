import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * Lets the trainer hand the app to someone in seconds. Uses the native
 * Web Share sheet on mobile (best UX), falls back to copying the public
 * landing URL on desktop.
 */
export function ShareAppButton() {
  const { t } = useTranslation("common");
  const onShare = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/` : "/";
    const shareData = {
      title: t("share_app.share_title"),
      text: t("share_app.share_text"),
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
      toast.success(t("share_app.copied"));
    } catch {
      toast.error(t("share_app.failed"));
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onShare}
      title={t("share_app.title")}
      className="h-8"
    >
      <Share2 className="h-4 w-4" />
      <span className="ml-1.5 hidden lg:inline">{t("share_app.label")}</span>
    </Button>
  );
}
