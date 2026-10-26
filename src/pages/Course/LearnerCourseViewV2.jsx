import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function getEmbedUrl(url) {
  if (!url) return '';
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch && ytMatch[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return url;
}

export default function LearnerCourseViewV2() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);

  // লিস্ট আইটেম নেভিগেশন স্টেট: null মানে লিস্ট ভিউ, আর সিলেক্ট থাকলে ওই আইটেমের ভিউ
  const [activeTopicId, setActiveTopicId] = useState(null);

  const [readingMode, setReadingMode] = useState('active');
  const [openPassageCards, setOpenPassageCards] = useState({});
  const [hiddenQACards, setHiddenQACards] = useState({});
  const [openDetailedCards, setOpenDetailedCards] = useState({});

  const [savedCardIds, setSavedCardIds] = useState(new Set());
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { initData(); }, []);

  const initData = async () => {
    const { data: { user: currUser } } = await supabase.auth.getUser();
    setUser(currUser);
    const { data: courseList } = await supabase.from('v2_courses').select('*').eq('is_published', true).order('created_at', { ascending: false });
    if (courseList) {
      setCourses(courseList);
      if (courseList.length === 1) await handleSelectCourse(courseList[0], currUser);
    }
    if (currUser) {
      const { data: savedData } = await supabase.from('user_saved_flashcards').select('card_id').eq('user_id', currUser.id);
      if (savedData) setSavedCardIds(new Set(savedData.map(item => item.card_id)));
      const { data: progData } = await supabase.from('user_lesson_progress').select('lesson_id').eq('user_id', currUser.id).eq('is_completed', true);
      if (progData) setCompletedLessonIds(new Set(progData.map(p => String(p.lesson_id))));
    }
    setLoading(false);
  };

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    const { data: modData } = await supabase.from('v2_modules').select('*').eq('course_id', course.id).order('order_index');
    const { data: lesData } = await supabase.from('v2_lessons').select('*').eq('course_id', course.id).order('order_index');
    setModules(modData || []); setLessons(lesData || []);
    if (lesData?.length > 0) {
      setActiveLesson(lesData[0]); setActiveTopicId(null); setOpenPassageCards({}); setHiddenQACards({}); setOpenDetailedCards({});
    } else setActiveLesson(null);
  };

  const togglePassageCard = (id) => setOpenPassageCards(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleQAEye = (id) => setHiddenQACards(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleDetailedCard = (id) => setOpenDetailedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleAllQAInBlock = (subQuestions = []) => {
    const allHidden = subQuestions.every(sq => hiddenQACards[sq.id]);
    const nextState = { ...hiddenQACards };
    subQuestions.forEach(sq => { nextState[sq.id] = !allHidden; });
    setHiddenQACards(nextState);
  };

  const handleToggleSaveFlashcard = async (card, sourceType, parentQuestion = null, e) => {
    if (e) e.stopPropagation();
    if (!user) return alert('কার্ড সেভ করতে লগইন করুন!');
    const cardId = String(card.id);
    const isSaved = savedCardIds.has(cardId);
    setSavedCardIds(prev => {
      const next = new Set(prev);
      isSaved ? next.delete(cardId) : next.add(cardId);
      return next;
    });
    if (isSaved) await supabase.from('user_saved_flashcards').delete().eq('user_id', user.id).eq('card_id', cardId);
    else await supabase.from('user_saved_flashcards').upsert({ user_id: user.id, lesson_id: activeLesson.id, card_id: cardId, source_type: sourceType, parent_question: parentQuestion, question: card.question, answer: card.answer }, { onConflict: 'user_id,card_id' });
  };

  const handleToggleLessonComplete = async () => {
    if (!user || !activeLesson) return;
    const lid = String(activeLesson.id);
    const isDone = completedLessonIds.has(lid);
    setCompletedLessonIds(prev => {
      const next = new Set(prev);
      !isDone ? next.add(lid) : next.delete(lid);
      return next;
    });
    await supabase.from('user_lesson_progress').upsert({ user_id: user.id, lesson_id: lid, is_completed: !isDone, completed_at: !isDone ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
  };

  if (loading) return <div className="p-10 text-center">লোড হচ্ছে...</div>;

  if (!selectedCourse) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between bg-white p-6 rounded-2xl border">
          <h1 className="text-2xl font-bold">📚 আমার কোর্সসমূহ</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/v2/revision')} className="px-4 py-2 bg-amber-50 text-amber-800 rounded-xl font-bold">🔖 রিভিশন ভল্ট ({savedCardIds.size})</button>
            <button onClick={() => navigate('/v2/admin')} className="px-4 py-2 bg-gray-100 rounded-xl font-semibold">⚙️ কোর্স বিল্ডার</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {courses.map(course => (
            <div key={course.id} onClick={() => handleSelectCourse(course)} className="bg-white p-6 rounded-2xl border cursor-pointer hover:border-blue-400">
              <h3 className="text-lg font-bold">{course.title}</h3>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allBlocks = activeLesson?.lesson_data?.blocks || [];
  const topicBlocks = allBlocks.filter(b => b.type === 'topic_item');
  const hasTopics = topicBlocks.length > 0;
  const currentTopic = topicBlocks.find(t => t.id === activeTopicId);

  // যে ব্লকগুলো এখন রেন্ডার হবে (টপিক সিলেক্ট থাকলে তার ভেতরের ব্লক, অন্যথায় সাধারণ ব্লক)
  const displayBlocks = hasTopics && currentTopic ? currentTopic.blocks : (!hasTopics ? allBlocks : []);

  // ব্লক রেন্ডার করার হেল্পার
  const renderBlockItem = (block, bIdx) => (
    <div key={block.id || bIdx}>
      {block.type === 'video' && block.url && (
        <div className="bg-white p-4 rounded-2xl border mb-4"><iframe src={getEmbedUrl(block.url)} className="w-full aspect-video rounded-xl" /></div>
      )}

      {block.type === 'passage' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border space-y-4">
          {block.items?.map((item, i) => {
            if (item.itemType === 'paragraph') return <div key={i} className="text-[17px] leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{ __html: item.text }} />;
            if (readingMode === 'book') return null;
            const isOpen = Boolean(openPassageCards[item.id]);
            const isSaved = savedCardIds.has(String(item.id));
            return (
              <div key={item.id} className="my-2 rounded-xl border bg-slate-50">
                <div onClick={() => togglePassageCard(item.id)} className="px-4 py-3 flex justify-between items-center cursor-pointer">
                  <span className="font-bold text-indigo-950 flex-1">❓ {item.question}</span>
                  <button onClick={(e) => handleToggleSaveFlashcard(item, 'passage', null, e)} className={`px-2.5 py-1 text-xs font-bold border rounded ml-3 ${isSaved ? 'bg-amber-400 border-amber-500' : 'bg-white'}`}>🔖</button>
                </div>
                {isOpen && <div className="px-4 py-3 bg-white border-t text-[15px] font-semibold text-emerald-800">✓ {item.answer}</div>}
              </div>
            );
          })}
        </div>
      )}

      {block.type === 'detailed_qa' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-emerald-200 mt-6 space-y-4">
          <div className="border-b border-emerald-100 pb-3 mb-4">
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase bg-emerald-100 text-emerald-900 rounded-md">
              📝 বিস্তারিত প্রশ্নোত্তর (Detailed Analysis)
            </span>
          </div>
          <div className="space-y-3">
            {block.items?.map((item) => {
              const isOpen = Boolean(openDetailedCards[item.id]);
              const isSaved = savedCardIds.has(String(item.id));
              return (
                <div key={item.id} className="border border-emerald-200 rounded-xl overflow-hidden bg-white transition shadow-sm">
                  <div onClick={() => toggleDetailedCard(item.id)} className="p-4 bg-emerald-50/50 flex items-start justify-between gap-3 cursor-pointer select-none">
                    <h4 className="text-base font-bold text-emerald-950 flex-1 leading-snug">
                      <span className="text-emerald-700 mr-2">প্রশ্ন:</span>{item.question}
                    </h4>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={(e) => handleToggleSaveFlashcard(item, 'detailed_qa', null, e)} className={`px-2.5 py-1 rounded text-xs font-bold border ${isSaved ? 'bg-amber-400 border-amber-500 text-amber-900' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {isSaved ? '🔖 সেভড' : '🔖 সেভ'}
                      </button>
                      <span className="text-emerald-600 font-bold text-lg">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div 
                      className="p-5 border-t border-emerald-100 text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.answer }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {block.type === 'qa_group' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-amber-200 mt-6 space-y-5">
          <div className="flex justify-between border-b pb-4">
            <h3 className="text-xl font-bold">🎯 {block.mainQuestion}</h3>
            <button onClick={() => toggleAllQAInBlock(block.subQuestions)} className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold">👁️ টগল সব</button>
          </div>
          <div className="space-y-3">
            {block.subQuestions?.map((sq, sIdx) => {
              const isHidden = Boolean(hiddenQACards[sq.id]);
              const isSaved = savedCardIds.has(String(sq.id));
              return (
                <div key={sq.id} className="p-4 rounded-xl border bg-amber-50/20">
                  <div className="flex justify-between gap-3">
                    <h4 className="text-base font-bold">{sIdx + 1}. {sq.question}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => toggleQAEye(sq.id)} className="px-2 py-1 text-xs border rounded bg-white">👁️</button>
                      <button onClick={(e) => handleToggleSaveFlashcard(sq, 'qa_group', block.mainQuestion, e)} className={`px-2 py-1 text-xs border rounded ${isSaved ? 'bg-amber-400' : 'bg-white'}`}>🔖</button>
                    </div>
                  </div>
                  {isHidden ? (
                    <div onClick={() => toggleQAEye(sq.id)} className="mt-3 p-3 bg-gray-100 text-center text-xs text-gray-500 cursor-pointer rounded-lg">🔒 উত্তর লুকানো আছে</div>
                  ) : (
                    <div className="mt-3 p-3 bg-white border rounded-lg text-[15px]">{sq.answer}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedCourse(null)} className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold">← সব কোর্স</button>
            <h1 className="text-lg font-bold">{selectedCourse.title}</h1>
          </div>
          <div className="flex gap-3">
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1 border">
              <button onClick={() => setReadingMode('active')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${readingMode === 'active' ? 'bg-indigo-600 text-white' : ''}`}>🧠 প্রশ্নসহ</button>
              <button onClick={() => setReadingMode('book')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${readingMode === 'book' ? 'bg-emerald-600 text-white' : ''}`}>📖 বুক মোড</button>
            </div>
            <button onClick={() => navigate('/v2/revision')} className="px-3.5 py-2 bg-amber-50 text-amber-900 border rounded-xl text-xs font-bold">🔖 রিভিশন ভল্ট ({savedCardIds.size})</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 bg-white p-4 rounded-2xl border h-fit">
          <h2 className="text-sm font-bold border-b pb-2 mb-3">📑 সূচিপত্র</h2>
          {modules.map((mod, mIdx) => (
            <div key={mod.id} className="mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">{mod.title}</p>
              {lessons.filter(l => l.module_id === mod.id).map(les => (
                <button key={les.id} onClick={() => { setActiveLesson(les); setActiveTopicId(null); setOpenPassageCards({}); setHiddenQACards({}); setOpenDetailedCards({}); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs flex justify-between ${activeLesson?.id === les.id ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-100'}`}>
                  <span className="truncate">{les.title}</span>
                  {completedLessonIds.has(String(les.id)) && <span>✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-6">
          <div className="bg-white p-6 rounded-2xl border flex justify-between items-center">
            <h2 className="text-2xl font-bold">{activeLesson?.title}</h2>
          </div>

          {/* ১. যদি লেসনে একাধিক ITEM_START থাকে এবং বর্তমানে কোনো নির্দিষ্ট আইটেম সিলেক্ট না থাকে -> তালিকা দেখাবে */}
          {hasTopics && !activeTopicId && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200">
                <h3 className="font-bold text-purple-900 text-base">📋 প্রশ্ন ও বিষয়ভিত্তিক সূচিপত্র ({topicBlocks.length} টি বিষয়)</h3>
                <p className="text-xs text-purple-700 mt-0.5">পড়া শুরু করতে নিচের যেকোনো প্রশ্নে ক্লিক করুন</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {topicBlocks.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    onClick={() => { setActiveTopicId(t.id); setOpenDetailedCards({}); }}
                    className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-purple-400 hover:shadow-md cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-gray-900 text-base group-hover:text-purple-700">
                        {t.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600">
                      <span>পড়ুন ও বিশ্লেষণ দেখুন</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ২. যদি কোনো নির্দিষ্ট টপিক ওপেন থাকে -> টপ বার ও ব্যাক বাটন */}
          {hasTopics && activeTopicId && currentTopic && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-purple-50 p-4 rounded-2xl border border-purple-200">
                <button
                  onClick={() => setActiveTopicId(null)}
                  className="px-3.5 py-1.5 bg-white text-purple-900 border border-purple-300 rounded-xl text-xs font-bold hover:bg-purple-100 flex items-center gap-1.5"
                >
                  ← প্রশ্ন তালিকায় ফিরে যান
                </button>
                <h3 className="font-bold text-purple-950 text-sm truncate max-w-md">
                  {currentTopic.title}
                </h3>
              </div>

              {displayBlocks.map((block, idx) => renderBlockItem(block, idx))}

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setActiveTopicId(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  ← সূচিপত্রে ফিরে যান
                </button>
              </div>
            </div>
          )}

          {/* ৩. সাধারণ লেসন (যদি ITEM_START ছাড়া স্বাভাবিক লেসন হয়) */}
          {!hasTopics && displayBlocks.map((block, idx) => renderBlockItem(block, idx))}

          <div className="py-6 flex justify-center">
            <button onClick={handleToggleLessonComplete} className={`px-6 py-3 rounded-xl font-bold w-full max-w-sm ${completedLessonIds.has(String(activeLesson?.id)) ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white'}`}>
              {completedLessonIds.has(String(activeLesson?.id)) ? '✓ সম্পন্ন হয়েছে' : 'সম্পন্ন করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
