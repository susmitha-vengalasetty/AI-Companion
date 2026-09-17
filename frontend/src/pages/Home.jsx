import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Sparkles,
  Folder,
  ArrowRight,
  Activity,
  Award,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDescription, setSpaceDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const loadHomeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/home');
      if (response.success) {
        setDashboard(response.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load home dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch fresh data whenever navigation key changes or component mounts
  useEffect(() => {
    loadHomeData();
  }, [location.key]);

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!spaceName.trim()) return;

    setCreateLoading(true);
    try {
      const response = await apiFetch('/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: spaceName, description: spaceDescription }),
      });
      if (response.success) {
        setSpaceName('');
        setSpaceDescription('');
        setIsModalOpen(false);
        navigate(`/spaces/${response.data._id}`);
      }
    } catch (err) {
      alert(err.message || 'Failed to create space');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading your study companion workspace..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadHomeData} />;
  }

  const { totalSpaces = 0, totalProjects = 0, latestSpace, continueLearning, recentProjects = [], recommendedNextAction } = dashboard || {};

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Welcome & Context Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/20 rounded-2xl p-4 sm:p-6 md:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">AI Study Companion</Badge>
              <span className="text-xs text-slate-400 font-medium">Interactive Learning Loop</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
              Welcome back, {user?.name || 'Learner'}!
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Organize subjects into <strong className="text-white">Spaces</strong>, define learning goals in <strong className="text-white">Projects</strong>, and engage with grounded AI tutoring.
            </p>
          </div>

          <Button
            icon={Plus}
            size="md"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 w-full sm:w-auto shadow-lg shadow-blue-600/20"
          >
            Create Space
          </Button>
        </div>

        {/* Recommended Action inside Header */}
        {recommendedNextAction && (
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">Recommended Next Action</span>
                <span className="text-xs sm:text-sm font-semibold text-white">{recommendedNextAction.title}</span>
              </div>
            </div>

            {recommendedNextAction.projectId ? (
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                onClick={() => navigate(`/projects/${recommendedNextAction.projectId}`)}
              >
                Jump In
              </Button>
            ) : recommendedNextAction.spaceId ? (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => navigate(`/spaces/${recommendedNextAction.spaceId}`)}
              >
                Go to Space
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsModalOpen(true)}>
                Start Now
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          icon={Folder}
          title="Total Spaces"
          value={totalSpaces}
          subtext="Active learning subjects"
          color="blue"
        />
        <StatCard
          icon={BookOpen}
          title="Total Projects"
          value={totalProjects}
          subtext="Goal-driven workspaces"
          color="indigo"
        />
        <StatCard
          icon={Award}
          title="Learning Status"
          value={totalProjects > 0 ? 'Active' : totalSpaces > 0 ? 'Space Ready' : 'Setup'}
          subtext="Grounded RAG workspace"
          color="emerald"
        />
      </div>

      {/* Main Grid: Continue Learning & Recent Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Continue Learning Spotlight (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" /> Continue Learning
            </h2>
          </div>

          {continueLearning ? (
            /* STATE 3: Project exists */
            <Card hover className="border-blue-500/30 hover:border-blue-500/60 transition-all p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
                    {continueLearning.spaceId?.name || 'Space'}
                  </span>
                  <h3 className="text-xl font-bold text-white">{continueLearning.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {continueLearning.description || 'No description provided.'}
                  </p>
                </div>
                <Badge variant="primary">{continueLearning.status}</Badge>
              </div>

              {continueLearning.learningGoal && (
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <strong className="text-blue-400 font-semibold">Goal:</strong> {continueLearning.learningGoal}
                </div>
              )}

              <CardFooter className="pt-3">
                <span className="text-xs text-slate-400">
                  Last active: {new Date(continueLearning.updatedAt).toLocaleDateString()}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  onClick={() => navigate(`/projects/${continueLearning._id}`)}
                >
                  Open Workspace
                </Button>
              </CardFooter>
            </Card>
          ) : totalSpaces > 0 ? (
            /* STATE 2: Space exists (totalSpaces > 0), but 0 Projects created yet */
            <Card className="border-blue-500/30 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
                    Active Space
                  </span>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Folder className="w-5 h-5 text-blue-400" /> {latestSpace ? latestSpace.name : 'Your Learning Space'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {latestSpace?.description || 'No space description provided.'}
                  </p>
                </div>
                <Badge variant="indigo">Space Ready</Badge>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <strong className="text-white font-semibold block">No projects in this Space yet</strong>
                <p className="text-slate-400">
                  Create your first learning project to begin uploading materials, taking adaptive quizzes, and asking the AI Tutor.
                </p>
              </div>

              <CardFooter className="pt-3">
                <span className="text-xs text-slate-400">
                  {latestSpace?.createdAt ? `Created: ${new Date(latestSpace.createdAt).toLocaleDateString()}` : 'Space Active'}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => navigate(latestSpace?._id ? `/spaces/${latestSpace._id}` : '/')}
                >
                  Create Project in Space
                </Button>
              </CardFooter>
            </Card>
          ) : (
            /* STATE 1: totalSpaces === 0 */
            <EmptyState
              icon={Folder}
              title="No Learning Spaces Yet"
              description="Create your first Space to organize your learning goals, materials, and projects."
              actionLabel="Create First Space"
              onAction={() => setIsModalOpen(true)}
              actionIcon={Plus}
            />
          )}
        </div>

        {/* Recent Projects & Attention Areas Sidebar (1 col) */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Recent Projects
            </h2>

            {recentProjects.length === 0 ? (
              <div className="card text-xs text-slate-400 text-center py-6 border-dashed border-slate-800">
                No projects created yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((project) => (
                  <div
                    key={project._id}
                    onClick={() => navigate(`/projects/${project._id}`)}
                    className="p-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all cursor-pointer group space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-400 font-medium">
                        {project.spaceId?.name || 'Space'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {project.learningGoal || project.description || 'No goal specified'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attention Areas Spotlight */}
          <Card className="border-indigo-500/20 bg-indigo-950/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Attention Areas</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload PDF materials to enable adaptive quiz mistake tracking and concept weakness detection.
            </p>
          </Card>
        </div>
      </div>

      {/* Modal for Creating Space */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Learning Space"
        description="Group your subjects and projects under a unified learning space."
      >
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <Input
            label="Space Name"
            placeholder="e.g. Computer Science, Medical Board Prep, UPSC"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            required
            autoFocus
          />
          <Textarea
            label="Description (Optional)"
            placeholder="What is the objective of this space?"
            value={spaceDescription}
            onChange={(e) => setSpaceDescription(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createLoading}>
              Create Space
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
