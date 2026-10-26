import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function RevisionVaultV2() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [revealedIds, setRevealedIds] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedCards();
  }, []);

  const fetchSavedCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data } = await supabase
      .from('user_saved_flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setCards(data);
    setLoading(false);
  };

  const toggleReveal = (id) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRemoveCard = async (id, e) => {
    e.stopPropagation();
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('user_saved_flashcards').delete().eq('id', id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🔖 আমার রিভিশন ভল্ট ({cards.length})
            </h1>
            <p className="text-sm text-gray-500">
              লেসন পড়ার সময় আপনার সেভ করা গুরুত্বপূর্ণ প্রশ্ন ও ফ্ল্যাশকার্ডসমূহ
            </p>
          </div>
          <button
            onClick={() => navigate('/v2/lessons')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
          >
            ← লেসনে ফিরে যান
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">লোড হচ্ছে...</div>
        ) : cards.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border text-center space-y-3">
            <p className="text-gray-500">আপনার রিভিশন ভল্টে এখনো কোনো ফ্ল্যাশকার্ড সেভ করা নেই।</p>
            <p className="text-xs text-gray-400">
              লেসন পড়ার সময় যেকোনো প্রশ্নের পাশে থাকা <b>🔖 সেভ</b> বাটনে ক্লিক করলেই সেটি এখানে জমা হবে।
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card, idx) => {
              const isRevealed = Boolean(revealedIds[card.id]);
              return (
                <div
                  key={card.id}
                  onClick={() => toggleReveal(card.id)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:border-indigo-300 transition cursor-pointer space-y-3"
                >
                  {card.parent_question && (
                    <span className="inline-block text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded border border-amber-200">
                      মূল প্রশ্ন: {card.parent_question}
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-gray-900">
                      <span className="text-indigo-600 mr-2">#{idx + 1}</span>
                      {card.question}
                    </h3>
                    <button
                      onClick={(e) => handleRemoveCard(card.id, e)}
                      className="text-xs text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 shrink-0 font-semibold"
                    >
                      মুছুন ✕
                    </button>
                  </div>

                  {isRevealed ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-900">
                      ✓ উত্তর: {card.answer}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-indigo-600">
                      👁️ উত্তর দেখতে কার্ডে ট্যাপ করুন
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
