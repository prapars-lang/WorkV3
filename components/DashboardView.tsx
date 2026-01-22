
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Chart, ChartConfiguration } from 'chart.js';
import { StudentSubmission } from '../types';

interface DashboardViewProps {
  submissions: StudentSubmission[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ submissions }) => {
  const [activityFilter, setActivityFilter] = useState<'All' | 'Sports Day' | 'Children Day'>('All');
  
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);

  const stats = useMemo(() => {
    const filtered = activityFilter === 'All' 
      ? submissions 
      : submissions.filter(s => s.activityType === activityFilter);
      
    const total = filtered.length;
    const graded = filtered.filter(s => s.review?.status === 'Graded');
    const gradedCount = graded.length;
    
    const totalScore = graded.reduce((acc, curr) => acc + (curr.review?.totalScore || 0), 0);
    const avgScore = gradedCount > 0 ? (totalScore / gradedCount).toFixed(1) : '0';

    const rooms = ['Room 1', 'Room 2', 'Room 3', 'Room 4'];
    const roomPerformance = rooms.map(room => {
      const roomSubs = graded.filter(s => s.room === room);
      const avg = roomSubs.length > 0 
        ? roomSubs.reduce((acc, curr) => acc + (curr.review?.totalScore || 0), 0) / roomSubs.length 
        : 0;
      return { room, avg };
    });

    const dist = [
      { label: 'ยอดเยี่ยม (18-20)', count: graded.filter(s => (s.review?.totalScore || 0) >= 18).length, color: '#4ADE80' },
      { label: 'ดีมาก (14-17)', count: graded.filter(s => (s.review?.totalScore || 0) >= 14 && (s.review?.totalScore || 0) < 18).length, color: '#60A5FA' },
      { label: 'ผ่านเกณฑ์ (10-13)', count: graded.filter(s => (s.review?.totalScore || 0) >= 10 && (s.review?.totalScore || 0) < 14).length, color: '#FACC15' },
      { label: 'ควรปรับปรุง (0-9)', count: graded.filter(s => (s.review?.totalScore || 0) < 10).length, color: '#F87171' }
    ];

    return { total, gradedCount, avgScore, roomPerformance, dist };
  }, [submissions, activityFilter]);

  useEffect(() => {
    let charts: Chart[] = [];

    if (barChartRef.current) {
      charts.push(new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: stats.roomPerformance.map(r => r.room.replace('Room ', 'ห้อง ')),
          datasets: [{
            label: 'คะแนนเฉลี่ย',
            data: stats.roomPerformance.map(r => r.avg),
            backgroundColor: ['#A5B4FC', '#F9A8D4', '#FDE68A', '#6EE7B7'],
            borderRadius: 12,
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 20 } } }
      }));
    }

    if (pieChartRef.current) {
      charts.push(new Chart(pieChartRef.current, {
        type: 'pie',
        data: {
          labels: ['ตรวจแล้ว', 'รอตรวจ'],
          datasets: [{
            data: [stats.gradedCount, stats.total - stats.gradedCount],
            backgroundColor: ['#6EE7B7', '#E5E7EB'],
            borderWidth: 0,
          }]
        },
        options: { responsive: true }
      }));
    }

    if (doughnutChartRef.current) {
      charts.push(new Chart(doughnutChartRef.current, {
        type: 'doughnut',
        data: {
          labels: stats.dist.map(d => d.label),
          datasets: [{
            data: stats.dist.map(d => d.count),
            backgroundColor: stats.dist.map(d => d.color),
            borderWidth: 0,
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      }));
    }

    return () => charts.forEach(c => c.destroy());
  }, [stats]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-kids text-indigo-600 mb-2">ภาพรวมผลการเรียน 📊</h2>
          <p className="text-gray-400 font-bold uppercase text-xs italic">"ชุดข้อมูลแยกตามกิจกรรม"</p>
        </div>
        <div className="flex bg-white/50 backdrop-blur-sm p-2 rounded-3xl border-2 border-indigo-100 shadow-sm">
          <button 
            onClick={() => setActivityFilter('All')}
            className={`px-6 py-2 rounded-2xl font-bold transition-all ${activityFilter === 'All' ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-400 hover:bg-white'}`}
          >
            รวมทั้งหมด
          </button>
          <button 
            onClick={() => setActivityFilter('Sports Day')}
            className={`px-6 py-2 rounded-2xl font-bold transition-all ${activityFilter === 'Sports Day' ? 'bg-orange-500 text-white shadow-md' : 'text-orange-400 hover:bg-white'}`}
          >
            สุขศึกษา (กีฬาสี)
          </button>
          <button 
            onClick={() => setActivityFilter('Children Day')}
            className={`px-6 py-2 rounded-2xl font-bold transition-all ${activityFilter === 'Children Day' ? 'bg-cyan-500 text-white shadow-md' : 'text-cyan-400 hover:bg-white'}`}
          >
            งานวันเด็ก
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 p-6 rounded-[2.5rem] border-4 border-indigo-100 text-center">
          <p className="text-4xl mb-2">📦</p>
          <p className="text-3xl font-kids text-indigo-600">{stats.total}</p>
          <p className="text-indigo-300 font-bold text-[10px] uppercase">งานที่ส่ง</p>
        </div>
        <div className="bg-green-50 p-6 rounded-[2.5rem] border-4 border-green-100 text-center">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-3xl font-kids text-green-600">{stats.gradedCount}</p>
          <p className="text-green-300 font-bold text-[10px] uppercase">ตรวจแล้ว</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-[2.5rem] border-4 border-yellow-100 text-center">
          <p className="text-4xl mb-2">🌟</p>
          <p className="text-3xl font-kids text-yellow-600">{stats.avgScore}</p>
          <p className="text-yellow-400 font-bold text-[10px] uppercase">คะแนนเฉลี่ย</p>
        </div>
        <div className="bg-pink-50 p-6 rounded-[2.5rem] border-4 border-pink-100 text-center">
          <p className="text-4xl mb-2">⏳</p>
          <p className="text-3xl font-kids text-pink-600">{stats.total - stats.gradedCount}</p>
          <p className="text-pink-300 font-bold text-[10px] uppercase">รอตรวจ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border-4 border-gray-50 lg:col-span-2 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">🏢 คะแนนเฉลี่ยตามห้องเรียน</h3>
          <div className="h-64"><canvas ref={barChartRef}></canvas></div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] border-4 border-gray-50 shadow-sm flex flex-col justify-center">
          <h3 className="font-bold text-gray-700 mb-6 text-center">🍰 อัตราการตรวจงาน</h3>
          <div className="h-48 flex justify-center"><canvas ref={pieChartRef}></canvas></div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
