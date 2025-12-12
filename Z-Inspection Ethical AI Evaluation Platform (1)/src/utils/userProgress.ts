import { getQuestionsByRole } from '../data/questions';
import { api } from '../api';
import { Project, User } from '../types';

type EvalPayload = {
  status?: string;
  answers?: Record<string, any>;
};

type TensionPayload = {
  userVote?: 'agree' | 'disagree' | null;
};

/**
 * Kullanıcıya özel ilerlemeyi hesaplar.
 * Adımlar: 1 (set-up) + toplam soru sayısı + 1 (tension) + 1 (rapor onayı placeholder).
 * Tension adımı: tüm tension'lara oy verilmiş olmalı.
 * Rapor onayı henüz yok => tamamlanmamış sayılır.
 */
export async function fetchUserProgress(project: Project, currentUser: User): Promise<number> {
  try {
    const projectId = project.id || (project as any)._id;
    const userId = currentUser.id || (currentUser as any)._id;
    const roleKey = currentUser.role.toLowerCase().replace(' ', '-') || 'admin';

    // Soru sayısı: role bazlı tüm sorular (set-up + assess)
    const allQuestions = getQuestionsByRole(roleKey);
    const totalQuestions = allQuestions.length;

    // Verileri paralel çek
    const [setUpRes, assessRes, tensionsRes] = await Promise.all([
      fetch(api(`/api/evaluations?projectId=${projectId}&userId=${userId}&stage=set-up`)),
      fetch(api(`/api/evaluations?projectId=${projectId}&userId=${userId}&stage=assess`)),
      fetch(api(`/api/tensions/${projectId}?userId=${userId}`))
    ]);

    const setUpEval: EvalPayload | null = setUpRes.ok ? await setUpRes.json() : null;
    const assessEval: EvalPayload | null = assessRes.ok ? await assessRes.json() : null;
    const tensions: TensionPayload[] = tensionsRes.ok ? await tensionsRes.json() : [];

    const setUpCompleted = !!(setUpEval && (setUpEval.status === 'completed' || (setUpEval.answers && Object.keys(setUpEval.answers).length > 0)));

    const answeredCount =
      (setUpEval?.answers ? Object.keys(setUpEval.answers).length : 0) +
      (assessEval?.answers ? Object.keys(assessEval.answers).length : 0);

    const tensionDone = tensions.length === 0 ? true : tensions.every(t => t.userVote === 'agree' || t.userVote === 'disagree');
    const reportDone = false; // placeholder, henüz yok

    const totalSteps = totalQuestions + 3; // set-up + questions + tension + report
    const completedSteps =
      (setUpCompleted ? 1 : 0) +
      Math.min(answeredCount, totalQuestions) +
      (tensionDone ? 1 : 0) +
      (reportDone ? 1 : 0);

    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    return Math.max(0, Math.min(100, progress));
  } catch (err) {
    console.error('User progress calc error', err);
    return 0;
  }
}


