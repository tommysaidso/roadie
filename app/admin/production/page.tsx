import ProductionHub from "./ProductionHub";

export const metadata = { title: "Production Team — Roadie Admin" };

export default function ProductionPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Production Team</h1>
        <p className="text-muted text-sm mt-1">
          Film unit roster, schedule, Canadian compliance (T4, WorkSafe BC, contracts), and crew comms.
        </p>
      </div>
      <ProductionHub />
    </main>
  );
}
