import React, { useState } from 'react';
import { QuizItem } from '../api';
import { useQuiz } from '../hooks/useQuiz';
import { getQuizTypeColor, getQuizTypeLabel } from '../utils/quiz';

interface QuizCardProps {
  quiz: QuizItem;
  onAnswer?: (isCorrect: boolean) => void;
  showAnswer?: boolean;
}

export function QuizCard({ quiz, onAnswer, showAnswer = false }: QuizCardProps) {
  const { isSubmitting, submitAnswer, message, isCorrect, pointsEarned } = useQuiz();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleOptionSelect = async (option: string, isCorrectOption: boolean) => {
    if (isSubmitting || showAnswer || hasSubmitted) return;
    
    setSelectedOption(option);
    setHasSubmitted(true);
    
    const success = await submitAnswer(quiz.id, isCorrectOption);
    
    if (onAnswer && success) {
      onAnswer(isCorrectOption);
    }
  };

  const renderOptions = () => {
    if (!quiz.payload.options) return null;

    return quiz.payload.options.map((option: string, index: number) => {
      const optionKey = String.fromCharCode(65 + index); // A, B, C, ...
      const isSelected = selectedOption === optionKey;
      const isCorrectOption = index === quiz.payload.answer;
      
      let className = 'flex items-center p-3 border rounded-lg mb-2 transition-colors';
      
      if (hasSubmitted || showAnswer) {
        if (isCorrectOption) {
          className += ' bg-green-50 border-green-300';
        } else if (isSelected) {
          className += ' bg-red-50 border-red-300';
        }
      } else {
        className += ' cursor-pointer hover:bg-gray-50';
        if (isSelected) {
          className += ' bg-blue-50 border-blue-300';
        } else {
          className += ' border-gray-200';
        }
      }

      return (
        <div 
          key={optionKey}
          className={className}
          onClick={() => handleOptionSelect(optionKey, isCorrectOption)}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 text-sm font-medium ${
            hasSubmitted || showAnswer
              ? isCorrectOption
                ? 'bg-green-100 text-green-700'
                : isSelected
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500'
              : isSelected
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {optionKey}
          </div>
          <span className="flex-1">{option}</span>
          {(hasSubmitted || showAnswer) && isCorrectOption && (
            <span className="ml-2 text-green-600">✓</span>
          )}
          {isSelected && !isCorrectOption && (hasSubmitted || showAnswer) && (
            <span className="ml-2 text-red-600">✗</span>
          )}
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQuizTypeColor(quiz.type)}`}>
              {getQuizTypeLabel(quiz.type)}
            </span>
          </div>
          {pointsEarned > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              +{pointsEarned}점
            </span>
          )}
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-4">{quiz.payload.question}</h3>
        
        <div className="space-y-3">
          {renderOptions()}
        </div>
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            isCorrect 
              ? 'bg-green-50 text-green-800 border border-green-100' 
              : 'bg-red-50 text-red-800 border border-red-100'
          }`}>
            {message}
          </div>
        )}
      </div>
      
      {isSubmitting && (
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            처리 중...
          </div>
        </div>
      )}
    </div>
  );
}
