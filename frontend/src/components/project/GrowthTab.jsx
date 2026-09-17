import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { TrendingUp, Sparkles, Award, AlertTriangle, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';
import { Card } from '../ui/Card';
import { StatCard } from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/LoadingState';

export const GrowthTab = ({ projectId }) => {
  const [metrics, setMetrics] = useState(null);
  const [masteries, setMasteries] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGrowthData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        apiFetch(`/projects/${projectId}/growth`),
        apiFetch(`/projects/${projectId}/growth/recommendations`),
      ]);

      if (mRes.success) {
        setMetrics(mRes.metrics);
        setMasteries(mRes.masteries || []);
      }
      if (rRes.success) {
        setRecommendations(rRes.recommendations || []);
      }
    } catch (err) {
      console.error('Failed to load growth metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrowthData();
  }, [projectId]);

  if (loading) {
    return <LoadingState message="Analyzing concept mastery and generating learning recommendations..." />;
  }

  const { overallMasteryScore = 0, masteredCount = 0, weakCount = 0, learningCount = 0, totalQuizzesTaken = 0, studyStreakDays = 1 } = metrics || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={TrendingUp} title="Overall Mastery" value={`${overallMasteryScore}%`} subtext="Project knowledge index" color="emerald" />
        <StatCard icon={CheckCircle2} title="Mastered Concepts" value={masteredCount} subtext="High confidence (≥80%)" color="blue" />
        <StatCard icon={AlertTriangle} title="Weak Areas" value={weakCount} subtext="Needs material review" color="rose" />
        <StatCard icon={Award} title="Study Streak" value={`${studyStreakDays} Days`} subtext="Active learning practice" color="purple" />
      </div>

      {/* Progress Bar Header */}
      <Card className="p-6 bg-slate-900 border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
          <span>Overall Concept Mastery</span>
          <span className="text-emerald-400">{overallMasteryScore}% Complete</span>
        </div>
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${overallMasteryScore}%` }}
          />
        </div>
      </Card>

      {/* Actionable Recommendations Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Recommended Next Learning Actions
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec, idx) => (
            <Card key={idx} className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 space-y-2 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <Badge variant={rec.priority === 'HIGH' ? 'danger' : 'info'}>
                  {rec.priority || 'MEDIUM'} PRIORITY
                </Badge>
                {rec.sourceFileName && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {rec.sourceFileName} — Page {rec.targetPage}
                  </span>
                )}
              </div>
              <h5 className="text-sm font-bold text-white">{rec.title}</h5>
              <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Concept Breakdown Table */}
      <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concept Mastery Index ({masteries.length})</h4>

        {masteries.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No concept evaluations yet. Complete an adaptive practice quiz to map concept mastery.
          </p>
        ) : (
          <div className="space-y-3">
            {masteries.map((m) => (
              <div key={m._id} className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-white">{m.conceptName}</h5>
                  <p className="text-[11px] text-slate-400">Assessed: {m.totalAttempts} times</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-24 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800 hidden sm:block">
                    <div
                      className={`h-full ${m.score >= 80 ? 'bg-emerald-400' : m.score < 40 ? 'bg-rose-500' : 'bg-blue-400'}`}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <Badge variant={m.status === 'MASTERED' ? 'success' : m.status === 'WEAK' ? 'danger' : 'info'}>
                    {m.status} ({m.score}%)
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
