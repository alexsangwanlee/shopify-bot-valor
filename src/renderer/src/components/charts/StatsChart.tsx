import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface StatsChartPoint {
  time: string;
  success: number;
  failed: number;
}

export const StatsChart: React.FC<{ data: StatsChartPoint[] }> = ({ data }) => {
  return (
    <div className="mt-4 h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ffd0" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ffd0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111113',
              border: '1px solid #ffffff10',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="success"
            stroke="#00ffd0"
            fillOpacity={1}
            fill="url(#colorSuccess)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="failed"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorFailed)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
