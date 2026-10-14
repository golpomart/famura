import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

// Grid Item Component (Compact & Responsive)
const GridCard = ({ card, onDelete }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <div 
      onClick={() => setFlipped(!flipped)} 
      className="relative flex flex-col p-2.5 sm:p-4 transition-all bg-white border border-gray-200 cursor-pointer rounded-2xl shadow-sm hover:shadow-md h-[130px] sm:h-[150px] group overflow-hidden"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(card.id); }} 
        className="absolute top-1.5 right-1.5 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
        title="ডিলিট করুন"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center w-full px-1 overflow-hidden">
        {!flipped ? (
          <div 
            className="text-2xl sm:text-3xl font-bold text-gray-900 text-center leading-normal truncate w-full" 
            dir="rtl" 
            style={{ fontFamily: 'Amiri, serif' }}
          >
            {card.ar_word}
          </div>
        ) : (
          <div className="text-sm sm:text-base font-bold text-blue-700 text-center leading-snug line-clamp-3">
            {card.bn_meaning}
          </div>
        )}
      </div>
      
      {/* Category Indicator Dot */}
      <div className="absolute bottom-2.5 left-3 flex items-center">
        <div 
          className={`w-2.5 h-2.5 rounded-full shadow-xs ${card.status === 'known' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
          title={card.status === 'known' ? 'জানি' : 'শিখতেছি'}
        />
      </div>
    </div>
  );
};

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('grid');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardFilter, setCardFilter] = useState('all'); // 'all' | 'learning' | 'known'

  // Filter calculation
  const counts = {
    all: cards.length,
    learning: cards.filter(c => c.status === 'learning' || !c.status).length,
    known: cards.filter(c => c.status === 'known').length,
  };

  const filteredCards = cards.filter(card => {
    if (cardFilter === 'all') return true;
    const st = card.status || 'learning';
    return st === cardFilter;
  });

  useEffect(() => {
    fetchFlashcards();
  }, []);

  const fetchFlashcards = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) setCards(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    // সরাসরি ডিলিট, কোনো পপআপ আসবে না
    await supabase.from('flashcards').delete().eq('id', id);
    const updatedCards = cards.filter(c => c.id !== id);
    setCards(updatedCards);
    
    if (mode === 'practice' && currentIndex >= filteredCards.length - 1) {
      setCurrentIndex(Math.max(0, filteredCards.length - 2));
      setIsFlipped(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    // 1. আপডেট স্টেট
    const updatedCards = cards.map(c => c.id === id ? { ...c, status: newStatus } : c);
    setCards(updatedCards);
    
    // 2. ডেটাবেসে স্ট্যাটাস সেভ
    await supabase.from('flashcards').update({ status: newStatus }).eq('id', id);

    // 3. স্বয়ংক্রিয়ভাবে পরবর্তী কার্ডে যাওয়া
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-lg font-medium text-gray-600">লোড হচ্ছে...</div>;

  return (
    <div className="min-h-screen p-8 bg-gray-50 pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Link to="/" className="inline-block mb-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">&larr; ড্যাশবোর্ড</Link>
            
            {/* Title & Clickable Filter Badges Row */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-gray-800">
                আমার ফ্ল্যাশকার্ড
              </h1>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 bg-gray-100/90 p-1 rounded-2xl border border-gray-200/60">
                <button
                  onClick={() => { setCardFilter('all'); setCurrentIndex(0); setIsFlipped(false); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    cardFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  সব ({counts.all})
                </button>
                <button
                  onClick={() => { setCardFilter('learning'); setCurrentIndex(0); setIsFlipped(false); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    cardFilter === 'learning'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  শিখতেছি ({counts.learning})
                </button>
                <button
                  onClick={() => { setCardFilter('known'); setCurrentIndex(0); setIsFlipped(false); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    cardFilter === 'known'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  জানি ({counts.known})
                </button>
              </div>
            </div>
          </div>
          
          {cards.length > 0 && (
            <div className="flex bg-gray-200/80 rounded-2xl p-1 self-start sm:self-auto">
              <button 
                onClick={() => { setMode('grid'); setIsFlipped(false); }} 
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-colors ${mode === 'grid' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                গ্রিড ভিউ
              </button>
              <button 
                onClick={() => { setMode('practice'); setIsFlipped(false); }} 
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-colors ${mode === 'practice' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                প্র্যাকটিস মোড
              </button>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-lg font-medium text-gray-500">আপনার কোনো ফ্ল্যাশকার্ড সেভ করা নেই। <br/>লেসন থেকে নতুন শব্দ সেভ করুন!</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-gray-200 text-gray-500 font-medium">
            এই ক্যাটাগরিতে কোনো ফ্ল্যাশকার্ড নেই।
          </div>
        ) : mode === 'grid' ? (
          
          // GRID VIEW (Compact gap for mobile)
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredCards.map(card => (
              <GridCard key={card.id} card={card} onDelete={handleDelete} />
            ))}
          </div>

        ) : (
          
          // PRACTICE MODE (Fully Mobile & Desktop Responsive)
          <div className="w-full max-w-xl mx-auto flex flex-col items-center px-2 sm:px-0">
            <div className="mb-3 text-xs sm:text-sm text-gray-500 font-bold">
              কার্ড: {currentIndex + 1} / {filteredCards.length}
            </div>
            
            {/* Flashcard Body */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)} 
              className="w-full h-[260px] sm:h-[340px] bg-white rounded-3xl shadow-sm border border-gray-200 cursor-pointer flex flex-col p-6 sm:p-8 transition-all hover:shadow-md relative select-none overflow-hidden"
            >
              <div className="flex-1 flex items-center justify-center w-full overflow-y-auto px-2 sm:px-4">
                {!isFlipped ? (
                  // Responsive Arabic text size
                  <div 
                    className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-normal text-center" 
                    dir="rtl" 
                    style={{ fontFamily: 'Amiri, serif' }}
                  >
                    {filteredCards[currentIndex].ar_word}
                  </div>
                ) : (
                  // Responsive Bangla text size
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-700 leading-relaxed text-center">
                    {filteredCards[currentIndex].bn_meaning}
                  </div>
                )}
              </div>
            </div>

            {/* Categorization & Delete Row (Comfortable Touch Target) */}
            <div className="flex items-center gap-3 w-full mt-6 h-14 sm:h-16">
              <button 
                onClick={() => handleUpdateStatus(filteredCards[currentIndex].id, 'learning')}
                className={`flex-1 h-full rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 shadow-sm flex items-center justify-center ${
                  filteredCards[currentIndex].status === 'learning' || !filteredCards[currentIndex].status 
                    ? 'bg-amber-500 border-2 border-amber-500 text-white' 
                    : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-amber-500'
                }`}
              >
                শিখতেছি
              </button>
              
              <button 
                onClick={() => handleDelete(filteredCards[currentIndex].id)} 
                className="w-14 sm:w-16 h-full flex-none flex items-center justify-center rounded-2xl bg-white border-2 border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                title="ডিলিট করুন"
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              
              <button 
                onClick={() => handleUpdateStatus(filteredCards[currentIndex].id, 'known')}
                className={`flex-1 h-full rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 shadow-sm flex items-center justify-center ${
                  filteredCards[currentIndex].status === 'known' 
                    ? 'bg-emerald-600 border-2 border-emerald-600 text-white' 
                    : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-emerald-500'
                }`}
              >
                জানি
              </button>
            </div>

            {/* Navigation Arrows */}
            <div className="flex justify-between w-full mt-6 sm:mt-8 px-2 sm:px-4">
              <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className={`w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center rounded-full transition-all ${
                  currentIndex === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700 shadow-md'
                }`}
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                onClick={handleNext} 
                disabled={currentIndex === filteredCards.length - 1}
                className={`w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center rounded-full transition-all ${
                  currentIndex === filteredCards.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700 shadow-md'
                }`}
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
