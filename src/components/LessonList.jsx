import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function LessonList({ lessons = [], onSelectLesson }) {
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  const [loadingProgress, setLoadingProgress] = useState(true);

  // ১. ডাটাবেস থেকে ইউজারের কমপ্লিট হওয়া লেসনগুলো ফেচ করা
  useEffect(() => {
    async function loadProgress() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingProgress(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_lesson_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .eq('is_completed', true);

        if (error) {
          console.error('Error fetching progress:', error);
        } else if (data) {
          setCompletedLessonIds(new Set(data.map((item) => String(item.lesson_id))));
        }
      } catch (err) {
        console.error('Failed to load lesson progress:', err);
      } finally {
        setLoadingProgress(false);
      }
    }

    loadProgress();
  }, []);

  // ২. লেসন সম্পন্ন বা অসম্পন্ন টগল করার ফাংশন
  const toggleComplete = async (lessonId, e) => {
    e.stopPropagation(); // কার্ডের ক্লিকে যেন লেসনে নেভিগেট না হয়

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('অনুগ্রহ করে আগে লগইন করুন।');
      return;
    }

    const strLessonId = String(lessonId);
    const isCurrentlyDone = completedLessonIds.has(strLessonId);
    const nextStatus = !isCurrentlyDone;

    // তাৎক্ষণিক UI আপডেট (Optimistic UI)
    setCompletedLessonIds((prev) => {
      const updated = new Set(prev);
      if (nextStatus) {
        updated.add(strLessonId);
      } else {
        updated.delete(strLessonId);
      }
      return updated;
    });

    // সুপাবেসে ডাটা সেভ বা আপডেট
    const { error } = await supabase
      .from('user_lesson_progress')
      .upsert(
        {
          user_id: user.id,
          lesson_id: strLessonId,
          is_completed: nextStatus,
          completed_at: nextStatus ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' }
      );

    if (error) {
      console.error('Error updating progress:', error);
      // সার্ভারে এরর হলে UI আগের অবস্থায় ফেরত নেওয়া
      setCompletedLessonIds((prev) => {
        const rollback = new Set(prev);
        if (isCurrentlyDone) {
          rollback.add(strLessonId);
        } else {
          rollback.delete(strLessonId);
        }
        return rollback;
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-3">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        লেসন তালিকা ({lessons.length})
      </h2>

      {lessons.map((lesson, index) => {
        const isDone = completedLessonIds.has(String(lesson.id || index + 1));

        return (
          <div
            key={lesson.id || index}
            onClick={() => onSelectLesson && onSelectLesson(lesson)}
            className={`flex items-center justify-between p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              isDone ? 'border-emerald-300 bg-emerald-50/20' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            {/* বাম পাশ: সিরিয়াল নম্বর ও লেসনের শিরোনাম */}
            <div className="flex items-center gap-4">
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {index + 1}
              </span>
              <span className={`font-semibold text-gray-800 text-base ${isDone ? 'text-emerald-950' : ''}`}>
                {lesson.title || lesson.name}
              </span>
            </div>

            {/* ডান পাশ: স্ট্যাটাস ব্যাজ ও কমপ্লিট টগল বাটন */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                মোট: {lesson.total || 0}
              </span>
              <span className="px-2.5 py-1 text-xs rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                পড়া হয়নি: {lesson.unread || 0}
              </span>
              <span className="px-2.5 py-1 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                শিখতেছি: {lesson.learning || 0}
              </span>
              <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                জানি: {lesson.known || 0}
              </span>

              {/* সম্পন্ন করুন / সম্পন্ন বাটন */}
              <button
                type="button"
                onClick={(e) => toggleComplete(lesson.id || index + 1, e)}
                className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                  isDone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-emerald-500 hover:text-emerald-600'
                }`}
                title={isDone ? 'ক্লিক করে অসম্পন্ন করুন' : 'সম্পন্ন হিসেবে চিহ্নিত করুন'}
              >
                <svg
                  className={`w-4 h-4 ${isDone ? 'text-white' : 'text-gray-400'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{isDone ? 'সম্পন্ন' : 'সম্পন্ন করুন'}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
