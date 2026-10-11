import { label } from '../../types';

export interface Row {
  key: string;
  count: number;
  name?: string;
}

/** Horizontal bars; each bar is colored by its key (bar-passed, bar-critical…). */
export function BarChart({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="card chart">
      <h2>{title}</h2>
      {rows.map(({ key, count, name }) => (
        <div className="chart-row" key={key}>
          <span>{name ?? label(key)}</span>
          <div className="bar-track">
            <div
              className={`bar bar-${key.toLowerCase()}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <strong>{count}</strong>
        </div>
      ))}
    </section>
  );
}

/** One stacked bar showing how a set splits across statuses. */
export function Progress({ rows }: { rows: Row[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <div className="progress-wrap">
      <div
        className="progress"
        role="img"
        aria-label={rows.map((r) => `${r.count} ${label(r.key)}`).join(', ')}
      >
        {rows.map(
          (r) =>
            r.count > 0 && (
              <span
                key={r.key}
                className={`bar-${r.key.toLowerCase()}`}
                style={{ width: `${(r.count / Math.max(total, 1)) * 100}%` }}
              />
            ),
        )}
      </div>
      <div className="legend">
        {rows.map((r) => (
          <span key={r.key}>
            <i className={`bar-${r.key.toLowerCase()}`} />
            {r.name ?? label(r.key)} <strong>{r.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Kpi({
  name,
  value,
  hint,
  tone,
}: {
  name: string;
  value: string | number;
  hint?: string;
  tone?: 'good' | 'bad' | 'warn';
}) {
  return (
    <section className={`card kpi ${tone ?? ''}`}>
      <p>{name}</p>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </section>
  );
}
