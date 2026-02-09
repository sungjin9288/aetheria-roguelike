// Admin Analytics Dashboard Component
// v4.0: Hybrid Strategy - Analytics offloaded to AWS Lambda
// Displays user statistics, job paths, death causes with Chart.js visualization

import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { fetchAnalyticsData } from '../services/analyticsService';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// Admin Dashboard Component
export const AdminDashboard = ({ isAdmin }) => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (!isAdmin) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const token = await getAuth().currentUser?.getIdToken();
                if (token) {
                    const data = await fetchAnalyticsData(token);
                    setAnalytics(data);
                } else {
                    console.warn('No auth token available for analytics');
                }
            } catch (e) {
                console.error('Failed to load analytics', e);
            }
            setLoading(false);
        };

        loadData();
    }, [isAdmin]);

    if (!isAdmin) return null;
    if (loading) return <div className="text-center py-4 text-slate-400">📊 서버리스 데이터 분석 중... (AWS Lambda)</div>;
    if (!analytics) return <div className="text-center py-4 text-red-400">데이터 로드 실패</div>;

    // Chart configurations
    const jobChartData = {
        labels: Object.keys(analytics.jobDistribution || {}),
        datasets: [{
            label: '플레이어 수',
            data: Object.values(analytics.jobDistribution || {}),
            backgroundColor: [
                'rgba(99, 102, 241, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(14, 165, 233, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(234, 179, 8, 0.8)',
            ],
            borderWidth: 1
        }]
    };

    const deathChartData = {
        labels: Object.keys(analytics.deathCauses || {}).slice(0, 8),
        datasets: [{
            label: '사망 횟수',
            data: Object.values(analytics.deathCauses || {}).slice(0, 8),
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1
        }]
    };

    // Note: Feedback stats might need separate handling if not included in Lambda response
    // Assuming Lambda returns basic structure. If feedback is separate, might need another call.
    // For v4.0 Demo, focusing on Job/Death stats.

    return (
        <div className="bg-slate-900 border border-indigo-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <h2 className="text-lg font-bold text-indigo-400">📊 Admin Analytics (AWS Hybrid)</h2>
                <div className="flex gap-2 text-xs">
                    {['overview', 'jobs', 'deaths'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1 rounded ${activeTab === tab ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            {tab === 'overview' ? '개요' : tab === 'jobs' ? '직업' : '사망'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800 rounded p-3 text-center">
                        <div className="text-3xl font-bold text-indigo-400">{analytics.totalUsers}</div>
                        <div className="text-xs text-slate-400">전체 유저</div>
                    </div>
                    <div className="bg-slate-800 rounded p-3 text-center">
                        <div className="text-3xl font-bold text-green-400">{analytics.avgLevel}</div>
                        <div className="text-xs text-slate-400">평균 레벨</div>
                    </div>
                    <div className="bg-slate-800 rounded p-3 text-center">
                        <div className="text-3xl font-bold text-amber-400">{Object.keys(analytics.jobDistribution || {}).length}</div>
                        <div className="text-xs text-slate-400">활성 직업</div>
                    </div>
                </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
                <div className="h-64">
                    <Doughnut data={jobChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
                </div>
            )}

            {/* Deaths Tab */}
            {activeTab === 'deaths' && (
                <div className="h-64">
                    <Bar data={deathChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } } } }} />
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
