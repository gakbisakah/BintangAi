// hooks/useAI.ts
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useAI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Key tambahan untuk otorisasi custom
  const customHeaders = {
    'x-api-key': 'christian'
  };

  /**
   * Mengambil topik yang sulit bagi siswa (Weak Topics)
   */
  const getWeakTopics = async (studentId) => {
    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('weak_topics')
        .eq('id', studentId)
        .single();

      if (dbError) throw dbError;
      return { topics: data?.weak_topics || [] };
    } catch (err) {
      console.error("Gagal ambil topik lemah:", err);
      return { topics: [] };
    }
  };

  /**
   * Tanya Jawab dengan Tutor AI
   */
  const askTutor = async (query, weakTopics = []) => {
    setLoading(true);
    setError(null);

    try {
      // Get user profile to get nama and kelas
      const { data: userData } = await supabase.auth.getUser();
      const userMetadata = userData?.user?.user_metadata || {};
      const nama = userMetadata.full_name?.split(' ')[0] || "Teman";
      const kelas = userMetadata.kelas || 4;

      // Call the correct edge function with proper payload
      const { data, error: invokeError } = await supabase.functions.invoke('ai-tutor', {
        body: {
          message: query,
          nama,
          kelas,
          weak_topics: weakTopics,
        },
        headers: customHeaders
      });

      if (invokeError) {
        console.error("Invoke error:", invokeError);
        throw new Error(invokeError.message);
      }

      if (!data) {
        throw new Error("No response from AI tutor");
      }

      return {
        answer: data.answer || data.reply,
        success: data.success !== false
      };
    } catch (err) {
      console.error("AskTutor Error:", err);
      setError(err.message);
      return {
        answer: "Maaf, Kak BintangAi sedang sibuk. Coba tanya lagi ya! 😊",
        success: false
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mengambil laporan terbaru dari database
   */
  const getParentReport = async (studentId) => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('student_reports')
        .select('content, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError) throw dbError;
      return data?.content || null;
    } catch (err) {
      console.error("Gagal mengambil laporan:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Menjalankan AI untuk generate laporan
   * FIXED: Better error handling and response validation
   */
  const generateAndSaveReport = async (studentId, teacherId) => {
    setLoading(true);
    setError(null);

    try {
      console.log("Generating report for student:", studentId);

      // Call the edge function
      const { data, error: invokeError } = await supabase.functions.invoke('generate-parent-report-ai', {
        body: { student_id: studentId },
        headers: customHeaders
      });

      if (invokeError) {
        console.error("Invoke error:", invokeError);
        throw new Error(`Gagal memanggil AI: ${invokeError.message}`);
      }

      // Check response structure
      if (!data) {
        throw new Error("Tidak ada respon dari server");
      }

      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      if (!data.report) {
        console.error("Invalid response data:", data);
        throw new Error("AI tidak memberikan laporan yang valid");
      }

      const aiReportContent = data.report;

      // Save report to database
      const { error: saveError } = await supabase
        .from('student_reports')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          content: aiReportContent,
          report_type: 'mingguan',
          created_at: new Date().toISOString()
        });

      if (saveError) {
        console.error("Save error:", saveError);
        throw new Error(`Gagal menyimpan laporan: ${saveError.message}`);
      }

      return {
        success: true,
        report: aiReportContent,
        message: "Laporan berhasil dibuat dan disimpan!"
      };

    } catch (err) {
      console.error("Generate Report Error:", err);
      setError(err.message);
      return {
        success: false,
        message: err.message,
        report: null
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate Soal Quiz dengan AI
   */
  const generateAIQuiz = async (params) => {
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-quiz', {
        body: params,
        headers: customHeaders
      });

      if (invokeError) {
        return { success: false, message: `Gagal memanggil AI: ${invokeError.message}` };
      }

      return data;
    } catch (err) {
      return { success: false, message: `Koneksi Error: ${err.message}` };
    } finally {
      setLoading(false);
    }
  };

  return {
    askTutor,
    getWeakTopics,
    getParentReport,
    generateAndSaveReport,
    generateAIQuiz,
    loading,
    error
  };
};