import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { HelpCircle, CheckCircle2, XCircle, RefreshCw, FileText, Sparkles, Award } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/LoadingState';

export const QuizTab = ({ projectId }) => {
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState({}); // { questionId: answerString }
  const [attemptResult, setAttemptResult] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await apiFetch(`/projects/${projectId}/quiz/history`);
      if (response.success) {
        setQuizHistory(response.attempts || []);
      }
    } catch (err) {
      console.error('Failed to load quiz history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const handleGenerateQuiz = async () => {
    setLoading(true);
    setAttemptResult(null);
    setUserAnswers({});
    try {
      const response = await apiFetch(`/projects/${projectId}/quiz/generate`, {
        method: 'POST',
        body: JSON.stringify({ count: 4 }),
      });
      if (response.success) {
        setActiveQuiz(response.quiz);
      }
    } catch (err) {
      alert(err.message || 'Failed to generate quiz. Make sure you have uploaded PDF materials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId, optionText) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionText,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(userAnswers).map(([qId, ans]) => ({
        questionId: qId,
        userAnswer: ans,
      }));

      const response = await apiFetch(`/projects/${projectId}/quiz/${activeQuiz._id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      if (response.success) {
        setAttemptResult(response.attempt);
        await fetchHistory();
      }
    } catch (err) {
      alert(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Generating dynamic adaptive quiz from project PDFs..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
            <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
              Adaptive Practice Quiz
              <Badge variant="success">Grounded Evaluation</Badge>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">MCQ and open-ended evaluation dynamically created from your materials</p>
          </div>
        </div>

        <Button variant="primary" icon={Sparkles} onClick={handleGenerateQuiz} className="w-full sm:w-auto shrink-0">
          Generate New Quiz
        </Button>
      </div>

      {/* Active Quiz Player */}
      {activeQuiz && !attemptResult && (
        <Card className="p-6 space-y-6 bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">{activeQuiz.title}</h4>
            <Badge variant="info">{activeQuiz.questions.length} Questions</Badge>
          </div>

          <div className="space-y-6">
            {activeQuiz.questions.map((q, idx) => (
              <div key={q._id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    Q{idx + 1}. [{q.conceptName}]
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-blue-400" /> Page {q.sourcePage} ({q.sourceFileName})
                  </span>
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-200">{q.questionText}</p>

                {/* Question Options */}
                {q.type === 'MCQ' ? (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = userAnswers[q._id] === opt;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => handleSelectOption(q._id, opt)}
                          className={`text-left text-xs p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    placeholder="Type your explanation here based on the material..."
                    value={userAnswers[q._id] || ''}
                    onChange={(e) => handleSelectOption(q._id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <Button
              variant="primary"
              onClick={handleSubmitQuiz}
              loading={submitting}
              disabled={Object.keys(userAnswers).length === 0}
            >
              Submit Quiz & Evaluate Mastery
            </Button>
          </div>
        </Card>
      )}

      {/* Attempt Results View */}
      {attemptResult && (
        <Card className="p-6 space-y-6 bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-amber-400" />
              <div>
                <h4 className="text-base font-bold text-white">Quiz Completed</h4>
                <p className="text-xs text-slate-400">Score: {attemptResult.score}% ({attemptResult.correctCount}/{attemptResult.totalQuestions} Correct)</p>
              </div>
            </div>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={handleGenerateQuiz}>
              Take Another Quiz
            </Button>
          </div>

          <div className="space-y-4">
            {attemptResult.answers.map((ans, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border space-y-2 ${
                  ans.isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    {ans.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    Question {idx + 1}
                  </span>
                  <Badge variant={ans.isCorrect ? 'success' : 'danger'}>
                    {ans.isCorrect ? 'Correct (+100)' : 'Incorrect (0)'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-300">Your Answer: <span className="font-semibold text-white">{ans.userAnswer || 'No answer'}</span></p>
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  {ans.explanation}
                </p>
                {ans.citationText && (
                  <span className="text-[11px] text-blue-400 font-medium block">
                    Source: {ans.citationText}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quiz Attempt History */}
      {!activeQuiz && quizHistory.length > 0 && (
        <Card className="p-6 space-y-4 bg-slate-900 border-slate-800">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Past Quiz Attempts</h4>
          <div className="space-y-3">
            {quizHistory.map((att) => (
              <div key={att._id} className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <h5 className="text-xs font-bold text-white">Score: {att.score}%</h5>
                  <p className="text-[11px] text-slate-400">{att.correctCount} of {att.totalQuestions} questions correct</p>
                </div>
                <span className="text-[11px] text-slate-500">{new Date(att.completedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
