import { useEffect, useState } from "react";
import { DEFAULT_MODEL_ID, isAllowedModel } from "@/lib/ai-models";

const KEY = "forge.ai.model";

export function useModelPreference() {
  const [model, setModelState] = useState<string>(DEFAULT_MODEL_ID);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (isAllowedModel(stored)) setModelState(stored);
    } catch {
      /* noop */
    }
  }, []);

  const setModel = (id: string) => {
    if (!isAllowedModel(id)) return;
    setModelState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* noop */
    }
  };

  return { model, setModel };
}