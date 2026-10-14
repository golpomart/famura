import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function CourseOverview() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGlobalFilter, setActiveGlobalFilter] = useState('all'); // 'all' | 'unread' | 'learning' | 'known'
  const [progressSummary, setProgressSummary] = useState({});
  const [globalCounts, setGlobalCounts] = useState({ total: 0, unread: 0, learning: 0, known: 0 });
  const [allSectionsList, setAllSectionsList] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchCourseAndProgress();
  }, [courseId]);

  const fetchCourseAndProgress = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setUserId(session.user.id);

    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseData) setCourse(courseData);

    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (lessonsData) {
      let progressByLesson = {};
      if (session) {
        const { data: progressData } = await supabase
          .from('user_section_progress')
          .select('lesson_id, section_id, status')
          .eq('user_id', session.user.id);

        if (progressData) {
          progressData.forEach(item => {
            if (!progressByLesson[item.lesson_id]) progressByLesson[item.lesson_id] = {};
            progressByLesson[item.lesson_id][item.section_id] = item.status;
          });
        }
      }

      const summary = {};
      let gTotal = 0;
      let gKnown = 0;
      let gLearning = 0;
      const flatSections = [];

      lessonsData.forEach(lesson => {
        const sections = lesson.content?.sections || [];
        const lProg = progressByLesson[lesson.id] || {};
        let lKnown = 0;
        let lLearning = 0;

        sections.forEach(sec => {
          const status = lProg[sec.id] || 'unread';
          if (status === 'known') lKnown++;
          else if (status === 'learning') lLearning++;

          flatSections.push({
            ...sec,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            status
          });
        });

        const lUnread = sections.length - (lKnown + lLearning);
        summary[lesson.id] = {
          total: sections.length,
          unread: lUnread,
          learning: lLearning,
          known: lKnown
        };

        gTotal += sections.length;
        gKnown += lKnown;
        gLearning += lLearning;
      });

      setGlobalCounts({
        total: gTotal,
        unread: gTotal - (gKnown + gLearning),
        learning: gLearning,
        known: gKnown
      });

      setAllSectionsList(flatSections);
      setProgressSummary(summary);
      setLessons(lessonsData);
    }
    setLoading(false);
  };

  const updateGlobalSectionStatus = async (lessonId, sectionId, newStatus) => {
    if (!userId) return;

    // Optimistic UI update
    setAllSectionsList(prev => prev.map(s => (s.id === sectionId && s.lessonId === lessonId ? { ...s, status: newStatus } : s)));

    await supabase.from('user_section_progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      section_id: sectionId,
      status: newStatus,
      updated_at: new Date()
    }, { onConflict: 'user_id,lesson_id,section_id' });

    // Refresh count calculations
    fetchCourseAndProgress();
  };

  if (loading) return <div className="p-8 text-center text-gray-600 font-medium">লোড হচ্ছে...</div>;
  if (!course) return <div className="p-8 text-center text-red-500 font-bold">কোর্স পাওয়া যায়নি!</div>;

  const filteredGlobalSections = allSectionsList.filter(sec => {
    if (activeGlobalFilter === 'all') return true;
    return sec.status === activeGlobalFilter;
  });

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gray-50 pb-20">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <Link to="/" className="inline-block font-bold text-blue-600 hover:text-blue-800 transition-colors">
          &larr; ড্যাশবোর্ডে ফিরে যান
        </Link>

        {/* Course Header & Global Section Filters */}
        <div className="p-6 md:p-8 bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800">{course.title}</h1>
            <p className="mt-1 text-gray-500 font-medium">{course.description || 'কোর্সের বিস্তারিত'}</p>
          </div>

          {/* 4 Global Stat/Filter Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => setActiveGlobalFilter('all')}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                activeGlobalFilter === 'all'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100 scale-105'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="text-xs font-bold uppercase opacity-80">সব সেকশন</div>
              <div className="text-2xl font-black">{globalCounts.total}</div>
            </button>

            <button
              onClick={() => setActiveGlobalFilter('unread')}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                activeGlobalFilter === 'unread'
                  ? 'bg-gray-800 border-gray-800 text-white shadow-md scale-105'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-xs font-bold uppercase opacity-80">পড়া হয়নি</div>
              <div className="text-2xl font-black">{globalCounts.unread}</div>
            </button>

            <button
              onClick={() => setActiveGlobalFilter('learning')}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                activeGlobalFilter === 'learning'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100 scale-105'
                  : 'bg-white border-gray-200 text-amber-600 hover:border-amber-400'
              }`}
            >
              <div className="text-xs font-bold uppercase opacity-80">শিখতেছি</div>
              <div className="text-2xl font-black">{globalCounts.learning}</div>
            </button>

            <button
              onClick={() => setActiveGlobalFilter('known')}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                activeGlobalFilter === 'known'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 scale-105'
                  : 'bg-white border-gray-200 text-emerald-600 hover:border-emerald-400'
              }`}
            >
              <div className="text-xs font-bold uppercase opacity-80">জানি</div>
              <div className="text-2xl font-black">{globalCounts.known}</div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeGlobalFilter === 'all' ? (
          /* STANDARD LESSON LIST WITH DETAILED BADGES */
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-800">লেসন তালিকা ({lessons.length})</h2>
            <div className="flex flex-col gap-3">
              {lessons.map((lesson, index) => {
                const info = progressSummary[lesson.id] || { total: 0, unread: 0, learning: 0, known: 0 };
                return (
                  <Link
                    key={lesson.id}
                    to={`/lesson/${lesson.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all gap-4 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 font-bold text-blue-700 bg-blue-50 rounded-full shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                          {lesson.title}
                        </h3>
                      </div>
                    </div>

                    {/* 4 Mini Progress Indicators Inside Lesson Item */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 text-xs font-bold rounded-xl bg-gray-100 text-gray-700 border border-gray-200" title="মোট সেকশন">
                        মোট: {info.total}
                      </span>
                      <span className="px-3 py-1 text-xs font-bold rounded-xl bg-gray-50 text-gray-500 border border-gray-200" title="পড়া হয়নি">
                        পড়া হয়নি: {info.unread}
                      </span>
                      <span className="px-3 py-1 text-xs font-bold rounded-xl bg-amber-50 text-amber-800 border border-amber-200" title="শিখতেছি">
                        শিখতেছি: {info.learning}
                      </span>
                      <span className="px-3 py-1 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200" title="জানি">
                        জানি: {info.known}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          /* GLOBAL FILTERED SECTIONS VIEW (Card-by-Card Practice) */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                ফিল্টার করা সেকশনসমূহ ({filteredGlobalSections.length})
              </h2>
              <button
                onClick={() => setActiveGlobalFilter('all')}
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                &larr; স্বাভাবিক লেসন তালিকায় ফিরে যান
              </button>
            </div>

            {filteredGlobalSections.length === 0 ? (
              <div className="p-10 text-center bg-white border border-gray-200 rounded-3xl text-gray-500 font-medium">
                এই ক্যাটাগরিতে কোনো সেকশন নেই।
              </div>
            ) : (
              filteredGlobalSections.map((sec, idx) => {
                const isKnown = sec.status === 'known';
                return (
                  <div
                    key={`${sec.lessonId}_${sec.id}`}
                    className={`bg-white rounded-3xl shadow-sm border-2 transition-all duration-300 overflow-hidden ${
                      isKnown ? 'border-emerald-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-500">
                        লেসন: {sec.lessonTitle} • কার্ড #{idx + 1}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${isKnown ? 'bg-emerald-100 text-emerald-800' : sec.status === 'learning' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                        {isKnown ? '✓ জানি' : sec.status === 'learning' ? '⏳ শিখতেছি' : 'পড়া হয়নি'}
                      </span>
                    </div>

                    <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-50/40 to-blue-50/20 border-b border-gray-100">
                      {sec.ar_question && (
                        <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-right leading-relaxed" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
                          {sec.ar_question}
                        </div>
                      )}
                      {sec.bn_question && (
                        <div className="text-lg md:text-xl font-bold text-indigo-950 flex items-start gap-3">
                          <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0 mt-0.5">প্রশ্ন</span>
                          <span>{sec.bn_question}</span>
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

                    <div className="flex items-center justify-between px-6 md:px-8 py-4 bg-gray-50 border-t border-gray-100">
                      <span className="text-sm font-bold text-gray-500">স্ট্যাটাস পরিবর্তন:</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateGlobalSectionStatus(sec.lessonId, sec.id, 'learning')}
                          className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
                            sec.status === 'learning' ? 'bg-amber-400 border-amber-400 text-amber-950 shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          শিখতেছি
                        </button>
                        <button
                          onClick={() => updateGlobalSectionStatus(sec.lessonId, sec.id, 'known')}
                          className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
                            sec.status === 'known' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          ✓ জানি
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
