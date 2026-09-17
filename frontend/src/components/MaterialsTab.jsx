import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../api/client';
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  Sparkles,
  Search,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';
import { ErrorState } from './ui/ErrorState';

export const MaterialsTab = ({ projectId }) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // RAG Search Tester State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);

  // Selected Material for Details Preview Modal
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialDetails, setMaterialDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fileInputRef = useRef(null);

  const fetchMaterials = async (isBackgroundPoll = false) => {
    if (!isBackgroundPoll) setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/projects/${projectId}/materials`);
      if (response.success) {
        setMaterials(response.data);
      }
    } catch (err) {
      if (!isBackgroundPoll) setError(err.message || 'Failed to load project materials');
    } finally {
      if (!isBackgroundPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [projectId]);

  // Live polling interval for materials in QUEUED or PROCESSING status
  useEffect(() => {
    const hasActiveJobs = materials.some(
      (m) => m.status === 'QUEUED' || m.status === 'PROCESSING'
    );

    let pollInterval;
    if (hasActiveJobs) {
      pollInterval = setInterval(() => {
        fetchMaterials(true);
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [materials, projectId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF document (.pdf).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds 25MB limit.');
      return;
    }

    setUploadError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`/api/projects/${projectId}/materials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'PDF Upload failed');
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchMaterials();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (materialId) => {
    try {
      await apiFetch(`/materials/${materialId}/retry`, { method: 'POST' });
      await fetchMaterials();
    } catch (err) {
      alert(err.message || 'Failed to retry processing');
    }
  };

  const handleDelete = async (materialId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}" and all its extracted document chunks?`)) {
      return;
    }

    try {
      await apiFetch(`/materials/${materialId}`, { method: 'DELETE' });
      await fetchMaterials();
    } catch (err) {
      alert(err.message || 'Failed to delete material');
    }
  };

  const handleInspectMaterial = async (material) => {
    setSelectedMaterial(material);
    setDetailsLoading(true);
    try {
      const response = await apiFetch(`/materials/${material._id}`);
      if (response.success) {
        setMaterialDetails(response.data);
      }
    } catch (err) {
      alert(err.message || 'Failed to fetch material details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRAGSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);
    try {
      const response = await apiFetch(`/projects/${projectId}/search`, {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          topK: 5,
        }),
      });

      if (response.success) {
        setSearchResult(response.data);
      }
    } catch (err) {
      alert(err.message || 'RAG search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <LoadingState message="Loading materials knowledge base..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchMaterials} />;
  }

  const hasReadyMaterials = materials.some((m) => m.status === 'READY');

  return (
    <div className="space-y-8">
      {/* Upload Header Card */}
      <Card className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/30 border-blue-500/20 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge variant="primary">PDF Processing & RAG Pipeline</Badge>
              <span className="text-xs text-slate-400">Page-Aware Vector Index</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Project Learning Materials</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Upload PDF textbooks, lecture slides, or notes. The system extracts page-aware chunks and vector embeddings so the AI Tutor can ground answers with exact page citations.
            </p>
          </div>

          <div className="shrink-0 space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-file-upload"
            />
            <Button
              variant="primary"
              size="md"
              icon={Upload}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="shadow-lg shadow-blue-600/20"
            >
              {uploading ? 'Uploading PDF...' : 'Upload PDF Document'}
            </Button>
            {uploadError && <p className="text-xs text-red-400 font-medium text-center">{uploadError}</p>}
          </div>
        </div>
      </Card>

      {/* Materials List / Grid */}
      {materials.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No learning materials added yet"
          description="Upload your first PDF document to build the page-aware knowledge base for grounded AI tutoring."
          actionLabel="Upload First PDF"
          onAction={() => fileInputRef.current?.click()}
          actionIcon={Upload}
        />
      ) : (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> Uploaded Materials ({materials.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {materials.map((mat) => {
              const isQueued = mat.status === 'QUEUED';
              const isProcessing = mat.status === 'PROCESSING';
              const isReady = mat.status === 'READY';
              const isFailed = mat.status === 'FAILED';

              return (
                <Card key={mat._id} className="flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-white truncate" title={mat.fileName}>
                            {mat.fileName}
                          </h4>
                          <span className="text-[11px] text-slate-400 block">
                            {formatFileSize(mat.fileSize)} &bull; Uploaded {new Date(mat.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      {isQueued && (
                        <Badge variant="warning" className="animate-pulse">
                          QUEUED
                        </Badge>
                      )}
                      {isProcessing && (
                        <Badge variant="primary" className="animate-pulse flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" /> PROCESSING
                        </Badge>
                      )}
                      {isReady && <Badge variant="success">READY</Badge>}
                      {isFailed && <Badge variant="danger">FAILED</Badge>}
                    </div>

                    {/* Status Detail Messages */}
                    {isProcessing && (
                      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs p-3 rounded-xl flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>Extracting PDF text and generating vector embeddings...</span>
                      </div>
                    )}

                    {isQueued && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3 rounded-xl">
                        In queue... Asynchronous background worker will begin extraction shortly.
                      </div>
                    )}

                    {isReady && (
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Grounded Vectors Active
                        </span>
                        <span className="text-slate-400">
                          <strong>{mat.pageCount}</strong> pages &bull; <strong>{mat.chunkCount}</strong> chunks
                        </span>
                      </div>
                    )}

                    {isFailed && (
                      <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle className="w-4 h-4" /> Extraction Failed
                        </div>
                        <p className="text-[11px] text-red-300 leading-relaxed">
                          {mat.failureReason || 'An unknown error occurred during PDF parsing.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <CardFooter className="pt-2">
                    <div className="flex items-center gap-2 w-full justify-between">
                      {isReady && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleInspectMaterial(mat)}
                        >
                          Inspect Chunks & Vectors
                        </Button>
                      )}

                      {isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={RefreshCw}
                          onClick={() => handleRetry(mat._id)}
                        >
                          Retry Job
                        </Button>
                      )}

                      {!isReady && !isFailed && <div />}

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(mat._id, mat.fileName)}
                        className="text-slate-400 hover:text-red-400"
                      />
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* RAG Vector Retrieval Search Tester */}
      {hasReadyMaterials && (
        <Card className="p-6 md:p-8 space-y-5 border-indigo-500/30 bg-slate-900/90 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> RAG Knowledge Retrieval Tester
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Test semantic vector search across your uploaded PDF chunks to preview retrieved evidence and confidence scores.
              </p>
            </div>
            <Badge variant="indigo" className="shrink-0">Vector Retrieval Active</Badge>
          </div>

          <form onSubmit={handleRAGSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Ask a question about your uploaded materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
                required
              />
            </div>
            <Button type="submit" variant="primary" icon={ArrowRight} loading={searchLoading} className="shrink-0 h-[42px]">
              Search Knowledge
            </Button>
          </form>

          {/* Search Result Output */}
          {searchResult && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 gap-2">
                <span>
                  Query: <strong className="text-white">"{searchResult.query}"</strong>
                </span>
                <span className="flex items-center gap-2">
                  {searchResult.isSmallTalk ? (
                    <Badge variant="primary">Small Talk Greeting</Badge>
                  ) : searchResult.hasEvidence ? (
                    <>
                      <span className="text-xs text-slate-400">Best Match: <strong className="text-blue-400">{(searchResult.bestScore * 100).toFixed(1)}%</strong></span>
                      <Badge variant="success">Evidence Found</Badge>
                    </>
                  ) : (
                    <Badge variant="danger">No Evidence Found</Badge>
                  )}
                </span>
              </div>

              {searchResult.isSmallTalk ? (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm p-4 rounded-xl flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>{searchResult.answer}</span>
                </div>
              ) : !searchResult.hasEvidence ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl space-y-1">
                  <strong className="block font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Insufficient Evidence in PDF Materials
                  </strong>
                  <p className="text-red-300 text-xs sm:text-sm">
                    {searchResult.message || `No relevant information found for "${searchResult.query}" in uploaded project materials.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* AI Synthesized Answer */}
                  {searchResult.answer && (
                    <div className="bg-slate-950 p-4 md:p-5 rounded-xl border border-indigo-500/30 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                        <Sparkles className="w-4 h-4" /> AI Synthesized Answer (Grounded in PDFs)
                      </div>
                      <div className="prose prose-invert prose-sm text-slate-100 text-xs sm:text-sm leading-relaxed">
                        <ReactMarkdown>{searchResult.answer}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Retrieved Evidence Chunks */}
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Retrieved PDF Evidence Chunks ({searchResult.results.length})
                    </span>
                    {searchResult.results.map((item, idx) => (
                      <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs sm:text-sm space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="primary">
                              {item.fileName} — Page {item.pageNumber}
                            </Badge>
                            <span className="text-xs text-slate-400">Chunk #{item.chunkIndex + 1}</span>
                          </div>
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                            Similarity: {(item.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-slate-200 leading-relaxed font-sans text-xs sm:text-sm bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 whitespace-pre-wrap">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Modal: Inspect Material & Document Chunks Preview */}
      <Modal
        isOpen={Boolean(selectedMaterial)}
        onClose={() => {
          setSelectedMaterial(null);
          setMaterialDetails(null);
        }}
        title={`Knowledge Inspection: ${selectedMaterial?.fileName}`}
        description="Extracted page-aware document chunks saved in MongoDB for RAG retrieval."
        maxWidth="max-w-2xl"
      >
        {detailsLoading ? (
          <LoadingState message="Loading page chunks..." />
        ) : materialDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Total Pages</span>
                <strong className="text-white text-base">{materialDetails.material.pageCount}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Extracted Chunks</span>
                <strong className="text-blue-400 text-base">{materialDetails.material.chunkCount}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">File Size</span>
                <strong className="text-white text-base">{formatFileSize(materialDetails.material.fileSize)}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Document Chunks Sample Preview (Page-Aware)
              </h4>

              <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
                {materialDetails.chunksPreview && materialDetails.chunksPreview.length > 0 ? (
                  materialDetails.chunksPreview.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="primary">Page {chunk.pageNumber}</Badge>
                        <span className="text-[10px] text-slate-500">Chunk #{chunk.chunkIndex + 1}</span>
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-slate-950 p-2.5 rounded border border-slate-800/80">
                        {chunk.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No chunk previews available.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedMaterial(null)}>
                Close Inspection
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
