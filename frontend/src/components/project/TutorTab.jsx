import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../../api/client';
import { Send, Sparkles, MessageSquare, Plus, Trash2, FileText, AlertCircle, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/LoadingState';

export const TutorTab = ({ projectId }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const messagesEndRef = useRef(null);

  const toggleEvidence = (idx) => {
    setExpandedEvidence((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Fetch list of conversations for this project
  const fetchConversations = async (selectId = null) => {
    try {
      const response = await apiFetch(`/projects/${projectId}/tutor/conversations`);
      if (response.success) {
        const convList = response.conversations || [];
        setConversations(convList);

        if (convList.length > 0) {
          const targetId = selectId || activeConversationId || convList[0]._id;
          const targetExists = convList.some((c) => c._id === targetId);
          const activeId = targetExists ? targetId : convList[0]._id;
          setActiveConversationId(activeId);
          await loadConversationMessages(activeId);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversation list:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load message history for a specific conversation
  const loadConversationMessages = async (conversationId) => {
    try {
      const response = await apiFetch(`/projects/${projectId}/tutor/conversations/${conversationId}`);
      if (response.success) {
        setMessages(response.conversation?.messages || []);
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = async () => {
    setCreateLoading(true);
    try {
      const response = await apiFetch(`/projects/${projectId}/tutor/conversations`, {
        method: 'POST',
        body: JSON.stringify({ title: 'New Discussion' }),
      });
      if (response.success) {
        const newConv = response.conversation;
        setActiveConversationId(newConv._id);
        setMessages([]);
        await fetchConversations(newConv._id);
      }
    } catch (err) {
      alert(err.message || 'Failed to create new conversation');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSelectConversation = async (convId) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    await loadConversationMessages(convId);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery('');
    setLoading(true);

    // Optimistic UI update
    const tempUserMsg = { role: 'user', content: userText, timestamp: new Date() };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let endpoint = `/projects/${projectId}/tutor/ask`;
      if (activeConversationId) {
        endpoint = `/projects/${projectId}/tutor/conversations/${activeConversationId}/messages`;
      }

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ query: userText }),
      });

      if (response.success) {
        if (response.conversationId) {
          setActiveConversationId(response.conversationId);
        }
        setMessages(response.messages || []);
        await fetchConversations(response.conversationId || activeConversationId);
      }
    } catch (err) {
      alert(err.message || 'Failed to send question to AI Tutor');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? This will permanently remove its message history.')) {
      return;
    }

    try {
      const response = await apiFetch(`/projects/${projectId}/tutor/conversations/${convId}`, {
        method: 'DELETE',
      });
      if (response.success) {
        const remaining = conversations.filter((c) => c._id !== convId);
        setConversations(remaining);
        if (activeConversationId === convId) {
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0]._id);
            await loadConversationMessages(remaining[0]._id);
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to delete conversation');
    }
  };

  if (historyLoading) {
    return <LoadingState message="Loading AI Tutor conversations..." />;
  }

  const activeConv = conversations.find((c) => c._id === activeConversationId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
      {/* Left Sidebar: Conversations List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Conversations</h3>
          <Button variant="primary" size="sm" icon={Plus} onClick={handleNewChat} loading={createLoading}>
            New Chat
          </Button>
        </div>

        <div className="space-y-2 max-h-[220px] lg:max-h-[600px] overflow-y-auto pr-1">
          {conversations.length === 0 ? (
            <Card className="p-4 text-center text-xs text-slate-400 space-y-2 border-dashed border-slate-800">
              <MessageSquare className="w-5 h-5 mx-auto text-slate-500" />
              <p>No chat history yet.</p>
              <Button variant="outline" size="sm" icon={Plus} onClick={handleNewChat} className="w-full">
                Start First Chat
              </Button>
            </Card>
          ) : (
            conversations.map((c) => {
              const isActive = c._id === activeConversationId;
              return (
                <div
                  key={c._id}
                  onClick={() => handleSelectConversation(c._id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between space-y-2 ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors" title={c.title}>
                      {c.title || 'Discussion'}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(c._id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 p-1 rounded transition-opacity"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                    {c.lastMessageSnippet || 'No messages yet'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span>{c.messageCount} messages</span>
                    <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Main Chat Workspace */}
      <div className="lg:col-span-3 space-y-4">
        {/* Chat Header Bar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {activeConv ? activeConv.title : 'AI Tutor Workspace'}
                <Badge variant="success">Conversational AI Tutor</Badge>
              </h3>
              <p className="text-xs text-slate-400">Grounded answers derived strictly from project materials</p>
            </div>
          </div>

          {activeConversationId && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={(e) => handleDeleteConversation(activeConversationId, e)}
              className="text-slate-400 hover:text-rose-400"
            >
              Delete Chat
            </Button>
          )}
        </div>

        {/* Messages List Area */}
        <Card className="min-h-[440px] max-h-[600px] overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-950/70 border-slate-800">
          {messages.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">Ask a question to start this discussion</h4>
                <p className="text-xs text-slate-400">
                  Ask questions about your project PDFs. Clear explanations with verifiable source citations and inspectable evidence.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg'
                  }`}
                >
                  {msg.role === 'user' ? 'You' : <Sparkles className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-2xl p-4 space-y-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600/90 text-white rounded-tr-none font-medium'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none shadow-md'
                  }`}
                >
                  {/* Clean Message Body */}
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-100 leading-relaxed font-normal space-y-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}

                  {/* Unsupported Question Warning */}
                  {msg.role === 'assistant' && msg.hasEvidence === false && !msg.isSmallTalk && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>No Evidence in Materials: Question falls outside project PDFs.</span>
                    </div>
                  )}

                  {/* Clean Sources Section */}
                  {msg.role === 'assistant' && !msg.isSmallTalk && ((msg.sources && msg.sources.length > 0) || (msg.citations && msg.citations.length > 0)) && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Sources & Citations
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(msg.sources && msg.sources.length > 0 ? msg.sources : msg.citations).map((src, sIdx) => {
                          const docName = src.documentName || src.fileName || 'Document.pdf';
                          const pageNum = src.page || src.pageNumber || 1;
                          return (
                            <div
                              key={sIdx}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-md text-xs font-medium"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>{docName}, p. {pageNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expandable Supporting Evidence Section */}
                  {msg.role === 'assistant' && !msg.isSmallTalk && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => toggleEvidence(idx)}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-medium transition-colors py-1 px-2.5 rounded-lg bg-slate-950/70 border border-slate-800"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedEvidence[idx] ? 'rotate-90' : ''}`} />
                        <span>{expandedEvidence[idx] ? 'Hide Supporting Evidence' : `View Supporting Evidence (${msg.retrievedChunks.length} chunks)`}</span>
                      </button>

                      {expandedEvidence[idx] && (
                        <div className="mt-3 space-y-2.5 pl-2 border-l-2 border-slate-800 text-xs">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Retrieved Document Chunks & Similarity
                          </div>
                          {msg.retrievedChunks.map((chunk, cIdx) => (
                            <div key={cIdx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-blue-400" />
                                  {chunk.documentName} — Page {chunk.page}
                                </span>
                                <div className="flex items-center gap-2">
                                  {chunk.chunkId && <span className="text-slate-500 font-mono text-[10px]">Chunk #{chunk.chunkId}</span>}
                                  {chunk.similarity !== undefined && (
                                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                                      {(chunk.similarity * 100).toFixed(1)}% match
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-300 text-[11px] leading-relaxed italic bg-slate-900/60 p-2.5 rounded-lg font-mono">
                                "{chunk.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto items-center">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                <span>Thinking & generating grounded tutor response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </Card>

        {/* Input Prompt Box */}
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question in this conversation..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors h-[48px]"
            disabled={loading}
          />
          <Button type="submit" variant="primary" icon={Send} disabled={!query.trim() || loading} loading={loading} className="h-[48px] px-6">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};
