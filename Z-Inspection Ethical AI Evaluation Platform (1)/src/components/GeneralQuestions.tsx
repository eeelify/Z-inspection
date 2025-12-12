import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Save, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Project, User } from '../types';
import { api } from '../api';

interface GeneralQuestionsProps {
  project: Project;
  currentUser: User;
  onBack: () => void;
  onComplete: () => void;
}

interface GeneralQuestion {
  id: string;
  principle: string; // Ethical principle name
  principleTr: string; // Turkish translation
  questionEn: string;
  questionTr: string;
  type: 'multiple-choice' | 'text';
  options?: string[];
  required?: boolean;
}

const generalQuestions: GeneralQuestion[] = [
  // TRANSPARENCY (Şeffaflık)
  {
    id: 'T1',
    principle: 'TRANSPARENCY',
    principleTr: 'Şeffaflık',
    questionEn: 'Is it clear to you what the AI system can and cannot do?',
    questionTr: 'AI sisteminin ne yapabildiği ve ne yapamadığı sizin için açık mı?',
    type: 'multiple-choice',
    options: ['Very clear', 'Mostly clear', 'Somewhat unclear', 'Completely unclear'],
    required: true
  },
  {
    id: 'T2',
    principle: 'TRANSPARENCY',
    principleTr: 'Şeffaflık',
    questionEn: 'Do you understand that the system may sometimes be wrong or uncertain?',
    questionTr: 'Sistemin bazen hatalı veya belirsiz olabileceğini anlıyor musunuz?',
    type: 'multiple-choice',
    options: ['Yes', 'Partially', 'No'],
    required: true
  },
  // HUMAN AGENCY & OVERSIGHT (İnsan Kontrolü)
  {
    id: 'H1',
    principle: 'HUMAN AGENCY & OVERSIGHT',
    principleTr: 'İnsan Kontrolü',
    questionEn: 'Do you feel that you remain in control when using the AI system?',
    questionTr: 'AI sistemini kullanırken kontrolün sizde olduğunu hissediyor musunuz?',
    type: 'multiple-choice',
    options: ['Fully', 'Mostly', 'Slightly', 'Not at all'],
    required: true
  },
  {
    id: 'H2',
    principle: 'HUMAN AGENCY & OVERSIGHT',
    principleTr: 'İnsan Kontrolü',
    questionEn: 'Would you feel comfortable disagreeing with the system\'s output?',
    questionTr: 'Sistemin çıktısına katılmamayı rahatça hisseder misiniz?',
    type: 'multiple-choice',
    options: ['Yes', 'Sometimes', 'Rarely', 'No'],
    required: true
  },
  // TECHNICAL ROBUSTNESS & SAFETY (Algılanan Güvenlik)
  {
    id: 'S1',
    principle: 'TECHNICAL ROBUSTNESS & SAFETY',
    principleTr: 'Algılanan Güvenlik',
    questionEn: 'Do you think incorrect outputs from this system could cause real harm if not noticed?',
    questionTr: 'Fark edilmezse bu sistemin hatalı çıktıları gerçek zarara yol açabilir mi?',
    type: 'multiple-choice',
    options: ['Very likely', 'Possible', 'Unlikely', 'Not at all'],
    required: true
  },
  // PRIVACY & DATA GOVERNANCE (Gizlilik ve Veri Koruma)
  {
    id: 'P1',
    principle: 'PRIVACY & DATA GOVERNANCE',
    principleTr: 'Gizlilik ve Veri Koruma',
    questionEn: 'Do you feel confident that your personal or sensitive data is handled responsibly?',
    questionTr: 'Kişisel veya hassas verilerinizin sorumlu şekilde işlendiğine güveniyor musunuz?',
    type: 'multiple-choice',
    options: ['Very confident', 'Somewhat confident', 'Not very confident', 'Not at all'],
    required: true
  },
  {
    id: 'P2',
    principle: 'PRIVACY & DATA GOVERNANCE',
    principleTr: 'Gizlilik ve Veri Koruma',
    questionEn: 'Is it clear to you what data about you is used by the system?',
    questionTr: 'Sistem tarafından sizinle ilgili hangi verilerin kullanıldığı açık mı?',
    type: 'multiple-choice',
    options: ['Yes', 'Partially', 'No'],
    required: true
  },
  // DIVERSITY, NON-DISCRIMINATION & FAIRNESS (Eşitlik ve Adalet)
  {
    id: 'F1',
    principle: 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
    principleTr: 'Eşitlik ve Adalet',
    questionEn: 'Do you believe the system would treat different people fairly?',
    questionTr: 'Sistemin farklı kişilere adil davranacağını düşünüyor musunuz?',
    type: 'multiple-choice',
    options: ['Yes', 'Not sure', 'Probably not', 'Definitely not'],
    required: true
  },
  // SOCIETAL & INTERPERSONAL WELL-BEING (Toplumsal Etki)
  {
    id: 'W1',
    principle: 'SOCIETAL & INTERPERSONAL WELL-BEING',
    principleTr: 'Toplumsal Etki',
    questionEn: 'Do you think the use of this AI system could affect trust between people (e.g. patient–doctor, employee–employer)?',
    questionTr: 'Bu AI sisteminin insanlar arasındaki güveni etkileyebileceğini düşünüyor musunuz?',
    type: 'text',
    required: true
  },
  {
    id: 'W2',
    principle: 'SOCIETAL & INTERPERSONAL WELL-BEING',
    principleTr: 'Toplumsal Etki',
    questionEn: 'Should users or affected individuals be informed when this AI system is used?',
    questionTr: 'Bu AI sistemi kullanıldığında kullanıcıların veya etkilenen kişilerin bilgilendirilmesi gerekir mi?',
    type: 'multiple-choice',
    options: ['Yes', 'Depends', 'No'],
    required: true
  },
  // ACCOUNTABILITY (Sorumluluk)
  {
    id: 'A1',
    principle: 'ACCOUNTABILITY',
    principleTr: 'Sorumluluk',
    questionEn: 'Do you know who to contact or what to do if the system causes a problem or harm?',
    questionTr: 'Sistem bir sorun veya zarar oluşturursa kime başvuracağınızı veya ne yapacağınızı biliyor musunuz?',
    type: 'multiple-choice',
    options: ['Yes', 'Somewhat', 'No'],
    required: true
  },
  {
    id: 'A2',
    principle: 'ACCOUNTABILITY',
    principleTr: 'Sorumluluk',
    questionEn: 'Do you think there are sufficient safeguards to prevent misuse of the system?',
    questionTr: 'Sistemin yanlış veya amaç dışı kullanımını önlemek için yeterli önlemler olduğunu düşünüyor musunuz?',
    type: 'multiple-choice',
    options: ['Yes', 'Partially', 'No', 'Not sure'],
    required: true
  }
];

