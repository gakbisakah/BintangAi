import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useAI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const askTutor = async (query, studentId, weakTopics = []) => {
    setLoading(true);
    setError(null);

    try {
      const { data: profileData } = await supabase.from('profiles').select('full_name, class_code').eq('id', studentId).single();
      const nama = profileData?.full_name?.split(' ')[0] || "Teman";
      const kelas = 4;

      const apiKey = import.meta.env.VITE_CUSTOM_AI_TUTOR_KEY;

      const { data, error: invokeError } = await supabase.functions.invoke('ai-tutor', {
        body: {
          message: query,
          student_id: studentId,
          nama: nama,
          kelas: kelas,
          weak_topics: weakTopics,
        },
        headers: {
          'x-api-key': apiKey || 'christian'
        }
      });

      if (invokeError) throw invokeError;

      return {
        answer: data.reply || "Maaf, Kak Bintang lagi bingung. 😊",
        success: true
      };

    } catch (err) {
      console.error("AI Tutor Error:", err.message);
      return {
        answer: "Waduh, Kak BintangAi lagi istirahat sebentar. Coba tanya lagi ya! 😊",
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  };

  const generateAIQuiz = async (config) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-quiz', {
        body: config,
        headers: {
          'x-api-key': 'christian'
        }
      });

      if (invokeError) throw invokeError;
      return { success: true, quiz: data };
    } catch (err) {
      console.error("Generate AI Quiz Error:", err);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  const generateManualFeedback = async (config) => {
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('weak-topics', {
        body: { action: 'detect', ...config },
        headers: { 'x-api-key': 'christian' }
      });
      if (invokeError) throw invokeError;

      // Transform response to match expectation
      return {
        feedback_correct: `Bagus! Penjelasan: Ini adalah jawaban yang benar tentang ${data.topics?.[0] || 'materi ini'}.`,
        feedback_wrong: `Kurang tepat. Coba pelajari lagi tentang ${data.topics?.[0] || 'topik ini'}.`
      };
    } catch (err) {
      console.error("Generate Feedback Error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getWeakTopics = async (studentId) => {
    try {
      const { data } = await supabase.from('profiles').select('weak_topics').eq('id', studentId).single();
      return { topics: data?.weak_topics || [] };
    } catch (err) {
      return { topics: [] };
    }
  };

  const generateAndSaveReport = async (studentId, teacherId) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-parent-report-ai', {
        body: { student_id: studentId, teacher_id: teacherId },
        headers: { 'x-api-key': 'christian' }
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  return {
    askTutor,
    generateAIQuiz,
    generateManualFeedback,
    getWeakTopics,
    generateAndSaveReport,
    loading,
    error
  };
};