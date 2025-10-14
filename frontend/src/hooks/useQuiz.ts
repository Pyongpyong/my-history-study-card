import { useState } from 'react';
import { QuizItem, submitQuizAnswer } from '../api';
import { useAuth } from '../context/AuthContext';

interface UseQuizResult {
  isSubmitting: boolean;
  submitAnswer: (quizId: number, isCorrect: boolean) => Promise<boolean>;
  pointsEarned: number;
  totalPoints: number;
  message: string;
  isCorrect: boolean | null;
}

export function useQuiz(): UseQuizResult {
  const { updateUser, refresh } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [message, setMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const submitAnswer = async (quizId: number, isCorrect: boolean): Promise<boolean> => {
    setIsSubmitting(true);
    setMessage('');
    
    try {
      const result = await submitQuizAnswer(quizId, isCorrect);
      setPointsEarned(result.points_earned);
      setTotalPoints(result.total_points);
      setMessage(result.message);
      setIsCorrect(result.is_correct);

      if (typeof result.total_points === 'number') {
        updateUser((prev) => (prev ? { ...prev, points: result.total_points } : prev));
        void refresh().catch(() => undefined);
      }
      return result.success;
    } catch (error) {
      console.error('Error submitting quiz answer:', error);
      setMessage('퀴즈 제출 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    submitAnswer,
    pointsEarned,
    totalPoints,
    message,
    isCorrect
  };
}
