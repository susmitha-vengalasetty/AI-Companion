import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import {
  Folder,
  Plus,
  BookOpen,
  Trash2,
  Edit2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';

export const SpaceDashboard = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();

  const [space, setSpace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [createProjectLoading, setCreateProjectLoading] = useState(false);

  // Edit Space Modal State
  const [isEditSpaceModalOpen, setIsEditSpaceModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editLoading, setEditLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [spaceRes, projectsRes] = await Promise.all([
        apiFetch(`/spaces/${spaceId}`),
        apiFetch(`/spaces/${spaceId}/projects`),
      ]);

      if (spaceRes.success) {
        setSpace(spaceRes.data);
        setEditName(spaceRes.data.name);
        setEditDescription(spaceRes.data.description || '');
        setEditColor(spaceRes.data.visualCustomization?.color || '#3B82F6');
      }
      if (projectsRes.success) setProjects(projectsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load Space data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [spaceId]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreateProjectLoading(true);
    try {
      const response = await apiFetch(`/spaces/${spaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: projectName,
          learningGoal: projectGoal,
          description: projectDescription,
        }),
      });

      if (response.success) {
        setProjectName('');
        setProjectGoal('');
        setProjectDescription('');
        setIsProjectModalOpen(false);
        await fetchData();
        navigate(`/projects/${response.data._id}?tab=materials`);
      }
    } catch (err) {
      alert(err.message || 'Failed to create project');
    } finally {
      setCreateProjectLoading(false);
    }
  };

  const handleUpdateSpace = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setEditLoading(true);
    try {
      const response = await apiFetch(`/spaces/${spaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          visualCustomization: { color: editColor, icon: 'folder' },
        }),
      });

      if (response.success) {
        setSpace(response.data);
        setIsEditSpaceModalOpen(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to update space');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!window.confirm('Are you sure you want to delete this space and all its projects? This cannot be undone.')) {
      return;
    }
    try {
      await apiFetch(`/spaces/${spaceId}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      alert(err.message || 'Failed to delete space');
    }
  };

  if (loading) {
    return <LoadingState message="Loading space workspace..." />;
  }

  if (error || !space) {
    return <ErrorState message={error || 'Space not found'} onRetry={fetchData} />;
  }

  const colorOptions = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Page Header */}
      <PageHeader
        title={space.name}
        description={space.description || 'Manage projects, learning goals, and progress in this space.'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Space' },
          { label: space.name },
        ]}
        icon={Folder}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Edit2}
              onClick={() => setIsEditSpaceModalOpen(true)}
            >
              Edit Space
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsProjectModalOpen(true)}
            >
              New Project
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleDeleteSpace}
              title="Delete Space"
            />
          </div>
        }
      />

      {/* Projects Grid Section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" /> Projects in this Space ({projects.length})
          </h2>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center py-8 sm:py-12 px-4 sm:px-6 border-dashed border-slate-700 bg-slate-900/50 space-y-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-white">No Projects in "{space.name}" yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                To upload PDFs and ask questions to your AI Tutor, create a Project inside this Space. Projects hold your PDF documents, chunk embeddings, tutor sessions, and adaptive quizzes.
              </p>
            </div>

            {/* Step-by-step Learning Flow Banner */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-lg mx-auto text-left text-xs space-y-2">
              <span className="font-bold text-blue-400 uppercase tracking-wider text-[11px] block">
                How Learning Spaces Work:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="font-bold text-white block">1. Space</span>
                  <span className="text-[10px] text-slate-400 truncate block">{space.name}</span>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <span className="font-bold text-blue-300 block">2. Project</span>
                  <span className="text-[10px] text-blue-400">Subject/Topic</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="font-bold text-white block">3. Upload PDF</span>
                  <span className="text-[10px] text-slate-400">RAG Tutor</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => setIsProjectModalOpen(true)}
              >
                Create First Project
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <Card key={proj._id} hover className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="primary">{proj.status}</Badge>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight">{proj.name}</h3>

                  {proj.learningGoal && (
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 text-xs text-slate-300">
                      <strong className="text-blue-400 font-semibold block mb-0.5">Goal:</strong>
                      <p className="line-clamp-2 leading-relaxed">{proj.learningGoal}</p>
                    </div>
                  )}

                  {proj.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{proj.description}</p>
                  )}
                </div>

                <CardFooter className="pt-3">
                  <span className="text-xs text-slate-400 font-medium">Ready for RAG</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowRight}
                    onClick={() => navigate(`/projects/${proj._id}`)}
                  >
                    Open Workspace
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Project */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title={`Create Project in "${space.name}"`}
        description="A project focuses on a specific topic, course, or examination."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Neural Networks & Deep Learning"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Learning Goal"
            placeholder="e.g. Master backpropagation and regularization for midterms"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
          />
          <Textarea
            label="Description (Optional)"
            placeholder="Scope, course materials included, or target outcomes..."
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsProjectModalOpen(false)}
              disabled={createProjectLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createProjectLoading}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Space */}
      <Modal
        isOpen={isEditSpaceModalOpen}
        onClose={() => setIsEditSpaceModalOpen(false)}
        title="Edit Space"
        description="Update space name, description, and visual accent."
      >
        <form onSubmit={handleUpdateSpace} className="space-y-4">
          <Input
            label="Space Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Theme Accent Color</label>
            <div className="flex items-center gap-3 pt-1">
              {colorOptions.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setEditColor(col)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    editColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditSpaceModalOpen(false)}
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
