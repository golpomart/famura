import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminCurriculum() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [lessonType, setLessonType] = useState('translation');
  const [content, setContent] = useState('');
  const [orderIndex, setOrderIndex] = useState(0);

  // Single Lesson with Multiple Sections Modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [rawFileText, setRawFileText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchCourseAndLessons();
  }, [courseId]);

  const fetchCourseAndLessons = async () => {
    setLoading(true);
    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseData) setCourse(courseData);

    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (lessonsData) {
      setLessons(lessonsData);
      if (!editingId) setOrderIndex(lessonsData.length + 1);
    }
    setLoading(false);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 6000);
  };

  // Helper: Parse QA sections (Handles Arabic in ### line as well as separate lines)
  const parseSectionsToQA = (text) => {
    const rawSections = text.split(/(?=###)/g).map(s => s.trim()).filter(Boolean);
    const sections = [];

    rawSections.forEach((sec, idx) => {
      if (!sec.startsWith('###')) return;

      const lines = sec.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0].replace(/^###\s*/, '').trim();
      const bodyLines = lines.slice(1);

      let arQ = '';
      let bnQ = '';
      let frameworkLines = [];
      let answerLines = [];
      let isFramework = false;
      let isAnswer = false;

      // Check if the ### line itself contains the Arabic question
      if (firstLine.startsWith('السؤال:') || firstLine.startsWith('السُّؤَالُ:')) {
        arQ = firstLine.replace(/^السُّؤَالُ:\s*|^السؤال:\s*/, '').trim();
      }

      bodyLines.forEach(line => {
        if (line.startsWith('السؤال:') || line.startsWith('السُّؤَالُ:')) {
          arQ = line.replace(/^السُّؤَالُ:\s*|^السؤال:\s*/, '').trim();
        } else if (line.startsWith('প্রশ্ন:')) {
          bnQ = line.replace(/^প্রশ্ন:\s*/, '').trim();
        } else if (line.startsWith('ফ্রেমওয়ার্ক:') || line.startsWith('ফ্রেমওয়ার্ক:')) {
          isFramework = true;
          isAnswer = false;
          const inlineText = line.replace(/^(ফ্রেমওয়ার্ক|ফ্রেমওয়ার্ক):\s*/, '').trim();
          if (inlineText) frameworkLines.push(inlineText);
        } else if (line.startsWith('উত্তর:')) {
          isFramework = false;
          isAnswer = true;
          answerLines.push(line);
        } else if (isFramework) {
          frameworkLines.push(line);
        } else if (isAnswer) {
          answerLines.push(line);
        }
      });

      sections.push({
        id: `sec_${idx + 1}`,
        title: bnQ || firstLine,
        ar_question: arQ,
        bn_question: bnQ,
        framework: frameworkLines.join(' ').trim(),
        answer: answerLines.join('\n\n')
      });
    });

    return { sections };
  };

  // Upload as single lesson containing all sections
  const handleImportAsSingleLesson = async () => {
    if (!rawFileText.trim() || !modalTitle.trim()) {
      alert('লেসনের নাম এবং টেক্সট দেওয়া আবশ্যক!');
      return;
    }
    setImporting(true);

    try {
      const parsedData = parseSectionsToQA(rawFileText);
      if (parsedData.sections.length === 0) {
        showMessage('কোনো সেকশন খুঁজে পাওয়া যায়নি! টেক্সটে "###" ফরম্যাট আছে কি না চেক করুন।', 'error');
        setImporting(false);
        return;
      }

      const payload = {
        course_id: courseId,
        title: modalTitle,
        lesson_type: 'qa_sections',
        content: parsedData,
        order_index: lessons.length + 1
      };

      const { error } = await supabase.from('lessons').insert([payload]);
      if (error) {
        showMessage('এরর: ' + error.message, 'error');
      } else {
        showMessage(`সাফল্যের সাথে ${parsedData.sections.length} টি সেকশনসহ লেসন তৈরি হয়েছে!`, 'success');
        setShowSectionModal(false);
        setRawFileText('');
        setModalTitle('');
        fetchCourseAndLessons();
      }
    } catch (err) {
      showMessage('ফাইল পার্স করতে সমস্যা হয়েছে।', 'error');
    }
    setImporting(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setRawFileText(event.target.result);
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let parsedContent = content;
    if (lessonType !== 'video') {
      try {
        parsedContent = JSON.parse(content);
      } catch (err) {
        showMessage('JSON ফরম্যাট সঠিক নয়।', 'error');
        return;
      }
    }

    const payload = {
      course_id: courseId,
      title,
      lesson_type: lessonType,
      content: parsedContent,
      order_index: orderIndex
    };

    if (editingId) {
      const { error } = await supabase.from('lessons').update(payload).eq('id', editingId);
      if (error) showMessage(error.message, 'error');
      else showMessage('লেসন আপডেট হয়েছে!', 'success');
    } else {
      const { error } = await supabase.from('lessons').insert([payload]);
      if (error) showMessage(error.message, 'error');
      else showMessage('নতুন লেসন যুক্ত হয়েছে!', 'success');
    }

    resetForm();
    fetchCourseAndLessons();
  };

  const handleEdit = (lesson) => {
    setEditingId(lesson.id);
    setTitle(lesson.title);
    setLessonType(lesson.lesson_type);
    setOrderIndex(lesson.order_index || 0);
    setContent(typeof lesson.content === 'object' ? JSON.stringify(lesson.content, null, 2) : lesson.content || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('আপনি কি নিশ্চিত? এই লেসনটি মুছে যাবে!')) {
      await supabase.from('lessons').delete().eq('id', id);
      fetchCourseAndLessons();
      showMessage('লেসন ডিলিট হয়েছে!', 'success');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setLessonType('translation');
    setContent('');
    setOrderIndex(lessons.length + 1);
  };

  // Drag and Drop States
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const reorderedLessons = [...lessons];
    const [movedLesson] = reorderedLessons.splice(draggedIndex, 1);
    reorderedLessons.splice(dropIndex, 0, movedLesson);

    // Update order_index locally
    const updatedLessons = reorderedLessons.map((lesson, idx) => ({
      ...lesson,
      order_index: idx + 1
    }));

    setLessons(updatedLessons);
    setDraggedIndex(null);

    // Save updated order to Supabase
    try {
      const updates = updatedLessons.map(lesson => 
        supabase.from('lessons').update({ order_index: lesson.order_index }).eq('id', lesson.id)
      );
      await Promise.all(updates);
      showMessage('লেসনের ক্রম সফলভাবে আপডেট হয়েছে!', 'success');
    } catch (err) {
      showMessage('ক্রম সেভ করতে সমস্যা হয়েছে।', 'error');
    }
  };

  if (loading) return <div className="p-10 text-center font-medium text-gray-600">ডেটা লোড হচ্ছে...</div>;
  if (!course) return <div className="p-10 text-center text-red-500 font-bold">কোর্স পাওয়া যায়নি!</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; ব্যাক টু কোর্স লিস্ট</Link>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">কারিকুলাম: {course.title}</h1>
              <p className="text-gray-500 text-sm mt-1">মোট লেসন: {lessons.length}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSectionModal(true)} 
                className="bg-purple-50 border border-purple-200 text-purple-700 px-5 py-2.5 rounded-xl font-bold hover:bg-purple-600 hover:text-white transition-all shadow-sm"
              >
                📑 প্রশ্নোত্তর সেকশন লেসন তৈরি
              </button>
              {!showForm && (
                <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all">
                  + নতুন লেসন
                </button>
              )}
            </div>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 mb-6 rounded-xl font-bold ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {showForm && (
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-4">
              <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">{editingId ? 'লেসন আপডেট করুন' : 'নতুন লেসন তৈরি করুন'}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">লেসনের নাম</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">লেসন টাইপ</label>
                      <select value={lessonType} onChange={e => setLessonType(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500">
                        <option value="translation">Translation (JSON)</option>
                        <option value="qa_sections">শানে নুযূল সেকশনস (Multi-Card)</option>
                        <option value="video">Video URL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">সিরিয়াল (Order)</label>
                      <input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500" required />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 h-full flex flex-col">
                  <label className="block text-gray-700 font-bold">কন্টেন্ট (JSON)</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} className="flex-1 w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-sm bg-gray-50 min-h-[220px]" required></textarea>
                </div>
                
                <div className="lg:col-span-2 flex gap-3 mt-2 border-t pt-4">
                  <button type="submit" className="bg-green-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm">{editingId ? 'আপডেট করুন' : 'সেভ করুন'}</button>
                  <button type="button" onClick={resetForm} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors">বাতিল</button>
                </div>
              </form>
            </div>
          )}

          <div className="lg:col-span-3">
            <h3 className="text-xl font-bold text-gray-800 mb-4">বর্তমান লেসনসমূহ</h3>
            {lessons.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center text-gray-500">
                এই কোর্সে কোনো লেসন নেই।
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-4xl">
                {lessons.map((lesson, index) => (
                  <div 
                    key={lesson.id} 
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                    className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center transition-all cursor-move select-none ${
                      draggedIndex === index ? 'opacity-40 border-dashed border-blue-400' : 'hover:shadow-md hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Drag Handle Icon */}
                      <div className="text-gray-300 hover:text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
                        </svg>
                      </div>

                      <div className="bg-blue-100 text-blue-700 font-bold w-10 h-10 flex items-center justify-center rounded-full shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800 line-clamp-1">{lesson.title}</h4>
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded mt-1 inline-block ${lesson.lesson_type === 'qa_sections' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                          {lesson.lesson_type === 'qa_sections' ? 'Multi-Card QA' : lesson.lesson_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(lesson); }} className="text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg font-bold text-sm transition-colors">এডিট</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id); }} className="text-red-600 bg-red-50 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg font-bold text-sm transition-colors">ডিলিট</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MULTI-SECTION QA IMPORT MODAL */}
      {showSectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-8 shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">একটি লেসনের মধ্যে সব প্রশ্নোত্তর তৈরি</h3>
                <p className="text-sm text-gray-500 mt-1">পুরো ফাইলের সব প্রশ্ন একটিমাত্র লেসনে আলাদা আলাদা কার্ড হিসেবে সেভ হবে।</p>
              </div>
              <button onClick={() => setShowSectionModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-bold">&times;</button>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">লেসনের নাম দিন:</label>
                <input 
                  type="text" 
                  value={modalTitle} 
                  onChange={e => setModalTitle(e.target.value)}
                  placeholder="যেমন: গুরুত্বপূর্ণ শানে নুযূল সমগ্র" 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">📁 .txt ফাইল সিলেক্ট করুন (বা নিচে পেস্ট করুন):</label>
                <input 
                  type="file" 
                  accept=".txt" 
                  onChange={handleFileUpload} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
              </div>
            </div>

            <textarea 
              value={rawFileText} 
              onChange={e => setRawFileText(e.target.value)}
              placeholder="এখানে পুরো ফাইলের টেক্সট পেস্ট করুন..."
              className="flex-1 w-full border-2 border-gray-200 p-4 rounded-2xl font-mono text-sm focus:outline-none focus:border-purple-500 min-h-[240px] bg-gray-50"
            ></textarea>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button type="button" onClick={() => setShowSectionModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">বাতিল</button>
              <button 
                type="button" 
                onClick={handleImportAsSingleLesson} 
                disabled={importing || !rawFileText.trim() || !modalTitle.trim()}
                className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md ${importing || !rawFileText.trim() || !modalTitle.trim() ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {importing ? 'সেভ হচ্ছে...' : 'একটি লেসনে সব সেভ করুন 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
