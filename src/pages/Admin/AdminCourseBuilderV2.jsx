import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const uid = () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

// ============================================================================
// ইউনিফাইড স্মার্ট টেক্সট টু JSON কনভার্টার ইঞ্জিন
// ============================================================================
function parseUnifiedSmartText(rawText, topVideoUrl = '') {
  const blocks = [];

  // ১. যদি উপরের ডেডিকেটেড ভিডিও বক্সে লিংক থাকে
  if (topVideoUrl && topVideoUrl.trim()) {
    blocks.push({
      id: uid(),
      type: 'video',
      url: topVideoUrl.trim(),
    });
  }

  const lines = (rawText || '').split('\n');
  let currentPassageBlock = null;
  let currentQABlock = null;
  let pendingQuestion = null;
  let mode = 'passage'; // 'passage' | 'qa_group'

  const flushPendingPassage = () => {
    if (currentPassageBlock && currentPassageBlock.items.length > 0) {
      blocks.push(currentPassageBlock);
      currentPassageBlock = null;
    }
  };

  const flushPendingQA = () => {
    if (currentQABlock) {
      blocks.push(currentQABlock);
      currentQABlock = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // ভিডিও লাইন: VID::
    if (/^VID::/i.test(trimmed)) {
      flushPendingPassage();
      flushPendingQA();
      mode = 'passage';
      const url = trimmed.replace(/^VID::\s*/i, '');
      if (url) {
        blocks.push({ id: uid(), type: 'video', url });
      }
      return;
    }

    // প্যাসেজ মোডে ফেরার জোরালো সংকেত: PASSAGE::
    if (/^PASSAGE::/i.test(trimmed)) {
      flushPendingQA();
      mode = 'passage';
      const textAfter = trimmed.replace(/^PASSAGE::\s*/i, '');
      if (textAfter) {
        if (!currentPassageBlock) {
          currentPassageBlock = { id: uid(), type: 'passage', items: [] };
        }
        currentPassageBlock.items.push({ id: uid(), itemType: 'paragraph', text: textAfter });
      }
      return;
    }

    // মেইন বড় প্রশ্ন: MQ::
    if (/^MQ::/i.test(trimmed)) {
      flushPendingPassage();
      flushPendingQA();
      mode = 'qa_group';
      const mqText = trimmed.replace(/^MQ::\s*/i, '');
      currentQABlock = {
        id: uid(),
        type: 'qa_group',
        mainQuestion: mqText,
        subQuestions: [],
      };
      return;
    }

    // ছোট প্রশ্ন: Q::
    if (/^Q::/i.test(trimmed)) {
      pendingQuestion = trimmed.replace(/^Q::\s*/i, '');
      return;
    }

    // ছোট প্রশ্নের উত্তর: A::
    if (/^A::/i.test(trimmed)) {
      const answerText = trimmed.replace(/^A::\s*/i, '');
      if (pendingQuestion) {
        if (mode === 'qa_group' && currentQABlock) {
          currentQABlock.subQuestions.push({
            id: uid(),
            question: pendingQuestion,
            answer: answerText,
          });
        } else {
          if (!currentPassageBlock) {
            currentPassageBlock = { id: uid(), type: 'passage', items: [] };
          }
          currentPassageBlock.items.push({
            id: uid(),
            itemType: 'qa',
            question: pendingQuestion,
            answer: answerText,
          });
        }
        pendingQuestion = null;
      }
      return;
    }

    // কোনো সাইন না থাকলে সেটি সাধারণ প্যাসেজ বা HTML টেক্সট
    if (mode === 'qa_group') {
      flushPendingQA();
      mode = 'passage';
    }
    if (!currentPassageBlock) {
      currentPassageBlock = { id: uid(), type: 'passage', items: [] };
    }
    currentPassageBlock.items.push({
      id: uid(),
      itemType: 'paragraph',
      text: trimmed,
    });
  });

  flushPendingPassage();
  flushPendingQA();

  return blocks;
}

