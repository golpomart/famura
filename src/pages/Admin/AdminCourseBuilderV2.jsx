import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const uid = () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

// একক ব্লকের সাব-পার্সার
function parseInnerBlocks(lines) {
  const blocks = [];
  let currentPassage = null;
  let currentQA = null;
  let currentDQA = null;

  let pendingQ = null;
  let pendingDQ = null;
  let pendingDA = [];
  let mode = 'passage';

  const flushPassage = () => {
    if (currentPassage && currentPassage.items.length > 0) {
      blocks.push(currentPassage);
      currentPassage = null;
    }
  };

  const flushQA = () => {
    if (currentQA) {
      blocks.push(currentQA);
      currentQA = null;
    }
  };

  const flushDQA = () => {
    if (pendingDQ) {
      if (!currentDQA) currentDQA = { id: uid(), type: 'detailed_qa', items: [] };
      currentDQA.items.push({
        id: uid(),
        question: pendingDQ,
        answer: pendingDA.join('\n'),
      });
      pendingDQ = null;
      pendingDA = [];
    }
    if (currentDQA && currentDQA.items.length > 0) {
      blocks.push(currentDQA);
      currentDQA = null;
    }
  };

  const flushAll = () => {
    flushPassage();
    flushQA();
    flushDQA();
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (mode === 'detailed_qa' && pendingDQ) pendingDA.push('');
      return;
    }

    if (/^VID::/i.test(trimmed)) {
      flushAll();
      mode = 'passage';
      blocks.push({ id: uid(), type: 'video', url: trimmed.replace(/^VID::\s*/i, '') });
      return;
    }

    if (/^PASSAGE::/i.test(trimmed)) {
      flushAll();
      mode = 'passage';
      const textAfter = trimmed.replace(/^PASSAGE::\s*/i, '');
      if (textAfter) {
        if (!currentPassage) currentPassage = { id: uid(), type: 'passage', items: [] };
        currentPassage.items.push({ id: uid(), itemType: 'paragraph', text: textAfter });
      }
      return;
    }

    if (/^MQ::/i.test(trimmed)) {
      flushAll();
      mode = 'qa_group';
      currentQA = {
        id: uid(),
        type: 'qa_group',
        mainQuestion: trimmed.replace(/^MQ::\s*/i, ''),
        subQuestions: [],
      };
      return;
    }

    if (/^DQ::/i.test(trimmed)) {
      if (mode !== 'detailed_qa') {
        flushAll();
        mode = 'detailed_qa';
      } else if (pendingDQ) {
        if (!currentDQA) currentDQA = { id: uid(), type: 'detailed_qa', items: [] };
        currentDQA.items.push({ id: uid(), question: pendingDQ, answer: pendingDA.join('\n') });
      }
      pendingDQ = trimmed.replace(/^DQ::\s*/i, '');
      pendingDA = [];
      return;
    }

    if (/^DA::/i.test(trimmed)) {
      pendingDA = [trimmed.replace(/^DA::\s*/i, '')];
      return;
    }

    if (/^Q::/i.test(trimmed)) {
      if (mode === 'detailed_qa') {
        flushAll();
        mode = 'passage';
      }
      pendingQ = trimmed.replace(/^Q::\s*/i, '');
      return;
    }

    if (/^A::/i.test(trimmed)) {
      const answerText = trimmed.replace(/^A::\s*/i, '');
      if (pendingQ) {
        if (mode === 'qa_group' && currentQA) {
          currentQA.subQuestions.push({ id: uid(), question: pendingQ, answer: answerText });
        } else {
          if (!currentPassage) currentPassage = { id: uid(), type: 'passage', items: [] };
          currentPassage.items.push({ id: uid(), itemType: 'qa', question: pendingQ, answer: answerText });
        }
        pendingQ = null;
      }
      return;
    }

    if (mode === 'detailed_qa' && pendingDQ) {
      pendingDA.push(trimmed);
    } else {
      if (mode === 'qa_group') {
        flushAll();
        mode = 'passage';
      }
      if (!currentPassage) currentPassage = { id: uid(), type: 'passage', items: [] };
      currentPassage.items.push({ id: uid(), itemType: 'paragraph', text: trimmed });
    }
  });

  flushAll();
  return blocks;
}