export function GeneralQuestions({ project, currentUser, onBack, onComplete }: GeneralQuestionsProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [risks, setRisks] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentQuestion = generalQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === generalQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Load existing answers
  useEffect(() => {
    const loadAnswers = async () => {
      try {
        const response = await fetch(
          api(`/api/general-questions?projectId=${project.id || (project as any)._id}&userId=${currentUser.id || (currentUser as any)._id}`)
        );
        if (response.ok) {
          const data = await response.json();
          // Load from principles structure if available, otherwise from flat structure
          if (data.principles) {
            const loadedAnswers: Record<string, string> = {};
            const loadedRisks: Record<string, number> = {};
            Object.keys(data.principles).forEach(principle => {
              if (data.principles[principle].answers) {
                Object.assign(loadedAnswers, data.principles[principle].answers);
              }
              if (data.principles[principle].risks) {
                Object.assign(loadedRisks, data.principles[principle].risks);
              }
            });
            setAnswers(loadedAnswers);
            setRisks(loadedRisks);
          } else {
            // Fallback to flat structure
            if (data.answers) {
              setAnswers(data.answers);
            }
            if (data.risks) {
              setRisks(data.risks);
            }
          }
        }
      } catch (error) {
        console.error('Error loading general questions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnswers();
  }, [project.id, currentUser.id]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleRiskChange = (questionId: string, risk: 0 | 1 | 2 | 3 | 4) => {
    setRisks((prev) => ({ ...prev, [questionId]: risk }));
  };

  const saveAnswers = async () => {
    setSaving(true);
    try {
      const projectId = project.id || (project as any)._id;
      const userId = currentUser.id || (currentUser as any)._id;

      if (!projectId || !userId) {
        throw new Error('Project ID or User ID is missing');
      }

      // Organize answers and risks by principle
      const principles: Record<string, { answers: Record<string, string>, risks: Record<string, number> }> = {};
      
      generalQuestions.forEach(q => {
        if (!principles[q.principle]) {
          principles[q.principle] = { answers: {}, risks: {} };
        }
        if (answers[q.id]) {
          principles[q.principle].answers[q.id] = answers[q.id];
        }
        if (risks[q.id] !== undefined) {
          principles[q.principle].risks[q.id] = risks[q.id];
        }
      });

      const response = await fetch(api('/api/general-questions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          userId: userId,
          userRole: currentUser.role,
          principles: principles,
          answers: answers || {}, // Keep for backward compatibility
          risks: risks || {}       // Keep for backward compatibility
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save answers' }));
        throw new Error(errorData.error || 'Failed to save answers');
      }
      
      const result = await response.json();
      console.log('Successfully saved:', result);
      return true;
    } catch (error: any) {
      console.error('Error saving general questions:', error);
      alert(`Error saving answers: ${error.message || 'Please try again.'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Validate required question
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      alert('Please answer this required question before proceeding.');
      return;
    }

    // Validate risk score is selected (required for all questions, must be 0-4)
    if (risks[currentQuestion.id] === undefined || risks[currentQuestion.id] === null) {
      alert('Please select a risk score (0-4) for this question before proceeding.');
      return;
    }

    // Save draft before moving forward
    await saveAnswers();

    if (isLastQuestion) {
      // Final save and complete
      const success = await saveAnswers();
      if (success) {
        onComplete();
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      onBack();
    }
  };

  const getCompletionPercentage = () => {
    const answered = generalQuestions.filter(q => answers[q.id]).length;
    return Math.round((answered / generalQuestions.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500">Loading general questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={onBack} 
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </button>
              <div>
                <h1 className="text-xl text-gray-900 font-bold tracking-tight">
                  General Questions
                </h1>
                <p className="text-sm text-gray-600">Project: {project.title}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Progress</p>
                <p className="text-sm font-bold text-gray-900">{getCompletionPercentage()}%</p>
              </div>
              <div className="w-32 bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out shadow-sm bg-blue-600"
                  style={{ width: `${getCompletionPercentage()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col">
        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col flex-1">
            <div className="p-8 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-600 text-sm font-medium rounded-full">
                Question {currentQuestionIndex + 1} of {generalQuestions.length}
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-600 text-sm font-medium rounded-full">
                {currentQuestion.principle}
              </span>
              {currentQuestion.required && (
                <span className="px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded-full border border-red-100">
                  Required
                </span>
              )}
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-3">
              {currentQuestion.questionEn}
            </h2>
            <p className="text-lg text-gray-600 italic mb-2">
              {currentQuestion.questionTr}
            </p>
            <p className="text-sm text-gray-500">
              Principle: {currentQuestion.principleTr}
            </p>
          </div>

          <div className="p-8 flex-1 bg-gray-50/30">
            {currentQuestion.type === 'multiple-choice' && (
              <div className="space-y-3 max-w-2xl">
                {currentQuestion.options?.map((option) => {
                  const isSelected = answers[currentQuestion.id] === option;
                  return (
                    <label
                      key={option}
                      className={`group flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-white'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300 group-hover:border-blue-400'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <input
                        type="radio"
                        name={currentQuestion.id}
                        value={option}
                        checked={isSelected}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="hidden"
                      />
                      <span
                        className={`text-lg font-medium transition-colors ${
                          isSelected ? 'text-blue-900' : 'text-gray-700'
                        }`}
                      >
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <div className="relative max-w-3xl">
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  rows={8}
                  className="w-full px-5 py-4 text-lg text-gray-800 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder-gray-400 bg-white"
                  placeholder="Type your answer here..."
                />
              </div>
            )}

            {/* Risk Score Selection (0-4) */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Risk Score for This Question</h3>
                <span className="px-2.5 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-100">
                  Required
                </span>
              </div>
              <div className="grid grid-cols-5 gap-3 max-w-4xl">
                {([
                  { value: 4, label: 'Excellent', labelTr: 'Mükemmel', desc: 'Clear understanding, high confidence', color: 'green' },
                  { value: 3, label: 'Good', labelTr: 'İyi', desc: 'Minor gaps but generally appropriate', color: 'blue' },
                  { value: 2, label: 'Moderate', labelTr: 'Orta', desc: 'Basic awareness, notable gaps', color: 'yellow' },
                  { value: 1, label: 'Poor', labelTr: 'Zayıf', desc: 'Significant misunderstanding, low confidence', color: 'orange' },
                  { value: 0, label: 'Unacceptable', labelTr: 'Kabul Edilemez', desc: 'No awareness, serious risk', color: 'red' }
                ] as const).map(({ value, label, labelTr, desc, color }) => {
                  const isSelected = risks[currentQuestion.id] === value;
                  const colorClasses = {
                    green: isSelected ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 hover:border-green-300',
                    blue: isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300',
                    yellow: isSelected ? 'border-yellow-500 bg-yellow-50 shadow-md' : 'border-gray-200 hover:border-yellow-300',
                    orange: isSelected ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-gray-200 hover:border-orange-300',
                    red: isSelected ? 'border-red-500 bg-red-50 shadow-md' : 'border-gray-200 hover:border-red-300'
                  };
                  const bgColorClasses = {
                    green: isSelected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400',
                    blue: isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
                    yellow: isSelected ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400',
                    orange: isSelected ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400',
                    red: isSelected ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                  };
                  return (
                    <label
                      key={value}
                      className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${colorClasses[color]} hover:bg-gray-50`}
                    >
                      <input
                        type="radio"
                        name={`risk-${currentQuestion.id}`}
                        value={value}
                        checked={isSelected}
                        onChange={() => handleRiskChange(currentQuestion.id, value as 0 | 1 | 2 | 3 | 4)}
                        className="hidden"
                      />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${bgColorClasses[color]}`}>
                        <span className="text-lg font-bold">{value}</span>
                      </div>
                      <span className={`text-xs font-bold text-center ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-500 text-center mt-1">{labelTr}</span>
                      <span className="text-xs text-gray-400 text-center mt-1 leading-tight">{desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 mt-8 flex justify-between items-center z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleBack}
            className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all border-2 text-gray-700 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 mr-2" /> {isFirstQuestion ? 'Back' : 'Previous'}
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={saveAnswers}
              disabled={saving}
              className="px-6 py-3 bg-indigo-50 border-2 border-indigo-100 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 hover:border-indigo-200 transition-all flex items-center"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center px-8 py-3 text-white rounded-xl font-bold shadow-md transition-all hover:-translate-y-0.5 bg-blue-600 hover:bg-blue-700"
            >
              {isLastQuestion ? 'Complete' : 'Next Question'}{' '}
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

