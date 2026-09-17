import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Folder, Plus, ChevronRight, Layers, Shield } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';

export const Sidebar = ({ isOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDescription, setSpaceDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  const fetchSpaces = async () => {
    try {
      const response = await apiFetch('/spaces');
      if (response.success) {
        setSpaces(response.data);
      }
    } catch (err) {
      console.error('Failed to load spaces in sidebar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [location.pathname]);

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!spaceName.trim()) return;

    setCreateLoading(true);
    setError('');
    try {
      const response = await apiFetch('/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: spaceName, description: spaceDescription }),
      });
      if (response.success) {
        setSpaceName('');
        setSpaceDescription('');
        setIsModalOpen(false);
        await fetchSpaces();
        navigate(`/spaces/${response.data._id}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create Space');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 max-w-[85vw] md:max-w-none bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Main Navigation Links */}
          <nav className="space-y-1">
            <Link
              to="/"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                location.pathname === '/'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              Home Dashboard
            </Link>

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 text-indigo-400" />
                Admin Dashboard
              </Link>
            )}
          </nav>

          {/* Spaces List Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Spaces ({spaces.length})
              </span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-slate-400 hover:text-blue-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
                title="Create New Space"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="px-3 py-2 text-xs text-slate-500 animate-pulse">Loading spaces...</div>
            ) : spaces.length === 0 ? (
              <div className="mx-2 p-3 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-400 space-y-2">
                <p>No spaces created yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={() => setIsModalOpen(true)}
                  className="w-full text-xs"
                >
                  Create Space
                </Button>
              </div>
            ) : (
              <div className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
                {spaces.map((space) => {
                  const isActive = location.pathname.startsWith(`/spaces/${space._id}`);
                  return (
                    <Link
                      key={space._id}
                      to={`/spaces/${space._id}`}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm transition-all group ${
                        isActive
                          ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">{space.name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 shrink-0 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          AI Study Companion &copy; 2026
        </div>
      </aside>

      {/* Modal for Creating Space */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Learning Space"
        description="Spaces organize your learning subjects, goals, and projects."
      >
        <form onSubmit={handleCreateSpace} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}
          <Input
            label="Space Name"
            placeholder="e.g. Machine Learning, Medical Prep, UPSC"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            required
            autoFocus
          />
          <Textarea
            label="Description (Optional)"
            placeholder="What is the main focus of this learning space?"
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
    </>
  );
};
