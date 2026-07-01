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
    const targetId =
      getSafeTargetId(focus) ?? getSafeTargetId(window.location.hash);

    if (!targetId) {
      return;
    }

    let cancelled = false;
    let didScroll = false;

    const scrollToTarget = () => {
      if (cancelled || didScroll) {
        return;
      }

      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      target.scrollIntoView({
        block: "start",
        inline: "nearest",
      });
      didScroll = true;
    };

    const frameId = window.requestAnimationFrame(scrollToTarget);
    const timeoutIds = [75, 250, 600].map((delay) =>
      window.setTimeout(scrollToTarget, delay),
    );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [focus, pathname, searchKey]);

  return null;
}
