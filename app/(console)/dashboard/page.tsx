export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 p-4">
          <div className="text-sm text-muted-foreground">Today</div>
          <div className="mt-1 text-2xl font-semibold">Key KPIs</div>
        </div>
        <div className="rounded-lg border border-white/10 p-4">
          <div className="text-sm text-muted-foreground">Inventory</div>
          <div className="mt-1 text-2xl font-semibold">Status</div>
        </div>
        <div className="rounded-lg border border-white/10 p-4">
          <div className="text-sm text-muted-foreground">Offers</div>
          <div className="mt-1 text-2xl font-semibold">Campaigns</div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 p-4">
        <div className="text-sm text-muted-foreground">Recommendations</div>
        <div className="mt-2 text-sm">Your AI recommendations will appear here.</div>
      </section>
    </div>
  );
}


