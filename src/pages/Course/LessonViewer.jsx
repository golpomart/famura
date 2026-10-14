import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import WordPopup from '../../components/WordPopup';
import { useLessonCache } from '../../context/LessonCacheContext';

export default function LessonViewer() {
  const { lessonId } = useParams();
  const cache = useLessonCache();

  // Instant cached lesson data & status
  const cachedLesson = cache.lessonDetails.get(String(lessonId));
  const cachedSectionProg = cache.sectionProgressMap.get(String(lessonId)) || {};
  const isCachedDone = cache.progressMap.has(String(lessonId));

  const [lesson, setLesson] = useState(cachedLesson || null);
  const [loading, setLoading] = useState(!cachedLesson);
  const [showTranslation, setShowTranslation] = useState(true);
  const [progressMap, setProgressMap] = useState(cachedSectionProg);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'learning' | 'known'
  const [userId, setUserId] = useState(null);
  const [isLessonCompleted, setIsLessonCompleted] = useState(isCachedDone);
  const [updatingLessonProgress, setUpdatingLessonProgress] = useState(false);

  useEffect(() => {
    fetchLessonAndProgress();
  }, [lessonId]);

  const fetchLessonAndProgress = async () => {
    if (!cachedLesson) {
      setLoading(true);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setUserId(session.user.id);

    // If not cached or background re-validation
    const { data: lessonData } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (lessonData) {
      setLesson(lessonData);
      cache.lessonDetails.set(String(lessonId), lessonData);
    }

    if (session) {
      // 1. Fetch section progress
      const { data: progressData } = await supabase
        .from('user_section_progress')
        .select('section_id, status')
        .eq('user_id', session.user.id)
        .eq('lesson_id', lessonId);

      if (progressData) {
        const pMap = {};
        progressData.forEach(p => { pMap[p.section_id] = p.status; });
        setProgressMap(pMap);
        cache.sectionProgressMap.set(String(lessonId), pMap);
      }

      // 2. Fetch lesson completion status
      const { data: lessonProgData } = await supabase
        .from('user_lesson_progress')
        .select('is_completed')
        .eq('user_id', session.user.id)
        .eq('lesson_id', String(lessonId))
        .maybeSingle();

      if (lessonProgData) {
        const completed = Boolean(lessonProgData.is_completed);
        setIsLessonCompleted(completed);
        if (completed) {
          cache.progressMap.set(String(lessonId), true);
        } else {
          cache.progressMap.delete(String(lessonId));
        }
      }
    }
    setLoading(false);
  };

  const toggleLessonCompletion = async () => {
    if (!userId) {
      alert('অনুগ্রহ করে আগে লগইন করুন।');
      return;
    }

    const nextStatus = !isLessonCompleted;
    setIsLessonCompleted(nextStatus); // Optimistic UI
    if (nextStatus) {
      cache.progressMap.set(String(lessonId), true);
    } else {
      cache.progressMap.delete(String(lessonId));
    }
    setUpdatingLessonProgress(true);

    const { error } = await supabase
      .from('user_lesson_progress')
      .upsert(
        {
          user_id: userId,
          lesson_id: String(lessonId),
          is_completed: nextStatus,
          completed_at: nextStatus ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' }
      );

    if (error) {
      console.error('Error toggling lesson completion:', error);
      setIsLessonCompleted(!nextStatus); // Rollback
      if (!nextStatus) {
        cache.progressMap.set(String(lessonId), true);
      } else {
        cache.progressMap.delete(String(lessonId));
      }
    }
    setUpdatingLessonProgress(false);
  };

  const updateSectionStatus = async (sectionId, newStatus) => {
    if (!userId) return;

    setProgressMap(prev => {
      const updated = { ...prev, [sectionId]: newStatus };
      cache.sectionProgressMap.set(String(lessonId), updated);
      return updated;
    });

    await supabase.from('user_section_progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      section_id: sectionId,
      status: newStatus,
      updated_at: new Date()
    }, { onConflict: 'user_id,lesson_id,section_id' });
  };

  if (loading && !lesson) return <div className="p-8 text-center text-gray-600">লেসন লোড হচ্ছে...</div>;
  if (!lesson) return <div className="p-8 text-center text-red-500">লেসন পাওয়া যায়নি!</div>;

  const content = lesson.content;
  const sections = content?.sections || [];

  // Filter calculations
  const counts = {
    all: sections.length,
    unread: sections.filter(s => (progressMap[s.id] || 'unread') === 'unread').length,
    learning: sections.filter(s => progressMap[s.id] === 'learning').length,
    known: sections.filter(s => progressMap[s.id] === 'known').length,
  };

  const filteredSections = sections.filter(s => {
    if (activeFilter === 'all') return true;
    const st = progressMap[s.id] || 'unread';
    return st === activeFilter;
  });

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Sticky Navbar */}
      <div className="bg-white shadow-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link className="font-semibold text-gray-500 hover:text-gray-800 transition-colors" to={`/course/${lesson.course_id}`}>&larr; ব্যাক</Link>
            <h1 className="text-xl font-bold text-gray-800 line-clamp-1">{lesson.title}</h1>
          </div>
          
          {/* Translation Toggle */}
          {lesson.lesson_type === 'translation' && (
            <label className="flex items-center cursor-pointer select-none">
              <span className="mr-3 text-sm font-bold text-gray-700">Show Translation</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={showTranslation} onChange={() => setShowTranslation(!showTranslation)} />
                <div className={`block w-12 h-7 rounded-full transition-colors ${showTranslation ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${showTranslation ? 'transform translate-x-5' : ''}`}></div>
              </div>
            </label>
          )}

          {/* 4 In-Lesson Filter Tabs */}
          {lesson.lesson_type === 'qa_sections' && sections.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeFilter === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                সব ({counts.all})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeFilter === 'unread' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                পড়া হয়নি ({counts.unread})
              </button>
              <button
                onClick={() => setActiveFilter('learning')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeFilter === 'learning' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                শিখতেছি ({counts.learning})
              </button>
              <button
                onClick={() => setActiveFilter('known')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeFilter === 'known' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                জানি ({counts.known})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl px-4 mx-auto space-y-8 mt-8">
        
        {/* 1. TRANSLATION LESSON */}
        {lesson.lesson_type === 'translation' && content?.s ? (
          content.s.map((sentence) => (
            <div 
              key={sentence.id} 
              className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center space-y-4 hover:shadow-md transition-shadow"
            >
              {/* আরবি টেক্সট */}
              <div className="w-full py-2" dir="rtl">
                {sentence.w && sentence.w.length > 0 ? (
                  <div className="text-xl sm:text-2xl font-semibold text-gray-900 leading-loose flex flex-wrap justify-center gap-x-1.5 gap-y-2" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
                    {sentence.w.map((word) => (
                      <WordPopup key={word.i} word={word}/>
                    ))}
                  </div>
                ) : (
                  <p className="text-xl sm:text-2xl font-arabic text-gray-900 text-center leading-loose tracking-wide py-2" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
                    {sentence.ar}
                  </p>
                )}
              </div>

              {/* ডিভাইডার লাইন (যদি অনুবাদ দেখানো থাকে) */}
              {showTranslation && (
                <div className="w-full border-t border-gray-100" />
              )}

              {/* বাংলা অনুবাদ */}
              {showTranslation && (
                <div className="w-full">
                  <p className="text-base text-gray-700 text-center leading-relaxed font-normal pt-2">
                    {sentence.bn || sentence.translation || sentence.bangla}
                  </p>
                </div>
              )}
            </div>
          ))
        ) : lesson.lesson_type === 'qa_sections' && sections.length > 0 ? (
          
          /* 2. FILTERED QA CARDS */
          filteredSections.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-3xl text-gray-500 font-medium">
              এই ক্যাটাগরিতে কোনো প্রশ্ন বা কার্ড নেই।
            </div>
          ) : (
            filteredSections.map((sec, idx) => {
              const status = progressMap[sec.id] || 'unread';
              const isKnown = status === 'known';

              return (
                <div 
                  key={sec.id} 
                  className={`bg-white rounded-3xl shadow-sm border-2 transition-all duration-300 overflow-hidden ${isKnown ? 'border-emerald-300 shadow-emerald-50/50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                      প্রশ্ন {idx + 1}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${isKnown ? 'bg-emerald-100 text-emerald-800' : status === 'learning' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                      {isKnown ? '✓ জানা হয়েছে' : status === 'learning' ? '⏳ শিখতেছি' : 'পড়া হয়নি'}
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-50/40 to-blue-50/20 border-b border-gray-100 flex flex-col justify-center items-center text-center space-y-3">
                    {sec.ar_question && (
                      <div className="w-full py-1" dir="rtl">
                        <p className="text-xl sm:text-2xl font-semibold text-gray-900 text-center leading-loose tracking-wide" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
                          {sec.ar_question}
                        </p>
                      </div>
                    )}
                    {sec.ar_question && sec.bn_question && (
                      <div className="w-full border-t border-indigo-100/60" />
                    )}
                    {sec.bn_question && (
                      <div className="w-full">
                        <p className="text-base text-gray-700 text-center leading-relaxed font-normal pt-1">
                          <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold mr-2 inline-block">প্রশ্ন</span>
                          {sec.bn_question}
                        </p>
                      </div>
                    )}
                  </div>

                  {sec.framework && (
                    <div className="px-6 md:px-8 py-4 bg-amber-50/60 border-b border-amber-100/60 flex items-start gap-3">
                      <span className="bg-amber-500 text-white text-xs px-2.5 py-1 rounded-md uppercase tracking-wider font-bold shrink-0 mt-0.5">ফ্রেমওয়ার্ক</span>
                      <p className="text-amber-950 font-semibold text-sm md:text-base leading-relaxed">{sec.framework}</p>
                    </div>
                  )}

                  <div className="p-6 md:p-8">
                    <div className="text-gray-800 text-base md:text-lg leading-loose whitespace-pre-line space-y-4 font-normal">
                      {sec.answer}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-6 md:px-8 py-4 bg-gray-50 border-t border-gray-100 gap-4">
                    <span className="text-sm font-bold text-gray-500">আপনার অগ্রগতি:</span>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => updateSectionStatus(sec.id, 'learning')}
                        className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${status === 'learning' ? 'bg-amber-400 border-amber-400 text-amber-950 shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                      >
                        শিখতেছি
                      </button>
                      <button 
                        onClick={() => updateSectionStatus(sec.id, 'known')}
                        className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${isKnown ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                      >
                        ✓ জানি
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          <div className="p-10 text-center bg-white border border-gray-100 rounded-lg shadow-sm text-gray-500">
            এই লেসন টাইপটির ডিজাইন এখনো তৈরি করা হয়নি।
          </div>
        )}

        {/* Bottom Lesson Completion Action Button */}
        <div className="pt-6 pb-8 flex flex-col items-center">
          <button
            type="button"
            disabled={updatingLessonProgress}
            onClick={toggleLessonCompletion}
            className={`w-full max-w-md py-4 px-6 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.99] ${
              isLessonCompleted
                ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-500 hover:bg-emerald-100/80 shadow-emerald-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-emerald-600 shadow-emerald-200'
            }`}
          >
            {isLessonCompleted ? (
              <>
                <svg className="w-6 h-6 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>✓ লেসনটি সম্পন্ন হয়েছে (ক্লিক করে আনমার্ক করুন)</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>লেসন সম্পন্ন হিসেবে চিহ্নিত করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
