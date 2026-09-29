import Link from "next/link";
import { Page } from "@/components/ui";
import { ensureRtvSchema } from "@/lib/rtv";
import RTV from "@/components/RTV";

export const dynamic = "force-dynamic";

export default function RtvPage() {
  ensureRtvSchema();
  return (
    <Page
      title="RTV"
      sub="Band videos, back to back. Send us something you already have — it plays here with your name, your town and a link straight back to you."
      actions={<Link href="/gigbag" className="btn btn-neon">Submit a video</Link>}
    >
      <RTV />
    </Page>
  );
}
