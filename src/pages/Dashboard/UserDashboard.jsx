import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setCourses(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 pb-20">
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800">কোর্সসমূহ</h1>
        <div className="flex gap-4 items-center">
          <Link to="/flashcards" className="px-4 py-2 font-bold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors shadow-sm">
            আমার ফ্ল্যাশকার্ড
          </Link>
          <Link to="/admin" className="px-4 py-2 font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
            Admin Panel
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm">
            লগআউট
          </button>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto">
        {loading ? (
          <p className="text-center text-gray-600 py-10 font-medium">কোর্স লোড হচ্ছে...</p>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-lg font-medium text-gray-500">বর্তমানে কোনো কোর্স উপলব্ধ নেই।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <Link key={course.id} to={`/course/${course.id}`} className="block p-6 transition-all bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200">
                <h2 className="mb-3 text-xl font-bold text-gray-800">{course.title}</h2>
                <p className="text-gray-600 line-clamp-2 font-medium">{course.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
