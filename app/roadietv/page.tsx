import fs from "node:fs";
import path from "node:path";
import { Page } from "@/components/ui";
import EpisodePlayer from "@/components/EpisodePlayer";
export const dynamic = "force-dynamic";

export default function RoadieTVPage() {
  let manifest: any = null;
  try {
    manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "roadietv", "ep01", "manifest.json"), "utf8")
    );
  } catch { /* not rendered yet */ }

  if (!manifest) {
    return (
      <Page title="RoadieTV" sub="Episode 01 hasn't been rendered yet.">
        <div className="card p-6 text-sm text-muted">
          Run <code>node scripts/render-roadietv.mjs --clips</code> to build the episode.
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="RoadieTV"
      sub="Episode 01 — We Bring the Ring. It runs on its own, but you can cut in at any point and ask; it answers out of the plan and picks the story back up where you left it."
    >
      <EpisodePlayer manifest={manifest} base="/roadietv/ep01" />
    </Page>
  );
}
