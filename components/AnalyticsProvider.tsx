"use client";

/**
 * PostHog product analytics. Never required for the game to function — without
 * a token every call is a no-op. Meaningful funnel events only, no autocapture.
 */
import { useEffect } from "react";
import posthog from "posthog-js";

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialised = false;

export function AnalyticsProvider() {
  useEffect(() => {
    if (!TOKEN || initialised) return;
    posthog.init(TOKEN, {
      api_host: HOST,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      autocapture: false,
    });
    initialised = true;
  }, []);
  return null;
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!TOKEN) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break gameplay.
  }
}
