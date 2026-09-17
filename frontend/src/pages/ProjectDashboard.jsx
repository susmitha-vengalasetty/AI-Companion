import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import {
  FileText,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  BarChart2,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { MaterialsTab } from '../components/MaterialsTab';
import { TutorTab } from '../components/project/TutorTab';
import { QuizTab } from '../components/project/QuizTab';
import { GrowthTab } from '../components/project/GrowthTab';
import { AnalyticsTab } from '../components/project/AnalyticsTab';

export const ProjectDashboard = () => {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchProjectData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/projects/${projectId}/dashboard`);
      if (response.success) {
        setDashboardData(response.data);
        setEditName(response.data.project.name);
        setEditGoal(response.data.project.learningGoal || '');
        setEditDescription(response.data.project.description || '');
      }
    } catch (err) {
      setError(err.message || 'Failed to load project dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setEditLoading(true);
    try {
      const response = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          learningGoal: editGoal,
          description: editDescription,
        }),
      });

      if (response.success) {
        setIsEditModalOpen(false);
        await fetchProjectData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update project');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This will remove all materials, quizzes, and tutor history.')) {
      return;
    }
    try {
      await apiFetch(`/projects/${projectId}`, { method: 'DELETE' });
      navigate(dashboardData?.project?.spaceId ? `/spaces/${dashboardData.project.spaceId._id}` : '/');
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return <LoadingState message="Loading project workspace..." />;
  }

  if (error || !dashboardData) {
    return <ErrorState message={error || 'Project not found'} onRetry={fetchProjectData} />;
  }

  const { project, recommendedAction, materialsCount, chunksCount } = dashboardData;
  const spaceInfo = project.spaceId || {};

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: BookOpen },
    { id: 'materials', label: 'Materials', icon: FileText },
    { id: 'tutor', label: 'AI Tutor', icon: MessageSquare },
    { id: 'quiz', label: 'Adaptive Quiz', icon: HelpCircle },
    { id: 'growth', label: 'Growth & Mastery', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title={project.name}
        description={project.learningGoal ? `Goal: ${project.learningGoal}` : project.description || 'Project workspace'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          spaceInfo._id ? { label: spaceInfo.name, to: `/spaces/${spaceInfo._id}` } : { label: 'Space' },
          { label: project.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Edit2}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit Project
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleDeleteProject}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Workspace Panels */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Recommended Action Banner */}
          {recommendedAction && (
            <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/30 rounded-2xl p-5 md:p-6 flex items-start gap-4 shadow-lg">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold tracking-wider text-blue-400 block">
                  Recommended Action
                </span>
                <h3 className="text-base font-bold text-white">{recommendedAction.text}</h3>
                <p className="text-xs text-slate-400">{recommendedAction.reason}</p>
              </div>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={FileText} title="PDF Materials" value={materialsCount} subtext="Uploaded documents" color="blue" />
            <StatCard icon={Sparkles} title="Document Chunks" value={chunksCount} subtext="Page-aware extracted text" color="indigo" />
            <StatCard icon={TrendingUp} title="Est. Mastery" value="0%" subtext="Based on evidence" color="emerald" />
            <StatCard icon={MessageSquare} title="Tutor Sessions" value="0" subtext="Grounded conversations" color="purple" />
          </div>

          {/* Call to Upload Materials or Inspect Knowledge */}
          {materialsCount === 0 ? (
            <Card className="text-center py-12 px-6 space-y-4 border-dashed border-slate-700">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">Upload Learning Material (PDF)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Add lecture slides, textbooks, or notes. The system extracts page-aware chunks so the AI Tutor can provide grounded answers with exact page citations.
                </p>
              </div>
              <Button variant="primary" size="sm" icon={FileText} onClick={() => setTab('materials')}>
                Go to Materials Tab
              </Button>
            </Card>
          ) : (
            <Card className="p-6 bg-slate-900 border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Knowledge Base Active</h3>
                </div>
                <Button variant="secondary" size="sm" icon={FileText} onClick={() => setTab('materials')}>
                  Manage Materials ({materialsCount})
                </Button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {chunksCount} page-aware document chunks are indexed and ready for RAG embeddings and grounded AI tutoring.
              </p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'materials' && <MaterialsTab projectId={projectId} />}
      {activeTab === 'tutor' && <TutorTab projectId={projectId} />}
      {activeTab === 'quiz' && <QuizTab projectId={projectId} />}
      {activeTab === 'growth' && <GrowthTab projectId={projectId} />}
      {activeTab === 'analytics' && <AnalyticsTab projectId={projectId} />}

      {/* Modal: Edit Project */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Project Details"
        description="Update project name, learning goal, and description."
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <Input
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Learning Goal"
            value={editGoal}
            onChange={(e) => setEditGoal(e.target.value)}
            placeholder="e.g. Master backpropagation and regularization for midterms"
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditModalOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
