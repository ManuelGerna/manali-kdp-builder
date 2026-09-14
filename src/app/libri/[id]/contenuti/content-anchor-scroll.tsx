"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getSafeTargetId(value: string | null) {
  const targetId = value?.trim().replace(/^#/, "");

  if (!targetId || !/^[A-Za-z0-9_-]+$/.test(targetId)) {
    return null;
  }

  return targetId;
}

export function ContentAnchorScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const focus = searchParams.get("focus");

  useEffect(() => {
    let cancelled = false;
    let didScroll = false;

    const scrollToTarget = () => {
      if (cancelled || didScroll) {
        return;
      }

      const targetId = getSafeTargetId(window.location.hash) ?? getSafeTargetId(focus);
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) {
        return;
      }

      let container: HTMLElement | null = target;
      while (container) {
        if (container instanceof HTMLDetailsElement) container.open = true;
        container = container.parentElement;
      }

      target.scrollIntoView({
        block: "start",
        inline: "nearest",
      });
      didScroll = true;
    };

    const frameId = window.requestAnimationFrame(scrollToTarget);
    const onHashChange = () => {
      didScroll = false;
      scrollToTarget();
    };
    window.addEventListener("hashchange", onHashChange);
    const timeoutIds = [75, 250, 600].map((delay) =>
      window.setTimeout(scrollToTarget, delay),
    );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("hashchange", onHashChange);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [focus, pathname, searchKey]);

  return null;
}
