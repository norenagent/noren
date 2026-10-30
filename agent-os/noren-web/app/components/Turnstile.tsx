"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Automatic retries before the visitor is asked to retry by hand. */
const MAX_AUTO_RETRIES = 3;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (code?: string) => void;
          "timeout-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          retry?: "auto" | "never";
        },
      ) => string;
      reset: (id?: string) => void;
      remove?: (id?: string) => void;
    };
    __covTurnstileReset?: () => void;
  }
}

/** True when Turnstile is configured (site key present). */
export const turnstileEnabled = Boolean(SITE_KEY);

type Status = "verifying" | "ready" | "failed";

/**
 * Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is set. Reports the token (or null while there is none) via onToken.
 *
 * A challenge can fail for reasons outside our control (network, extensions,
 * a flaky edge). Tokens are also single use, so every submit needs a fresh
 * challenge. To keep one failure from locking a visitor out, errors and
 * timeouts are retried automatically with backoff, and after the last retry a
 * visible button lets the visitor start a new challenge by hand.
 */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  const [status, setStatus] = useState<Status>("verifying");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const restart = useCallback(() => {
    clearTimeout(timer.current);
    onTokenRef.current(null);
    setStatus("verifying");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const manualRetry = useCallback(() => {
    retries.current = 0;
    setRetrying(false);
    restart();
  }, [restart]);

  useEffect(() => {
    if (!SITE_KEY) return;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fail = () => {
      onTokenRef.current(null);
      if (retries.current < MAX_AUTO_RETRIES) {
        retries.current += 1;
        setRetrying(true);
        setStatus("verifying");
        clearTimeout(timer.current);
        timer.current = setTimeout(restart, 1200 * retries.current);
      } else {
        setStatus("failed");
      }
    };

    const render = () => {
      if (!window.turnstile || !ref.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token) => {
          retries.current = 0;
          setRetrying(false);
          setStatus("ready");
          onTokenRef.current(token);
        },
        "expired-callback": () => {
          // An unused token ages out after a few minutes: get a fresh one.
          onTokenRef.current(null);
          retries.current = 0;
          restart();
        },
        "error-callback": fail,
        "timeout-callback": fail,
        // Show the widget only when Cloudflare decides interaction is needed.
        appearance: "interaction-only",
        retry: "never", // we own the retry policy above
      });
      window.__covTurnstileReset = () => {
        retries.current = 0;
        restart();
      };
    };

    if (window.turnstile) {
      render();
    } else {
      if (!document.querySelector(`script[src="${SCRIPT}"]`)) {
        const s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
      clearTimeout(timer.current);
      // Remove this instance's widget so a remounted tab never inherits a stale
      // challenge, and the global reset hook never points at a dead widget.
      if (widgetId.current) {
        try {
          window.turnstile?.remove?.(widgetId.current);
        } catch {
          /* widget already gone */
        }
        widgetId.current = null;
      }
    };
  }, [restart]);

  if (!SITE_KEY) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div ref={ref} />
      {status === "failed" && (
        <div role="alert" data-testid="turnstile-failed" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>Human verification did not complete. This is usually a network hiccup or a blocking extension.</span>
          <button type="button" className="btn" onClick={manualRetry}>
            Try verification again
          </button>
        </div>
      )}
      {status === "verifying" && retrying && (
        <p data-testid="turnstile-retrying">Verifying again…</p>
      )}
    </div>
  );
}
