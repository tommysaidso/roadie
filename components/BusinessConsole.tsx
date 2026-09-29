"use client";

import { useEffect, useState } from "react";
import { Camera, FileText, Loader2, Plus, ReceiptText, Send } from "lucide-react";

type Books = { totals: any; receipts: any[]; expenses: any[]; invoices: any[] };

const today = () => new Date().toISOString().slice(0, 10);

export default function BusinessConsole() {
  const [books, setBooks] = useState<Books | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [receipt, setReceipt] = useState<any>({ purchased_at: today(), category: "fuel", currency: "CAD" });
  const [invoice, setInvoice] = useState<any>({ due_date: today(), currency: "CAD", description: "Live performance" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setMsg("");
    try {
      const r = await fetch("/api/business", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sign in to view account books.");
      setBooks(d);
    } catch (e: any) {
      setBooks(null);
      setMsg(e?.message || "Could not load books.");
    }
  }

  function setFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceipt((r: any) => ({ ...r, image_data: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function post(kind: "receipt" | "invoice") {
    setBusy(true);
    setMsg("");
    try {
      const body = kind === "receipt"
        ? { kind, ...receipt }
        : {
            kind,
            client_name: invoice.client_name,
            client_email: invoice.client_email,
            due_date: invoice.due_date,
            total: invoice.total,
            tax: invoice.tax,
            currency: invoice.currency || "CAD",
            line_items: [{ description: invoice.description || "Live performance", qty: 1, rate: Number(invoice.total || 0) }],
          };
      const r = await fetch("/api/business", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed.");
      setMsg(kind === "receipt" ? "Receipt captured and expense logged." : "Invoice drafted.");
      if (kind === "receipt") setReceipt({ purchased_at: today(), category: "fuel", currency: "CAD" });
      if (kind === "invoice") setInvoice({ due_date: today(), currency: "CAD", description: "Live performance" });
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="label text-cyan">Private account books</div>
          <div className="text-xl font-black">Receipts, expenses and invoices</div>
          <p className="text-sm text-muted">Phone-first: snap the receipt, log the cost, draft the invoice. This stays on the signed-in account.</p>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-edge bg-panel2 p-3 text-sm">{msg}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Expenses" value={books ? `$${Math.round(books.totals.expenses)}` : "-"} />
        <Metric label="Tax tracked" value={books ? `$${Math.round(books.totals.tax)}` : "-"} />
        <Metric label="Invoiced" value={books ? `$${Math.round(books.totals.invoiced)}` : "-"} />
        <Metric label="Paid" value={books ? `$${Math.round(books.totals.paid)}` : "-"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2 font-bold"><Camera size={18} className="text-cyan" /> Capture receipt</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="btn bg-panel2" placeholder="Vendor" value={receipt.vendor || ""} onChange={(e) => setReceipt({ ...receipt, vendor: e.target.value })} />
            <input className="btn bg-panel2" type="date" value={receipt.purchased_at || today()} onChange={(e) => setReceipt({ ...receipt, purchased_at: e.target.value })} />
            <select className="btn bg-panel2" value={receipt.category || "fuel"} onChange={(e) => setReceipt({ ...receipt, category: e.target.value })}>
              {["fuel", "hotel", "meals", "parking", "gear", "promo", "tolls", "other"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input className="btn bg-panel2" type="number" step="0.01" placeholder="Total CAD" value={receipt.total || ""} onChange={(e) => setReceipt({ ...receipt, total: e.target.value })} />
            <input className="btn bg-panel2" type="number" step="0.01" placeholder="Tax" value={receipt.tax || ""} onChange={(e) => setReceipt({ ...receipt, tax: e.target.value })} />
            <label className="btn bg-panel2 flex cursor-pointer items-center justify-center gap-2">
              <ReceiptText size={16} />
              {receipt.image_data ? "photo ready" : "take/upload pic"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
            </label>
          </div>
          <textarea className="btn mt-2 w-full bg-panel2 text-left" placeholder="Notes: who paid, gig, route leg..." value={receipt.notes || ""} onChange={(e) => setReceipt({ ...receipt, notes: e.target.value })} />
          <button disabled={busy || !books} onClick={() => post("receipt")} className="btn btn-neon mt-3 w-full justify-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save receipt
          </button>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2 font-bold"><FileText size={18} className="text-neon" /> Draft invoice</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="btn bg-panel2" placeholder="Client / venue" value={invoice.client_name || ""} onChange={(e) => setInvoice({ ...invoice, client_name: e.target.value })} />
            <input className="btn bg-panel2" placeholder="Client email" value={invoice.client_email || ""} onChange={(e) => setInvoice({ ...invoice, client_email: e.target.value })} />
            <input className="btn bg-panel2 sm:col-span-2" placeholder="Line item" value={invoice.description || ""} onChange={(e) => setInvoice({ ...invoice, description: e.target.value })} />
            <input className="btn bg-panel2" type="number" step="0.01" placeholder="Total CAD" value={invoice.total || ""} onChange={(e) => setInvoice({ ...invoice, total: e.target.value })} />
            <input className="btn bg-panel2" type="number" step="0.01" placeholder="Tax" value={invoice.tax || ""} onChange={(e) => setInvoice({ ...invoice, tax: e.target.value })} />
            <input className="btn bg-panel2 sm:col-span-2" type="date" value={invoice.due_date || today()} onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })} />
          </div>
          <button disabled={busy || !books} onClick={() => post("invoice")} className="btn btn-neon mt-3 w-full justify-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Draft invoice
          </button>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Recent expenses" rows={books?.expenses || []} empty="No expenses yet." render={(x) => `${x.expense_date || ""} · ${x.vendor || x.category} · $${Number(x.amount || 0).toFixed(2)}`} />
        <List title="Invoices" rows={books?.invoices || []} empty="No invoices yet." render={(x) => `${x.client_name || "Client"} · $${Number(x.total || 0).toFixed(2)} · ${x.status}`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="label">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function List({ title, rows, empty, render }: { title: string; rows: any[]; empty: string; render: (x: any) => string }) {
  return (
    <section className="card p-4">
      <div className="label mb-2">{title}</div>
      {rows.length ? rows.slice(0, 8).map((x) => <div key={x.id} className="border-b border-edge py-2 text-sm last:border-0">{render(x)}</div>) : <div className="text-sm text-muted">{empty}</div>}
    </section>
  );
}
