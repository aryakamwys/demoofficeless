"use client";

import React from 'react';
import { useDashboardStore } from '@/store/dashboard-store';
import { ArrowUp, ArrowDown, ThumbsUp, AlertCircle } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

export default function DarkFixedDashboard() {
  const store = useDashboardStore();
  const rawData = store.rawData;

  // Use raw data to get some dynamic counts if possible, else fallback
  const totalTickets = rawData.length > 0 ? rawData.length : 23;
  const openTickets = rawData.filter(d => d.Status === 'Open' || d.status === 'Open').length || 16;
  const csatScore = 89; 

  const gaugeOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '100%',
        center: ['50%', '70%'],
        pointer: { show: true, width: 5, itemStyle: { color: '#fff' } },
        progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { color: '#4ade80' } },
        axisLine: { lineStyle: { width: 20, color: [[1, '#3f4158']] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: true, distance: 20, color: '#94a3b8', fontSize: 10, formatter: '{value}%' },
        title: { show: false },
        detail: { show: true, valueAnimation: true, offsetCenter: [0, '30%'], fontSize: 24, color: '#fff', formatter: '{value}%' },
        data: [{ value: 84 }]
      }
    ]
  };

  const lineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['New', 'Closed'], textStyle: { color: '#94a3b8' }, right: 0, top: 0, icon: 'circle', itemWidth: 8 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      axisLabel: { color: '#94a3b8' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#3f4158', type: 'solid' } }
    },
    series: [
      { name: 'New', type: 'line', smooth: false, data: [18, 14, 10, 22, 23, 29, 30], lineStyle: { color: '#38bdf8', width: 2 }, symbol: 'none' },
      { name: 'Closed', type: 'line', smooth: false, data: [10, 20, 11, 15, 20, 26, 24], lineStyle: { color: '#fcd34d', width: 2 }, symbol: 'none' }
    ]
  };

  const topSolvers = [
    { name: 'Reece Martin', solved: 37 },
    { name: 'Robyn Mers', solved: 34 },
    { name: 'Julia Smith', solved: 27 },
    { name: 'Ebeneezer Grey', solved: 24 },
    { name: 'Marlon Brown', solved: 23 },
    { name: 'Heather Banks', solved: 21 },
  ];

  const feedback = [
    { text: "Thanks for exchanging my item so promptly", time: "an hour ago" },
    { text: "Super fast resolution, thank you!", time: "an hour ago" },
    { text: "Great service as always", time: "3 hours ago" },
    { text: "Helpful and efficient. Great service!", time: "4 hours ago" },
    { text: "Fast and efficient, thanks.", time: "2 days ago" },
  ];

  const agentStatus = [
    { name: 'Ash Monk', status: 'Offline' },
    { name: 'Danica Johnson', status: 'Away' },
    { name: 'Ebeneezer Grey', status: 'Taking call' },
    { name: 'Frank Massey', status: 'Online' },
    { name: 'Heather Banks', status: 'Taking call' },
    { name: 'Julia Smith', status: 'Taking call' },
    { name: 'Marlon Brown', status: 'Taking call' },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#222336] p-6 text-slate-200 font-sans -m-6 rounded-tl-lg">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 w-8 h-8 rounded-md flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-wide">Customer service</h1>
        </div>
        <div className="text-2xl text-slate-300 font-medium tracking-wide">11:41</div>
      </div>

      <div className="grid grid-cols-12 gap-5 max-w-full">
        
        {/* ROW 1 */}
        {/* Live Tickets */}
        <div className="col-span-3 bg-[#2d2f45] rounded-lg p-5 flex flex-col relative border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Live tickets</h3>
          <div className="text-[5rem] font-bold text-white mb-2 leading-none">{totalTickets}</div>
          <div className="text-slate-400 text-lg mb-6">Open</div>
          <div className="mt-auto border border-red-500/30 bg-[#35283c] rounded p-4 relative">
            <div className="text-4xl font-bold text-white leading-none mb-1">{openTickets}</div>
            <div className="text-slate-400 text-sm">Unassigned</div>
            <div className="absolute -right-3 -bottom-3 bg-red-500 text-white rounded-full p-1 border-4 border-[#2d2f45]">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Resp. time today */}
        <div className="col-span-3 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-6">Resp. time today</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[4.5rem] font-bold text-white leading-none">9</span>
            <span className="text-2xl text-slate-300 font-semibold">m</span>
          </div>
          <div className="text-slate-400 text-sm mb-3">FRT</div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-8 font-medium">
            <ArrowUp className="w-3 h-3 text-red-400" />
            <span className="text-red-400">11%</span> vs yesterday
          </div>
          <div className="text-[4rem] font-bold text-white mb-1 mt-auto leading-none">95<span className="text-3xl">%</span></div>
          <div className="text-slate-400 text-sm">Within SLA</div>
        </div>

        {/* CSAT */}
        <div className="col-span-3 flex gap-4">
          <div className="flex-1 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">CSAT</h3>
            <div className="flex-1 -mt-4 -mx-4 relative">
              <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
          <div className="w-[45%] bg-[#35283c] rounded-lg p-5 flex flex-col border border-red-500/30 relative shadow-md">
            <div className="text-5xl font-bold text-white mb-1 mt-auto leading-none tracking-tight">{csatScore}<span className="text-3xl">%</span></div>
            <div className="text-slate-300 text-sm mt-2">CSAT today</div>
            <div className="absolute -right-3 -bottom-3 bg-red-500 text-white rounded-full p-1 border-4 border-[#222336]">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Top ticket solvers */}
        <div className="col-span-3 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-5">Top ticket solvers</h3>
          <div className="flex justify-between text-xs text-slate-400 border-b border-[#3f4158] pb-3 mb-3">
            <span>Name</span>
            <span>Solved</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {topSolvers.map((solver, i) => (
              <div key={i} className="flex justify-between items-center text-[13px]">
                <span className="text-slate-300">{solver.name}</span>
                <span className="text-white font-medium">{solver.solved}</span>
              </div>
            ))}
          </div>
        </div>


        {/* ROW 2 */}
        {/* New tickets vs closed */}
        <div className="col-span-5 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">New tickets vs closed</h3>
          <div className="flex-1 -ml-3">
            <ReactECharts option={lineOption} style={{ height: '300px', width: '100%' }} />
          </div>
        </div>

        {/* Customer feedback */}
        <div className="col-span-4 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-5">Customer feedback</h3>
          <div className="flex flex-col divide-y divide-[#3f4158]">
            {feedback.map((fb, i) => (
              <div key={i} className="py-3.5 flex gap-3.5 items-start first:pt-0">
                <div className="bg-blue-500/90 rounded-full p-2 mt-0.5 shrink-0 shadow-sm">
                  <ThumbsUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[13px] text-slate-200 mb-1">{fb.text}</div>
                  <div className="text-[11px] text-slate-400">{fb.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-2 flex justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
            <div className="w-2 h-2 rounded-full bg-slate-600"></div>
          </div>
        </div>

        {/* Agent status */}
        <div className="col-span-3 bg-[#2d2f45] rounded-lg p-5 flex flex-col border border-[#3f4158] shadow-md">
          <h3 className="text-sm font-semibold text-slate-200 mb-5">Agent status</h3>
          <div className="flex justify-between text-xs text-slate-400 border-b border-[#3f4158] pb-3 mb-3">
            <span>Name</span>
            <span>Status</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {agentStatus.map((agent, i) => (
              <div key={i} className="flex justify-between items-center text-[13px]">
                <span className="text-slate-300">{agent.name}</span>
                <span className="text-slate-300">{agent.status}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
