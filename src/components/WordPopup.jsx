import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function WordPopup({ word }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      checkIfSaved();
    }
  }, [isOpen]);

  const checkIfSaved = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('flashcards')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('ar_word', word.ar)
      .eq('bn_meaning', word.bn)
      .maybeSingle(); 
      
    if (data) {
      setIsSaved(true);
    } else {
      setIsSaved(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFlashcard = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('লগইন সেশন পাওয়া যায়নি!');
      setLoading(false);
      return;
    }

    if (isSaved) {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('user_id', session.user.id)
        .eq('ar_word', word.ar)
        .eq('bn_meaning', word.bn);
        
      if (!error) setIsSaved(false);
    } else {
      const { error } = await supabase.from('flashcards').insert([{
        user_id: session.user.id,
        ar_word: word.ar,
        bn_meaning: word.bn
      }]);
      
      if (!error) setIsSaved(true);
    }
    setLoading(false);
  };

  return (
    <div className="relative inline-block" ref={popupRef}>
      <span 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-1 py-0.5 transition-colors rounded cursor-pointer ${isOpen ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'}`}
      >
        {word.ar}
      </span>
      
      {/* Tooltip / Popup */}
      {isOpen && (
        <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[160px] flex flex-col font-sans" dir="ltr">
          
          <div className="flex items-center justify-between w-full gap-4 mb-2">
            <button 
              onClick={toggleFlashcard} 
              disabled={loading}
              className={`p-1.5 rounded-md transition-colors ${isSaved ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isSaved ? "ফ্ল্যাশকার্ড থেকে রিমুভ করুন" : "ফ্ল্যাশকার্ডে যুক্ত করুন"}
            >
              {isSaved ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              )}
            </button>

            {/* Restored Amiri Font with optimal size */}
            <div className="text-3xl font-bold text-gray-900 mt-1" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
              {word.ar}
            </div>
          </div>

          {/* Bengali Meaning stays in Google Sans */}
          <div className="text-lg font-medium text-gray-700 border-t border-gray-100 pt-2 w-full text-center">
            {word.bn}
          </div>
          
          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45"></div>
        </div>
      )}
    </div>
  );
}
