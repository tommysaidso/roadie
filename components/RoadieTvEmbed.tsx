"use client";
import { useEffect, useState } from "react";
import EpisodePlayer from "./EpisodePlayer";

// RoadieTV as a panel inside another page.
//
// This exists because the panel used to be `<iframe src="/roadietv">`, and
// /roadietv is a full app page — so the iframe loaded the ENTIRE application
// inside the panel: sidebar, hub badge, stat header, footer, a second Ask
// ROADIE. You got the whole shell twice on one screen.
//
// Client component on purpose. The PIT is "use client", so a server component
// reading the manifest off disk with node:fs cannot be imported there — webpack
// tries to bundle node:fs for the browser and the build dies. The manifest
// lives in public/, so it is just a static file we can fetch like any other.

export default function RoadieTvEmbed({ className }: { className?: string }) {
  const [manifest, setManifest] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/roadietv/ep01/manifest.json")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(m => { if (live) setManifest(m); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) {
    return <div className={className}>
      <div className="text-sm text-muted">The episode hasn&apos;t been rendered yet.</div>
    </div>;
  }
  if (!manifest) {
    return <div className={className}>
      <div className="text-sm text-muted">Loading the episode…</div>
    </div>;
  }

  return (
    <div className={className}>
      <EpisodePlayer manifest={manifest} base="/roadietv/ep01" />
    </div>
  );
}
