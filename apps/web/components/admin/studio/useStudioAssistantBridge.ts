"use client";

import { useCallback, useEffect, useState } from "react";
import {
  assistantContextFromOpenEvent,
  currentAssistantContext,
  type AssistantContext,
} from "./studio-assistant-context";

/** Both the header and a source report open the same versioned assistant. */
export function useStudioAssistantBridge() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<AssistantContext>({
    title: "创作工作台",
    body: "",
  });
  const openAssistant = useCallback(() => {
    setAssistantContext(currentAssistantContext());
    setAssistantOpen(true);
  }, []);

  useEffect(() => {
    const receive = (event: Event) => {
      setAssistantContext(
        assistantContextFromOpenEvent((event as CustomEvent).detail),
      );
      setAssistantOpen(true);
    };
    window.addEventListener("studio-ai-open", receive);
    return () => window.removeEventListener("studio-ai-open", receive);
  }, []);

  return { assistantOpen, setAssistantOpen, assistantContext, openAssistant };
}
