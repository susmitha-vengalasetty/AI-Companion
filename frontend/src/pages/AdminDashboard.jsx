import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import {
  Shield,
  Users,
  Folder,
  BookOpen,
  FileText,
  Sparkles,
  Activity,
  Cpu,
  RefreshCw,
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [usersData, setUsersData] = useState({ users: [], pagination: { page: 1, total: 0, pages: 1 } });
  const [activity, setActivity] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [processing, setProcessing] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usersPage, setUsersPage] = useState(1);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, healthRes, usersRes, activityRes, aiRes, procRes] = await Promise.all([
        apiFetch('/admin/overview'),
        apiFetch('/admin/health'),
        apiFetch(`/admin/users?page=${usersPage}&limit=10`),
        apiFetch('/admin/activity?limit=25'),
        apiFetch('/admin/ai-usage'),
        apiFetch('/admin/processing'),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (healthRes.success) setHealth(healthRes.data);
      if (usersRes.success) setUsersData(usersRes.data);
      if (activityRes.success) setActivity(activityRes.data);
      if (aiRes.success) setAiUsage(aiRes.data);
      if (procRes.success) setProcessing(procRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load Admin Dashboard data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [usersPage]);

  if (loading && !overview) {
    return <LoadingState message="Loading Admin Workspace & System Observability..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchAdminData} />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview & System Health', icon: Shield },
    { id: 'users', label: `Users (${usersData.pagination?.total || 0})`, icon: Users },
    { id: 'activity', label: 'Learning Activity Trail', icon: Activity },
    { id: 'ai-usage', label: 'AI Observability', icon: Cpu },
    { id: 'processing', label: 'Material Processing Queue', icon: FileText },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Admin Control Center"
        description="Platform administration, system observability, real-time metrics, user management, and AI usage logs."
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Admin Dashboard' },
        ]}
        icon={Shield}
        actions={
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchAdminData}>
            Refresh Metrics
          </Button>
        }
      />

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & SYSTEM HEALTH */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health Status Banner */}
          {health && (
            <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-blue-950/40 border border-indigo-500/30 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      System Operational Health
                      <Badge variant="success">All Systems Normal</Badge>
                    </h3>
                    <p className="text-xs text-slate-400">Backend API, Database Connection & Gemini Provider Status</p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Uptime: <strong className="text-white">{health.uptimeSeconds}s</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-400" /> Database Connection
                  </span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {health.database?.status}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Gemini API Config
                  </span>
                  <span className={health.aiProvider?.isApiKeyConfigured ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {health.aiProvider?.isApiKeyConfigured ? 'Configured' : 'Missing Key'}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between sm:col-span-2 lg:col-span-1">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-purple-400" /> Active Models
                  </span>
                  <span className="text-white font-mono text-[11px] truncate">
                    {health.aiProvider?.llmModel} / {health.aiProvider?.embeddingModel}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Platform Metrics Grid */}
          {overview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard icon={Users} title="Total Registered Users" value={overview.totalUsers} subtext="Platform learner accounts" color="blue" />
              <StatCard icon={Folder} title="Total Spaces" value={overview.totalSpaces} subtext="Active subject spaces" color="indigo" />
              <StatCard icon={BookOpen} title="Total Projects" value={overview.totalProjects} subtext="Goal-driven workspaces" color="purple" />
              <StatCard icon={FileText} title="PDF Materials" value={overview.totalMaterials} subtext="Uploaded documents" color="emerald" />
              <StatCard icon={Sparkles} title="Document Chunks" value={overview.totalChunks} subtext="768-dim indexed vectors" color="blue" />
              <StatCard icon={Activity} title="Tutor Discussions" value={overview.totalTutorConversations} subtext="Grounded AI chats" color="indigo" />
              <StatCard icon={HelpCircle} title="Quiz Attempts" value={overview.totalQuizAttempts} subtext="Adaptive practice tests" color="purple" />
              <StatCard icon={Server} title="Async Background Jobs" value={processing?.recentJobs?.length || 0} subtext="MongoDB queue records" color="emerald" />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <Card className="p-4 sm:p-6 bg-slate-900 border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> Registered Users ({usersData.pagination?.total || 0})
            </h3>
            <span className="text-xs text-slate-400">Page {usersData.pagination?.page} of {usersData.pagination?.pages}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Spaces</th>
                  <th className="p-3 text-center">Projects</th>
                  <th className="p-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersData.users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-semibold text-white truncate max-w-[150px]">{u.name}</td>
                    <td className="p-3 font-mono text-slate-400 truncate max-w-[200px]">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={u.role === 'admin' ? 'indigo' : 'secondary'}>
                        {u.role === 'admin' ? 'ADMIN' : 'USER'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-semibold text-blue-400">{u.spacesCount}</td>
                    <td className="p-3 text-center font-semibold text-indigo-400">{u.projectsCount}</td>
                    <td className="p-3 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              disabled={usersPage <= 1}
              onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-400">Page {usersPage} of {usersData.pagination?.pages || 1}</span>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              disabled={usersPage >= (usersData.pagination?.pages || 1)}
              onClick={() => setUsersPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* TAB 3: LEARNING ACTIVITY TRAIL */}
      {activeTab === 'activity' && (
        <Card className="p-4 sm:p-6 bg-slate-900 border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="w-4 h-4 text-indigo-400" /> Platform Learning Activity Trail ({activity.length} recent events)
          </h3>

          {activity.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No learning activity logged in MongoDB Atlas yet.</p>
          ) : (
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {activity.map((evt) => (
                <div key={evt._id} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="primary">{evt.eventType}</Badge>
                      <span className="font-semibold text-white truncate">{evt.userId?.name || 'User'}</span>
                      <span className="text-slate-500 hidden sm:inline">({evt.userId?.email})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">{new Date(evt.timestamp || evt.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 font-medium">{evt.description}</p>
                  {evt.projectId && (
                    <span className="text-[11px] text-indigo-400 font-semibold block">Project: {evt.projectId.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: AI OBSERVABILITY */}
      {activeTab === 'ai-usage' && (
        <div className="space-y-6">
          {aiUsage && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <StatCard icon={Cpu} title="Total Prompt & Completion Tokens" value={aiUsage.totalTokens.toLocaleString()} subtext="Processed across AI features" color="indigo" />
              <StatCard icon={Activity} title="Total AI Queries" value={aiUsage.totalQueries} subtext="Vector search & LLM generation requests" color="blue" />
            </div>
          )}

          <Card className="p-4 sm:p-6 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> AI Usage Breakdown by Feature
            </h3>

            {!aiUsage || aiUsage.breakdown.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">No AI usage records accumulated yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {aiUsage.breakdown.map((item) => (
                  <div key={item._id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-blue-400">{item._id}</span>
                      <Badge variant="info">{item.totalQueries} Queries</Badge>
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span>Prompt Tokens:</span>
                        <strong className="text-white">{item.totalPromptTokens.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Completion Tokens:</span>
                        <strong className="text-white">{item.totalCompletionTokens.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800/60">
                        <span>Total Tokens:</span>
                        <strong className="text-indigo-400 font-bold">{item.totalTokens.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: MATERIAL PROCESSING QUEUE */}
      {activeTab === 'processing' && (
        <div className="space-y-6">
          {/* Material Status Breakdown */}
          {processing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center space-y-1">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">QUEUED</span>
                <span className="text-2xl font-bold text-white">{processing.materialsByStatus.QUEUED}</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-center space-y-1">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">PROCESSING</span>
                <span className="text-2xl font-bold text-white">{processing.materialsByStatus.PROCESSING}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center space-y-1">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">READY</span>
                <span className="text-2xl font-bold text-white">{processing.materialsByStatus.READY}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center space-y-1">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">FAILED</span>
                <span className="text-2xl font-bold text-white">{processing.materialsByStatus.FAILED}</span>
              </div>
            </div>
          )}

          {/* Recent MongoDB Job Records */}
          <Card className="p-4 sm:p-6 bg-slate-900 border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" /> Recent MongoDB Job Queue Records
              </h3>
              <Badge variant="secondary">MongoDB Async Queue</Badge>
            </div>

            {!processing || processing.recentJobs.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">No job queue records found.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {processing.recentJobs.map((job) => (
                  <div key={job._id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}>
                          {job.status.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-white">{job.type}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(job.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px]">
                      <span>Job ID: <code className="text-slate-300">{job._id}</code></span>
                      <span>Attempts: <strong className="text-white">{job.attempts}/{job.maxAttempts}</strong></span>
                      {job.relatedEntityId && <span>Entity ID: <code className="text-slate-300">{job.relatedEntityId}</code></span>}
                    </div>

                    {job.lastError && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-500/20">
                        Error: {job.lastError}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
