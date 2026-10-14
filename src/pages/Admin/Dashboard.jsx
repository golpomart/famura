import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage('অপেক্ষা করুন...');
    
    // Create user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`ত্রুটি: ${error.message}`);
    } else {
      setMessage('সফলভাবে নতুন ইউজার তৈরি হয়েছে!');
      setEmail('');
      setPassword('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl p-8 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-600"
        >
          লগআউট
        </button>
      </div>

      <div className="p-6 mb-8 bg-white rounded shadow-md">
        <h2 className="mb-4 text-xl font-semibold">নতুন ইউজার তৈরি করুন</h2>
        <form onSubmit={handleCreateUser} className="max-w-md">
          <div className="mb-4">
            <label className="block mb-2 text-sm font-bold text-gray-700">নতুন ইমেইল</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded shadow focus:outline-none"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block mb-2 text-sm font-bold text-gray-700">নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded shadow focus:outline-none"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 font-bold text-white bg-green-600 rounded hover:bg-green-700"
          >
            ইউজার তৈরি করুন
          </button>
          {message && <p className="mt-4 text-sm font-semibold text-blue-600">{message}</p>}
        </form>
      </div>

      <div className="p-6 bg-white rounded shadow-md">
        <h2 className="mb-4 text-xl font-semibold">কন্টেন্ট আপলোড (JSON)</h2>
        <p className="text-gray-600">JSON আপলোড করার ফর্মটি এখানে তৈরি করা হবে।</p>
      </div>
    </div>
  );
}
