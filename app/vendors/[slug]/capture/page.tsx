import { notFound } from "next/navigation";
import { Page } from "@/components/ui";
import { loadVendor } from "@/lib/vendorPage";
import VendorCapture from "./VendorCapture";

export const dynamic = "force-dynamic";
export const metadata = { title: "Floor capture", robots: { index: false } };

// The vendor's own camera: record on the shop floor with a phone, and the clip lands in
// their page's showcase. Opened with the private link from scripts/vendor-key.mjs.
export default async function CapturePage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ key?: string }>;
}) {
  const { slug } = await params;
  const { key } = await searchParams;
  const v = loadVendor(slug);
  if (!v) notFound();
  return (
    <Page title={`${v.name}: floor capture`} sub="Shoot the instruments, the bench and the playing. Clips go straight to your page's showcase.">
      <VendorCapture slug={slug} name={v.name} capKey={key || ""} />
    </Page>
  );
}
