import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Course Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (data) setCourses(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await supabase.from('courses').update({ title, description }).eq('id', editingId);
    } else {
      await supabase.from('courses').insert([{ title, description }]);
    }
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    fetchCourses();
  };

  const handleEdit = (course) => {
    setEditingId(course.id);
    setTitle(course.title);
    setDescription(course.description);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('আপনি কি নিশ্চিত? এই কোর্সের সব লেসন পার্মানেন্টলি মুছে যাবে!')) {
      await supabase.from('courses').delete().eq('id', id);
      fetchCourses();
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-lg">
        <div className="p-6 text-2xl font-bold border-b border-gray-800 text-center tracking-wider">
          LMS ADMIN
        </div>
        <div className="flex-1 p-4 space-y-2 mt-4">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            ড্যাশবোর্ড
          </button>
          <button onClick={() => setActiveTab('courses')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'courses' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            কোর্স ম্যানেজমেন্ট
          </button>
        </div>
        <div className="p-6 border-t border-gray-800">
          <Link to="/" className="block w-full text-center py-2 px-4 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 hover:text-white transition-colors font-semibold">
            &larr; স্টুডেন্ট ভিউ
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-bold mb-8 text-gray-800">ড্যাশবোর্ড ওভারভিউ</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                <h3 className="text-gray-500 text-lg font-semibold mb-2">মোট কোর্স</h3>
                <p className="text-5xl font-bold text-blue-600">{courses.length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="max-w-5xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800">কোর্সসমূহ</h2>
              <button 
                onClick={() => { setShowForm(true); setEditingId(null); setTitle(''); setDescription(''); }} 
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-all"
              >
                + নতুন কোর্স
              </button>
            </div>

            {/* Course Form Modal/Inline */}
            {showForm && (
              <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 mb-8 animation-fade-in">
                <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">{editingId ? 'কোর্স আপডেট করুন' : 'নতুন কোর্স তৈরি করুন'}</h3>
                <form onSubmit={handleSubmit}>
                  <div className="mb-5">
                    <label className="block text-gray-700 font-bold mb-2">কোর্সের নাম</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" placeholder="যেমন: Quran Vocabulary" required />
                  </div>
                  <div className="mb-6">
                    <label className="block text-gray-700 font-bold mb-2">বিবরণ</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" rows="3" placeholder="কোর্সের বিস্তারিত..." required></textarea>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">{editingId ? 'আপডেট করুন' : 'সেভ করুন'}</button>
                    <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors">বাতিল</button>
                  </div>
                </form>
              </div>
            )}

            {/* Courses Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-5 font-bold text-gray-600 w-2/3">কোর্সের তথ্য</th>
                    <th className="p-5 font-bold text-gray-600 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan="2" className="p-8 text-center text-gray-500">ডেটা লোড হচ্ছে...</td></tr>
                  ) : courses.length === 0 ? (
                    <tr><td colSpan="2" className="p-8 text-center text-gray-500">কোনো কোর্স নেই। নতুন কোর্স তৈরি করুন।</td></tr>
                  ) : courses.map(course => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-5">
                        <div className="font-bold text-lg text-gray-800 mb-1">{course.title}</div>
                        <div className="text-gray-500 text-sm line-clamp-1">{course.description}</div>
                      </td>
                      <td className="p-5">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/course/${course.id}`} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded font-bold hover:bg-indigo-600 hover:text-white transition-colors text-sm">
                            লেসন ম্যানেজ
                          </Link>
                          <button onClick={() => handleEdit(course)} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded font-bold hover:bg-yellow-500 hover:text-white transition-colors text-sm">
                            এডিট
                          </button>
                          <button onClick={() => handleDelete(course.id)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-bold hover:bg-red-600 hover:text-white transition-colors text-sm">
                            ডিলিট
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