export default function AdminCourseBuilderV2() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // নতুন কোর্স তৈরির স্টেট
  const [showNewCourseBox, setShowNewCourseBox] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');

  // মডিউল ও লেসন তালিকা স্টেট
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  // সিঙ্গেল ইউনিফাইড লেসন এডিটর স্টেট
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [topVideoUrl, setTopVideoUrl] = useState('');
  const [unifiedRawText, setUnifiedRawText] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [previewBlocks, setPreviewBlocks] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('v2_courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCourses(data);
  };

  const fetchCourseCurriculum = async (courseId) => {
    const { data: modData } = await supabase
      .from('v2_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    const { data: lesData } = await supabase
      .from('v2_lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    setModules(modData || []);
    setLessons(lesData || []);
  };

  // কোর্স তৈরি ও ডিলিট
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseTitle.trim()) return alert('কোর্সের নাম দিন!');
    const { data, error } = await supabase
      .from('v2_courses')
      .insert([{ title: courseTitle.trim(), description: courseDesc.trim() }])
      .select()
      .single();

    if (error) return alert(error.message);
    setCourseTitle('');
    setCourseDesc('');
    setShowNewCourseBox(false);
    fetchCourses();
    openCourseBuilder(data);
  };

  const handleDeleteCourse = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('এই কোর্স এবং এর সব মডিউল ও লেসন মুছে যাবে। নিশ্চিত?')) return;
    await supabase.from('v2_courses').delete().eq('id', id);
    fetchCourses();
  };

  const openCourseBuilder = (course) => {
    setSelectedCourse(course);
    setEditingLesson(null);
    setActiveModuleId(null);
    fetchCourseCurriculum(course.id);
  };

  // মডিউল তৈরি ও ডিলিট
  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    const { data, error } = await supabase
      .from('v2_modules')
      .insert([{
        course_id: selectedCourse.id,
        title: newModuleTitle.trim(),
        order_index: modules.length + 1,
      }])
      .select()
      .single();

    if (!error && data) {
      setModules([...modules, data]);
      setNewModuleTitle('');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('এই মডিউল এবং এর ভেতরের সব লেসন মুছে ফেলতে চান?')) return;
    await supabase.from('v2_modules').delete().eq('id', moduleId);
    if (activeModuleId === moduleId) setEditingLesson(null);
    fetchCourseCurriculum(selectedCourse.id);
  };

  // নতুন লেসন ওপেন
  const startNewLesson = (moduleId) => {
    setActiveModuleId(moduleId);
    setEditingLesson({ isNew: true });
    setLessonTitle('');
    setTopVideoUrl('');
    setShowVideoInput(false);
    setUnifiedRawText('');
    setPreviewBlocks([]);
  };

  // পুরনো লেসন এডিট করতে ওপেন
  const openEditLesson = (lesson) => {
    setActiveModuleId(lesson.module_id);
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);

    const data = lesson.lesson_data || {};
    // যদি আগের কাস্টম rawText সেভ করা থাকে তবে সরাসরি সেটিই বসিয়ে দেবে
    if (data.rawText !== undefined) {
      setUnifiedRawText(data.rawText);
      setTopVideoUrl(data.topVideoUrl || '');
      setShowVideoInput(Boolean(data.topVideoUrl));
      setPreviewBlocks(data.blocks || []);
    } else {
      // ব্যাকওয়ার্ড কম্প্যাটিবিলিটি
      setUnifiedRawText('');
      setTopVideoUrl('');
      setPreviewBlocks(data.blocks || []);
    }
  };

  // লাইভ প্রিভিউ জেনারেট
  const handlePreview = () => {
    const blocks = parseUnifiedSmartText(unifiedRawText, topVideoUrl);
    setPreviewBlocks(blocks);
  };

  // কার্সরের জায়গায় কুইক সাইন বসানোর হেল্পার
  const insertSign = (signTemplate) => {
    setUnifiedRawText((prev) => (prev ? `${prev}\n${signTemplate}` : signTemplate));
  };

  // লেসন ডাটাবেসে সেভ করা
  const handleSaveLesson = async () => {
    if (!lessonTitle.trim()) return alert('লেসনের শিরোনাম দিন!');
    setSaving(true);

    const generatedBlocks = parseUnifiedSmartText(unifiedRawText, topVideoUrl);
    setPreviewBlocks(generatedBlocks);

    const moduleLessons = lessons.filter((l) => l.module_id === activeModuleId);

    const payload = {
      course_id: selectedCourse.id,
      module_id: activeModuleId,
      title: lessonTitle.trim(),
      lesson_type: 'unified',
      lesson_data: {
        topVideoUrl: topVideoUrl.trim(),
        rawText: unifiedRawText,
        blocks: generatedBlocks,
      },
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingLesson?.id) {
      const res = await supabase
        .from('v2_lessons')
        .update(payload)
        .eq('id', editingLesson.id);
      error = res.error;
    } else {
      payload.order_index = moduleLessons.length + 1;
      const res = await supabase.from('v2_lessons').insert([payload]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      alert('সেভ করতে সমস্যা: ' + error.message);
    } else {
      fetchCourseCurriculum(selectedCourse.id);
      alert('লেসন সফলভাবে সেভ হয়েছে!');
    }
  };

  const handleDeleteLesson = async (lessonId, e) => {
    e.stopPropagation();
    if (!window.confirm('এই লেসনটি মুছে ফেলতে চান?')) return;
    await supabase.from('v2_lessons').delete().eq('id', lessonId);
    if (editingLesson?.id === lessonId) setEditingLesson(null);
    fetchCourseCurriculum(selectedCourse.id);
  };

  // ============================================================================
  // ভিউ ১: কোর্স লিস্ট পেজ
  // ============================================================================
  if (!selectedCourse) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">কোর্স ম্যানেজমেন্ট (LMS Studio)</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                কোর্স নির্বাচন করে কারিকুলাম ও লেসন তৈরি করুন অথবা নতুন কোর্স খুলুন
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewCourseBox(!showNewCourseBox)}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-blue-700 transition"
              >
                + নতুন কোর্স তৈরি করুন
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                পুরনো ড্যাশবোর্ড
              </button>
            </div>
          </div>

          {showNewCourseBox && (
            <form
              onSubmit={handleCreateCourse}
              className="bg-white p-6 rounded-2xl shadow-md border-2 border-blue-100 space-y-4"
            >
              <h2 className="text-base font-bold text-gray-800">নতুন কোর্সের তথ্য দিন</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    কোর্সের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="যেমন: বিসিএস বাংলা প্রস্তুতি / আল-কুরআনের ভাষা"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={courseDesc}
                    onChange={(e) => setCourseDesc(e.target.value)}
                    placeholder="কোর্স সম্পর্কে এক লাইনে বিবরণ..."
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCourseBox(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  কোর্স তৈরি ও কারিকুলামে যান →
                </button>
              </div>
            </form>
          )}

          {courses.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
              <p className="text-gray-500 text-base">এখনো কোনো কোর্স তৈরি করা হয়নি।</p>
              <button
                onClick={() => setShowNewCourseBox(true)}
                className="px-4 py-2 bg-blue-50 text-blue-600 font-semibold text-sm rounded-xl border border-blue-200"
              >
                + আপনার প্রথম কোর্স তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => openCourseBuilder(course)}
                  className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 rounded-md">
                        কোর্স
                      </span>
                      <button
                        onClick={(e) => handleDeleteCourse(course.id, e)}
                        className="text-gray-400 hover:text-red-600 text-xs px-2 py-0.5 rounded"
                      >
                        ✕
                      </button>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mt-3 group-hover:text-blue-600">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                    <span>কারিকুলাম ও লেসন সাজান</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // ভিউ ২: কারিকুলাম ও ইউনিফাইড সিঙ্গেল-বক্স লেসন এডিটর
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* টপ বার */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCourse(null)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
            >
              ← সব কোর্স
            </button>
            <div>
              <span className="text-[11px] font-bold uppercase text-blue-600">কোর্স কারিকুলাম</span>
              <h1 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* বাম পাশ: মডিউল ও লেসন তালিকা (৪ কলাম) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 h-fit space-y-4">
            <h2 className="text-base font-bold text-gray-800 border-b pb-2.5">
              📚 কারিকুলাম (মডিউল ও লেসন)
            </h2>

            <form onSubmit={handleAddModule} className="flex gap-2">
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="নতুন মডিউল বা অধ্যায়ের নাম..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 shrink-0"
              >
                + মডিউল
              </button>
            </form>

            {modules.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
                প্রথমে উপরে একটি মডিউল বা অধ্যায়ের নাম লিখে <b>+ মডিউল</b> বাটনে ক্লিক করুন।
              </div>
            ) : (
              <div className="space-y-3.5">
                {modules.map((mod, mIdx) => {
                  const modLessons = lessons.filter((l) => l.module_id === mod.id);
                  return (
                    <div
                      key={mod.id}
                      className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50"
                    >
                      <div className="bg-gray-100/80 px-3.5 py-2.5 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-800 text-xs">
                          মডিউল {mIdx + 1}: {mod.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startNewLesson(mod.id)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700"
                          >
                            + লেসন
                          </button>
                          <button
                            onClick={() => handleDeleteModule(mod.id)}
                            className="text-gray-400 hover:text-red-600 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="p-2 space-y-1.5">
                        {modLessons.length === 0 ? (
                          <p className="text-[11px] text-gray-400 px-2 py-1">
                            কোনো লেসন নেই। '+ লেসন'-এ ক্লিক করুন।
                          </p>
                        ) : (
                          modLessons.map((les, lIdx) => {
                            const isSelected = editingLesson?.id === les.id;
                            return (
                              <div
                                key={les.id}
                                onClick={() => openEditLesson(les)}
                                className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                }`}
                              >
                                <span className="truncate">
                                  {lIdx + 1}. {les.title}
                                </span>
                                <button
                                  onClick={(e) => handleDeleteLesson(les.id, e)}
                                  className="text-gray-400 hover:text-red-600 px-1 shrink-0"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ডান পাশ: ইউনিফাইড সিঙ্গেল-বক্স লেসন বিল্ডার (৮ কলাম) */}
          <div className="lg:col-span-8">
            {!editingLesson ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-base font-semibold text-gray-700">
                  বাম পাশের যেকোনো মডিউলের <b>"+ লেসন"</b> বাটনে ক্লিক করে নতুন লেসন তৈরি করুন
                </p>
                <p className="text-xs text-gray-400">
                  অথবা বিদ্যমান কোনো লেসনের ওপর ক্লিক করে সম্পাদনা করুন।
                </p>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingLesson.id ? '✏️ লেসন সম্পাদনা করুন' : '➕ নতুন লেসন তৈরি করুন'}
                  </h2>
                  <button
                    onClick={() => setEditingLesson(null)}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    বন্ধ করুন ✕
                  </button>
                </div>

                {/* লেসনের শিরোনাম + ঐচ্ছিক ভিডিও ট্যাব বাটন */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      লেসনের শিরোনাম *
                    </label>
                    <input
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="যেমন: পাঠ ১ - কাজী নজরুল ইসলাম ও তাঁর সাহিত্যকর্ম"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVideoInput(!showVideoInput)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition shrink-0 ${
                      showVideoInput || topVideoUrl
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    🎬 {showVideoInput ? 'ভিডিও বক্স লুকান' : '+ উপরে ভিডিও লিংক যুক্ত করুন'}
                  </button>
                </div>

                {/* ঐচ্ছিক ডেডিকেটেড ভিডিও লিংক বক্স */}
                {showVideoInput && (
                  <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl">
                    <label className="block text-xs font-bold text-rose-800 mb-1">
                      লেসনের শুরুতে ভিডিও (YouTube / Bunny / সরাসরি লিংক বা Embed URL):
                    </label>
                    <input
                      type="text"
                      value={topVideoUrl}
                      onChange={(e) => setTopVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3.5 py-2 bg-white border border-rose-300 rounded-lg text-sm outline-none"
                    />
                  </div>
                )}

                {/* ইউনিফাইড সাইন গাইড ও কুইক ইনসার্ট টুলবার */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      ⚡ অল-ইন-ওয়ান স্মার্ট ইনপুট বক্স (প্যাসেজ, HTML, প্রশ্নোত্তর ও ভিডিও সব এক জায়গায়):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => insertSign('Q:: প্রশ্ন লিখুন\nA:: উত্তর লিখুন')}
                        className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-bold hover:bg-indigo-200"
                      >
                        + Q:: / A:: (ছোট প্রশ্ন)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertSign('MQ:: মূল বড় প্রশ্ন লিখুন\nQ:: পয়েন্ট ১ প্রশ্ন?\nA:: পয়েন্ট ১ উত্তর')
                        }
                        className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[11px] font-bold hover:bg-amber-200"
                      >
                        + MQ:: (বড় প্রশ্নোত্তর)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertSign('VID:: https://')}
                        className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold hover:bg-rose-200"
                      >
                        + VID:: (মাঝখানে ভিডিও)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>
                      • <b>সাধারণ লাইন বা HTML:</b> প্যাসেজ রিডিংয়ের মূল টেক্সট হবে।<br />
                      • <b><code>Q::</code> এবং <code>A::</code></b> : প্যাসেজ বা বড় প্রশ্নের ফ্ল্যাশকার্ড।
                    </div>
                    <div>
                      • <b><code>MQ::</code></b> : নতুন বড় প্রশ্ন (Question-Answer) শুরু করবে।<br />
                      • <b><code>PASSAGE::</code></b> : বড় প্রশ্নের পর আবার সাধারণ প্যাসেজ শুরু করতে।
                    </div>
                  </div>

                  {/* একমাত্র মাস্টার টেক্সট ইনপুট বক্স */}
                  <textarea
                    rows={14}
                    value={unifiedRawText}
                    onChange={(e) => setUnifiedRawText(e.target.value)}
                    placeholder={`বাংলাদেশের জাতীয় কবি <b>কাজী নজরুল ইসলাম</b>।\nQ:: বাংলাদেশের জাতীয় কবি কে?\nA:: কাজী নজরুল ইসলাম\n\nMQ:: কাজী নজরুল ইসলামের সাহিত্যকর্ম আলোচনা করো।\nQ:: তাঁর বিখ্যাত কবিতা কোনটি?\nA:: বিদ্রোহী কবিতা।\nQ:: তাঁর বিখ্যাত কাব্যগ্রন্থ কী কী?\nA:: অগ্নিবীণা, বিষের বাঁশি ইত্যাদি।`}
                    className="w-full p-4 border border-gray-300 rounded-xl text-sm font-mono leading-relaxed bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handlePreview}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
                    >
                      👁️ কনভার্ট ও প্রিভিউ দেখুন
                    </button>
                    <span className="text-xs text-gray-500">
                      সেভ বাটনে ক্লিক করলেও স্বয়ংক্রিয়ভাবে JSON কনভার্ট হয়ে সেভ হবে
                    </span>
                  </div>
                </div>

                {/* জেনারেটেড প্রিভিউ সেকশন */}
                {previewBlocks.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 max-h-96 overflow-y-auto">
                    <h4 className="text-xs font-bold uppercase text-gray-500">
                      জেনারেটেড লেসন প্রিভিউ ({previewBlocks.length} টি ব্লক):
                    </h4>
                    {previewBlocks.map((b, idx) => (
                      <div key={b.id || idx} className="bg-white p-3.5 rounded-xl border space-y-2">
                        {b.type === 'video' && (
                          <div className="text-xs font-bold text-rose-700 bg-rose-50 p-2 rounded">
                            🎬 ভিডিও এম্বেড: {b.url}
                          </div>
                        )}

                        {b.type === 'passage' && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              📖 Passage Reading Block
                            </span>
                            {b.items.map((item, i) =>
                              item.itemType === 'paragraph' ? (
                                <div
                                  key={i}
                                  className="text-sm text-gray-800 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: item.text }}
                                />
                              ) : (
                                <div
                                  key={i}
                                  className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs"
                                >
                                  <span className="font-bold text-indigo-900">
                                    ❓ {item.question}
                                  </span>
                                  <p className="text-emerald-700 font-semibold mt-0.5">
                                    ✓ উত্তর: {item.answer}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {b.type === 'qa_group' && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                              🧠 Question-Answer Block
                            </span>
                            <p className="text-sm font-bold text-gray-900">
                              🎯 মূল প্রশ্ন: {b.mainQuestion}
                            </p>
                            <div className="space-y-1.5 pl-3 border-l-2 border-amber-400">
                              {b.subQuestions.map((sq, i) => (
                                <div key={i} className="text-xs bg-gray-50 p-2 rounded border">
                                  <span className="font-bold text-gray-800">
                                    👁️ {i + 1}. {sq.question}
                                  </span>
                                  <p className="text-emerald-700 mt-0.5">উত্তর: {sq.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* সেভ বাটন */}
                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveLesson}
                    className="px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving
                      ? 'সেভ হচ্ছে...'
                      : editingLesson.id
                      ? '✓ লেসন আপডেট করুন'
                      : '✓ লেসন সেভ করুন'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
