import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { BarChart2, Activity, Cpu, FileText, MessageSquare, HelpCircle, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { StatCard } from '../ui/StatCard';
import { LoadingState } from '../ui/LoadingState';

export const AnalyticsTab = ({ projectId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const response = await apiFetch(`/projects/${projectId}/growth/analytics`);
        if (response.success) {
          setAnalytics(response.analytics);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [projectId]);

  if (loading) {
    return <LoadingState message="Loading learning logs and AI observability metrics..." />;
  }

  const { totalTokens = 0, totalQueries = 0, events = [] } = analytics || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard icon={Cpu} title="AI Tokens Processed" value={totalTokens.toLocaleString()} subtext="Prompt & completion tokens" color="indigo" />
        <StatCard icon={Activity} title="Total AI Queries" value={totalQueries} subtext="Vector RAG interactions" color="blue" />
        <StatCard icon={Calendar} title="Logged Events" value={events.length} subtext="Learning activity trail" color="emerald" />
      </div>

      {/* Learning Activity Timeline */}
      <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Learning Activity Timeline
        </h4>

        {events.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">
            No logged events yet. Ask your AI Tutor or take a practice quiz to generate activity logs.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((evt, idx) => {
              const getIcon = () => {
                if (evt.eventType === 'ASK_TUTOR') return MessageSquare;
                if (evt.eventType === 'TAKE_QUIZ') return HelpCircle;
                return FileText;
              };
              const Icon = getIcon();

              return (
                <div key={evt._id || idx} className="flex items-start gap-3.5 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0 border border-blue-500/20 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-white truncate">{evt.eventType.replace('_', ' ')}</h5>
                      <span className="text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-400">{evt.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
