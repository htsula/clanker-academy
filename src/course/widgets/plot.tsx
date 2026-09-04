import { z } from 'zod'
import { noHtml } from '../schema'

// plot@1.0 — parameters only. The widget takes data points, axis labels and
// ranges, never content and never code. A function source would be executable
// content (§3.3), so "data or a function" in the M0 sketch is implemented as
// data: the generator discretises any function into points at generation time.
// Unrecognized parameters are refused by .strict().

const point = z.tuple([z.number(), z.number()])

export const plotParamsSchema = z
  .object({
    series: z
      .array(
        z.object({
          label: noHtml.optional(),
          points: z.array(point).min(1),
        }),
      )
      .min(1),
    title: noHtml.optional(),
    xlabel: noHtml.optional(),
    ylabel: noHtml.optional(),
    xmin: z.number().optional(),
    xmax: z.number().optional(),
    ymin: z.number().optional(),
    ymax: z.number().optional(),
  })
  .strict()

export type PlotParams = z.infer<typeof plotParamsSchema>

const W = 480
const H = 320
const M = 44

function scale(v: number, lo: number, hi: number): number {
  return (v - lo) / (hi - lo)
}

function fmt(v: number): string {
  return v.toFixed(Number.isInteger(v) ? 0 : 1)
}

export function PlotWidget({ params }: { params: PlotParams }) {
  const allX = params.series.flatMap((s) => s.points.map((p) => p[0]))
  const allY = params.series.flatMap((s) => s.points.map((p) => p[1]))

  const lo = Math.min(...allX)
  const hi = Math.max(...allX)
  const loY = Math.min(...allY)
  const hiY = Math.max(...allY)

  const xmin = params.xmin ?? lo - (hi - lo || 1) * 0.08
  const xmax = params.xmax ?? hi + (hi - lo || 1) * 0.08
  const ymin = params.ymin ?? loY - (hiY - loY || 1) * 0.08
  const ymax = params.ymax ?? hiY + (hiY - loY || 1) * 0.08

  const fx = (x: number) => M + scale(x, xmin, xmax) * (W - 2 * M)
  const fy = (y: number) => H - M - scale(y, ymin, ymax) * (H - 2 * M)

  const x0 = fx(0)
  const y0 = fy(0)

  const xticks = 5
  const yticks = 4

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="plot-widget"
      role="img"
      aria-label={params.title ?? 'plot'}
    >
      {params.title ? (
        <text x={W / 2} y={18} textAnchor="middle" className="plot-title">
          {params.title}
        </text>
      ) : null}

      {Array.from({ length: yticks + 1 }, (_, i) => {
        const y = ymin + (i / yticks) * (ymax - ymin)
        return (
          <text key={`y${i}`} x={M - 8} y={fy(y) + 4} textAnchor="end" className="plot-tick">
            {fmt(y)}
          </text>
        )
      })}

      {Array.from({ length: xticks + 1 }, (_, i) => {
        const x = xmin + (i / xticks) * (xmax - xmin)
        return (
          <text key={`x${i}`} x={fx(x)} y={H - M + 16} textAnchor="middle" className="plot-tick">
            {fmt(x)}
          </text>
        )
      })}

      <line x1={M} y1={y0} x2={W - M} y2={y0} className="plot-axis" />
      <line x1={x0} y1={M} x2={x0} y2={H - M} className="plot-axis" />

      {params.series.map((series, i) => {
        const points = series.points.map(([x, y]) => `${fx(x)},${fy(y)}`).join(' ')
        return (
          <g key={i}>
            <polyline points={points} fill="none" className={`plot-series plot-series-${i % 3}`} />
            {series.label ? (
              <text x={W - M} y={H - M + 34 + i * 14} textAnchor="end" className="plot-legend">
                {series.label}
              </text>
            ) : null}
          </g>
        )
      })}

      {params.xlabel ? (
        <text x={W / 2} y={H - 6} textAnchor="middle" className="plot-axis-label">
          {params.xlabel}
        </text>
      ) : null}
      {params.ylabel ? (
        <text x={14} y={H / 2} textAnchor="middle" className="plot-axis-label" transform={`rotate(-90 14 ${H / 2})`}>
          {params.ylabel}
        </text>
      ) : null}
    </svg>
  )
}