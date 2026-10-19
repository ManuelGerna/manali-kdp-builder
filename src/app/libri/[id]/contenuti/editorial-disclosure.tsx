"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from "react";
import type { SubsectionTextDraft } from "@/lib/kdp/editorial-text-editor";

type Drafts = Map<string, Record<string, string>>;
const DraftContext = createContext<Drafts | null>(null);
const TextDraftContext = createContext<Map<string, SubsectionTextDraft> | null>(null);
export function useEditorialTextDraftCache() { return useContext(TextDraftContext); }
export function EditorialDraftProvider({ children }: { children: ReactNode }) {
  const drafts = useRef<Drafts>(new Map());
  const textDrafts = useRef(new Map<string, SubsectionTextDraft>());
  return <DraftContext.Provider value={drafts.current}><TextDraftContext.Provider value={textDrafts.current}>{children}</TextDraftContext.Provider></DraftContext.Provider>;
}

// Keep unsaved inputs in memory when a lazy ancestor unmounts them. This is not
// persistence; successful edits invalidate the draft through the map revision.
export function useEditorialDraftForm(id: string) {
  const drafts = useContext(DraftContext);
  const revision = useContext(EditorialRevisionContext);
  const key = `${id}:${revision}`;
  return {
    ref: (form: HTMLFormElement | null) => {
      if (!form) return;
      for (const [name, value] of Object.entries(drafts?.get(key) ?? {})) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
      }
    },
    onChange: (event: ChangeEvent<HTMLFormElement>) => {
      const field = event.target;
      if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.type !== "hidden" && field.name) {
        drafts?.set(key, { ...drafts.get(key), [field.name]: field.value });
      }
    },
    onReset: () => { drafts?.delete(key); },
  };
}

export const EditorialRevisionContext = createContext(-1);
export function EditorialRevisionInput() {
  return <input type="hidden" name="revision" value={useContext(EditorialRevisionContext)} />;
}

export function EditorialDisclosure({ children, className, id, open = false, targets = [] }: {
  children: ReactNode[]; className?: string; id?: string; open?: boolean; targets?: string[];
}) {
  const [expanded, setExpanded] = useState(open);
  const targetKey = targets.join("|");
  useEffect(() => {
    function followAnchor() {
      const target = window.location.hash.slice(1);
      if (target && (target === id || targetKey.split("|").includes(target))) setExpanded(true);
    }
    followAnchor(); window.addEventListener("hashchange", followAnchor);
    return () => window.removeEventListener("hashchange", followAnchor);
  }, [id, targetKey]);
  return (
    <details className={className} id={id} open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      {children[0]}
      {expanded ? children.slice(1) : null}
    </details>
  );
}
