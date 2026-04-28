"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ChartPoint } from "@/types";
import { formatCurrency, formatPercent } from "@/utils/format";

interface AreaChartBlockProps {
  data: ChartPoint[];
  color?: string;
  compact?: boolean;
  variant?: "currency" | "percent";
}

export function AreaChartBlock({
  data,
  color = "#f43f5e",
  compact = false,
  variant = "currency",
}: AreaChartBlockProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className={compact ? "h-32 w-full" : "h-72 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          {!compact ? (
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 8" />
          ) : null}
          <defs>
            <linearGradient id={`gainixArea-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(161,161,170,0.75)", fontSize: 12 }}
            hide={compact}
          />
          <Tooltip
            cursor={{ stroke: "rgba(244,63,94,0.25)", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(12,12,15,0.95)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            }}
            formatter={(value: number) => (variant === "currency" ? formatCurrency(value) : formatPercent(value))}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            fill={`url(#gainixArea-${gradientId})`}
            activeDot={{ r: 6, fill: color, stroke: "rgba(255,255,255,0.95)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
