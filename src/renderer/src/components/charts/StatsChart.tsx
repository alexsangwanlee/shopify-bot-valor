/**
 * @file src/renderer/src/components/charts/StatsChart.tsx
 * @description Recharts를 사용한 실시간 성공률 및 CPM 시각화
 */

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { time: '14:00', success: 400, failed: 240 },
  { time: '14:10', success: 300, failed: 139 },
  { time: '14:20', success: 200, failed: 980 },
  { time: '14:30', success: 278, failed: 390 },
  { time: '14:40', success: 189, failed: 480 },
  { time: '14:50', success: 239, failed: 380 },
  { time: '15:00', success: 349, failed: 430 },
];

export const StatsChart: React.FC = () => {
  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ffd0" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00ffd0" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#111113', 
              border: '1px solid #ffffff10',
              borderRadius: '8px',
              fontSize: '12px'
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
