import React, { useState } from 'react';
import { chapterData } from '../data/mockData';
import { supabase } from '../lib/supabase';

export default function TranslationApp({ session }) {
  const [showTranslation, setShowTranslation] = useState(true);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Navbar */}
      <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-gray-800">{chapterData.t}</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <span className="mr-3 text-sm font-medium text-gray-700">Show Translation</span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={showTranslation}
                onChange={() => setShowTranslation(!showTranslation)}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${showTranslation ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showTranslation ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
          <button onClick={handleLogout} className="text-sm text-red-600 font-semibold hover:underline">লগআউট</button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 space-y-8">
        {chapterData.s.map((sentence) => (
          <div key={sentence.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-right" dir="rtl">
            {/* Arabic Text */}
            <div className="text-3xl leading-loose text-gray-900 mb-4 font-bold" style={{ fontFamily: 'Amiri, serif' }}>
              {showTranslation ? (
                <span>{sentence.ar}</span>
              ) : (
                <div className="flex flex-wrap gap-2 justify-start flex-row-reverse">
                  {/* Interactive Word Mode Placeholder */}
                  {sentence.w.map((word) => (
                    <span key={word.i} className="hover:bg-blue-50 cursor-pointer p-1 rounded transition-colors">
                      {word.ar}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Bangla Translation */}
            {showTranslation && (
              <div className="text-xl text-gray-700 text-left mt-4 pt-4 border-t border-gray-100" dir="ltr">
                {sentence.bn}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
