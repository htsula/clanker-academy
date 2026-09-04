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
          points: z.array(point).min(1).max(2000),
        }),
      )
      .min(1)
      .max(20),
    title: noHtml.optional(),
    xlabel: noHtml.optional(),
    ylabel: noHtml.optional(),
    xmin: z.number().optional(),
    xmax: z.number().optional(),
    ymin: z.number().optional(),
    ymax: z.number().optional(),
  })
  .strict()
  .refine((p) => !(p.xmin !== undefined && p.xmax !== undefined && p.xmin >= p.xmax), {
    message: 'xmin must be less than xmax',
    path: ['xmin'],
  })
  .refine((p) => !(p.ymin !== undefined && p.ymax !== undefined && p.ymin >= p.ymax), {
    message: 'ymin must be less than ymax',
    path: ['ymin'],
  })

export type PlotParams = z.infer<typeof plotParamsSchema>

const W = 480
const H = 320
const M = 44

function minOf(values: number[]): number {
  return values.reduce((m, v) => (v < m ? v : m), Infinity)
}

function maxOf(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), -Infinity)
}

function scale(v: number, lo: number, hi: number): number {
  return (v - lo) / (hi - lo)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

function fmt(v: number): string {
  return v.toFixed(Number.isInteger(v) ? 0 : 1)
}

export function PlotWidget({ params }: { params: PlotParams }) {
  const allX = params.series.flatMap((s) => s.points.map((p) => p[0]))
  const allY = params.series.flatMap((s) => s.points.map((p) => p[1]))

  const lo = minOf(allX)
  const hi = maxOf(allX)
  const loY = minOf(allY)
  const hiY = maxOf(allY)

  const xmin = params.xmin ?? lo - (hi - lo || 1) * 0.08
  const xmax = params.xmax ?? hi + (hi - lo || 1) * 0.08
  const ymin = params.ymin ?? loY - (hiY - loY || 1) * 0.08
  const ymax = params.ymax ?? hiY + (hiY - loY || 1) * 0.08

  if (!(xmax > xmin) || !(ymax > ymin)) {
    return <p className="widget-param-error">invalid plot range</p>
  }

  const fx = (x: number) => M + scale(x, xmin, xmax) * (W - 2 * M)
  const fy = (y: number) => H - M - scale(y, ymin, ymax) * (H - 2 * M)

  // Axes may lie outside the plot area when the data does not straddle the
  // origin; clamp them to the frame so they never render off-canvas.
  const yAxisX = clamp(fx(0), M, W - M)
  const xAxisY = clamp(fy(0), M, H - M)

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

      <line x1={M} y1={xAxisY} x2={W - M} y2={xAxisY} className="plot-axis" />
      <line x1={yAxisX} y1={M} x2={yAxisX} y2={H - M} className="plot-axis" />

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