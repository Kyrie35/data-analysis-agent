import type { MetricItem } from "@/lib/api";

type MetricsCardsProps = {
  metrics: MetricItem[];
};

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">关键指标</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {metric.value}
            </p>
            {metric.description && (
              <p className="mt-2 text-xs text-slate-400">{metric.description}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