// মাস্টার পার্সার: ITEM_START ও ITEM_END সাপোর্ট সহ
function parseUnifiedSmartText(rawText, topVideoUrl = '') {
  const finalBlocks = [];

  if (topVideoUrl && topVideoUrl.trim()) {
    finalBlocks.push({ id: uid(), type: 'video', url: topVideoUrl.trim() });
  }

  const lines = (rawText || '').split('\n');
  let inTopic = false;
  let topicTitle = '';
  let topicLines = [];
  let rootLines = [];

  const flushTopic = () => {
    if (inTopic && topicTitle) {
      const innerBlocks = parseInnerBlocks(topicLines);
      finalBlocks.push({
        id: uid(),
        type: 'topic_item',
        title: topicTitle,
        blocks: innerBlocks,
      });
      inTopic = false;
      topicTitle = '';
      topicLines = [];
    }
  };

  const flushRoot = () => {
    if (rootLines.length > 0) {
      const parsed = parseInnerBlocks(rootLines);
      finalBlocks.push(...parsed);
      rootLines = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^ITEM_START::/i.test(trimmed)) {
      flushRoot();
      flushTopic();
      inTopic = true;
      topicTitle = trimmed.replace(/^ITEM_START::\s*/i, '') || 'শিরোনামহীন প্রশ্ন';
      topicLines = [];
      return;
    }

    if (/^ITEM_END/i.test(trimmed)) {
      flushTopic();
      return;
    }

    if (inTopic) {
      topicLines.push(line);
    } else {
      rootLines.push(line);
    }
  });

  flushRoot();
  flushTopic();

  return finalBlocks;
}

export default function AdminCourseBuilderV2() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showNewCourseBox, setShowNewCourseBox] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
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
    const { data } = await supabase.from('v2_courses').select('*').order('created_at', { ascending: false });
    if (data) setCourses(data);
  };

  const fetchCourseCurriculum = async (courseId) => {
    const { data: modData } = await supabase.from('v2_modules').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
    const { data: lesData } = await supabase.from('v2_lessons').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
    setModules(modData || []);
    setLessons(lesData || []);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseTitle.trim()) return alert('কোর্সের নাম দিন!');
    const { data, error } = await supabase.from('v2_courses').insert([{ title: courseTitle.trim(), description: courseDesc.trim() }]).select().single();
    if (error) return alert(error.message);
    setCourseTitle(''); setCourseDesc(''); setShowNewCourseBox(false);
    fetchCourses(); openCourseBuilder(data);
  };

  const handleDeleteCourse = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('এই কোর্স এবং এর সব মডিউল ও লেসন মুছে যাবে। নিশ্চিত?')) return;
    await supabase.from('v2_courses').delete().eq('id', id);
    fetchCourses();
  };

  const openCourseBuilder = (course) => {
    setSelectedCourse(course); setEditingLesson(null); setActiveModuleId(null);
    fetchCourseCurriculum(course.id);
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    const { data, error } = await supabase.from('v2_modules').insert([{ course_id: selectedCourse.id, title: newModuleTitle.trim(), order_index: modules.length + 1 }]).select().single();
    if (!error && data) { setModules([...modules, data]); setNewModuleTitle(''); }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('এই মডিউল এবং এর ভেতরের সব লেসন মুছে ফেলতে চান?')) return;
    await supabase.from('v2_modules').delete().eq('id', moduleId);
    if (activeModuleId === moduleId) setEditingLesson(null);
    fetchCourseCurriculum(selectedCourse.id);
  };

  const startNewLesson = (moduleId) => {
    setActiveModuleId(moduleId); setEditingLesson({ isNew: true });
    setLessonTitle(''); setTopVideoUrl(''); setShowVideoInput(false); setUnifiedRawText(''); setPreviewBlocks([]);
  };

  const openEditLesson = (lesson) => {
    setActiveModuleId(lesson.module_id); setEditingLesson(lesson); setLessonTitle(lesson.title);
    const data = lesson.lesson_data || {};
    if (data.rawText !== undefined) {
      setUnifiedRawText(data.rawText); setTopVideoUrl(data.topVideoUrl || ''); setShowVideoInput(Boolean(data.topVideoUrl)); setPreviewBlocks(data.blocks || []);
    } else {
      setUnifiedRawText(''); setTopVideoUrl(''); setPreviewBlocks(data.blocks || []);
    }
  };

  const handlePreview = () => {
    const blocks = parseUnifiedSmartText(unifiedRawText, topVideoUrl);
    setPreviewBlocks(blocks);
  };

  const insertSign = (signTemplate) => {
    setUnifiedRawText((prev) => (prev ? `${prev}\n${signTemplate}` : signTemplate));
  };

  const handleSaveLesson = async () => {
    if (!lessonTitle.trim()) return alert('লেসনের শিরোনাম দিন!');
    setSaving(true);
    const generatedBlocks = parseUnifiedSmartText(unifiedRawText, topVideoUrl);
    setPreviewBlocks(generatedBlocks);
    const payload = {
      course_id: selectedCourse.id, module_id: activeModuleId, title: lessonTitle.trim(), lesson_type: 'unified',
      lesson_data: { topVideoUrl: topVideoUrl.trim(), rawText: unifiedRawText, blocks: generatedBlocks },
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editingLesson?.id) { error = (await supabase.from('v2_lessons').update(payload).eq('id', editingLesson.id)).error; } 
    else { payload.order_index = lessons.filter(l => l.module_id === activeModuleId).length + 1; error = (await supabase.from('v2_lessons').insert([payload])).error; }
    setSaving(false);
    if (error) alert('সেভ করতে সমস্যা: ' + error.message);
    else { fetchCourseCurriculum(selectedCourse.id); alert('লেসন সফলভাবে সেভ হয়েছে!'); }
  };

  const handleDeleteLesson = async (lessonId, e) => {
    e.stopPropagation();
    if (!window.confirm('এই লেসনটি মুছে ফেলতে চান?')) return;
    await supabase.from('v2_lessons').delete().eq('id', lessonId);
    if (editingLesson?.id === lessonId) setEditingLesson(null);
    fetchCourseCurriculum(selectedCourse.id);
  };

  if (!selectedCourse) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div><h1 className="text-2xl font-bold text-gray-900">কোর্স ম্যানেজমেন্ট (LMS Studio)</h1></div>
            <div className="flex gap-3">
              <button onClick={() => setShowNewCourseBox(!showNewCourseBox)} className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl">+ নতুন কোর্স</button>
              <button onClick={() => navigate('/admin')} className="px-4 py-2 text-sm font-medium bg-gray-100 rounded-xl">পুরনো ড্যাশবোর্ড</button>
            </div>
          </div>
          {showNewCourseBox && (
            <form onSubmit={handleCreateCourse} className="bg-white p-6 rounded-2xl border-2 border-blue-100 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="কোর্সের নাম" className="w-full px-3 py-2 border rounded-xl" />
                <input type="text" value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} placeholder="সংক্ষিপ্ত বিবরণ" className="w-full px-3 py-2 border rounded-xl" />
              </div>
              <div className="flex justify-end gap-2"><button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg">কোর্স তৈরি করুন</button></div>
            </form>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {courses.map((course) => (
              <div key={course.id} onClick={() => openCourseBuilder(course)} className="bg-white p-6 rounded-2xl border hover:border-blue-400 cursor-pointer">
                <div className="flex justify-between"><span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 rounded">কোর্স</span><button onClick={(e) => handleDeleteCourse(course.id, e)} className="text-red-500">✕</button></div>
                <h3 className="text-lg font-bold mt-2">{course.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border">
          <button onClick={() => setSelectedCourse(null)} className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold">← সব কোর্স</button>
          <h1 className="text-xl font-bold">{selectedCourse.title}</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border h-fit space-y-4">
            <h2 className="text-base font-bold border-b pb-2">📚 কারিকুলাম</h2>
            <form onSubmit={handleAddModule} className="flex gap-2">
              <input type="text" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="নতুন মডিউল..." className="flex-1 px-3 py-2 border rounded-xl text-xs" />
              <button type="submit" className="px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl">+ মডিউল</button>
            </form>
            <div className="space-y-3">
              {modules.map((mod, mIdx) => (
                <div key={mod.id} className="border rounded-xl bg-gray-50/50">
                  <div className="bg-gray-100 px-3 py-2 flex justify-between border-b">
                    <span className="font-bold text-xs">মডিউল {mIdx + 1}: {mod.title}</span>
                    <button onClick={() => startNewLesson(mod.id)} className="text-[11px] font-bold text-blue-600">+ লেসন</button>
                  </div>
                  <div className="p-2 space-y-1">
                    {lessons.filter(l => l.module_id === mod.id).map((les, lIdx) => (
                      <div key={les.id} onClick={() => openEditLesson(les)} className="px-3 py-2 rounded-lg border text-xs cursor-pointer hover:border-blue-300 flex justify-between">
                        <span>{lIdx + 1}. {les.title}</span>
                        <button onClick={(e) => handleDeleteLesson(les.id, e)} className="text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-8">
            {!editingLesson ? (
              <div className="bg-white p-12 rounded-2xl border text-center text-gray-500">বাম পাশ থেকে "+ লেসন" বাটনে ক্লিক করুন</div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border space-y-5">
                <div className="flex gap-3 items-end">
                  <div className="flex-1"><label className="text-xs font-bold mb-1 block">লেসনের শিরোনাম *</label><input type="text" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="w-full px-4 py-2 border rounded-xl" /></div>
                  <button onClick={() => setShowVideoInput(!showVideoInput)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold">🎬 ভিডিও লিংক</button>
                </div>
                {showVideoInput && <input type="text" value={topVideoUrl} onChange={(e) => setTopVideoUrl(e.target.value)} placeholder="ভিডিও URL" className="w-full px-3 py-2 border rounded-lg" />}
                
                <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => insertSign('ITEM_START:: নতুন প্রশ্নের নাম\n\nITEM_END')} className="px-2.5 py-1 bg-purple-100 text-purple-900 text-[11px] font-bold rounded">📋 + ITEM_START (লিস্ট)</button>
                    <button onClick={() => insertSign('DQ:: বিস্তারিত প্রশ্ন\nDA:: বিস্তারিত উত্তর')} className="px-2 py-1 bg-emerald-100 text-[11px] font-bold rounded">+ DQ/DA</button>
                    <button onClick={() => insertSign('Q:: প্রশ্ন\nA:: উত্তর')} className="px-2 py-1 bg-indigo-100 text-[11px] font-bold rounded">+ Q/A</button>
                    <button onClick={() => insertSign('MQ:: মূল প্রশ্ন\nQ:: সাব-প্রশ্ন\nA:: উত্তর')} className="px-2 py-1 bg-amber-100 text-[11px] font-bold rounded">+ MQ</button>
                  </div>
                  <textarea rows={14} value={unifiedRawText} onChange={(e) => setUnifiedRawText(e.target.value)} placeholder="টেক্সট পেস্ট করুন..." className="w-full p-4 border rounded-xl text-sm font-mono leading-relaxed" />
                  <button onClick={handlePreview} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">👁️ প্রিভিউ দেখুন</button>
                </div>

                {previewBlocks.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl border max-h-96 overflow-y-auto space-y-3">
                    {previewBlocks.map((b, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100">{b.type} block</span>
                        {b.type === 'topic_item' && (
                          <div className="mt-2 p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                            <h4 className="font-bold text-purple-950 text-sm">📋 লিস্ট আইটেম: {b.title}</h4>
                            <span className="text-xs text-purple-700">ভেতরে {b.blocks?.length || 0} টি ব্লক রয়েছে</span>
                          </div>
                        )}
                        {b.type === 'detailed_qa' && b.items?.map((item, i) => (
                          <div key={i} className="mt-2 p-2 border-l-2 border-emerald-400">
                            <p className="font-bold text-sm">Q: {item.question}</p>
                            <div className="text-xs mt-1 whitespace-pre-wrap prose max-w-none" dangerouslySetInnerHTML={{ __html: item.answer }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end"><button onClick={handleSaveLesson} disabled={saving} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold">{saving ? 'সেভ হচ্ছে...' : '✓ লেসন সেভ করুন'}</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
