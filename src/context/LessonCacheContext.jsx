import React, { createContext, useContext, useRef } from 'react';

const LessonCacheContext = createContext(null);

export function LessonCacheProvider({ children }) {
  // মেমোরি ক্যাশ রেফারেন্স (পেজ বা রাউট পরিবর্তন হলেও ডাটা মেমরিতে অক্ষত থাকবে)
  const cache = useRef({
    // courseId -> { course, lessons, progressSummary, globalCounts, allSectionsList }
    courseMap: new Map(),
    // lessonId -> lessonData
    lessonDetails: new Map(),
    // lessonId -> is_completed (boolean)
    progressMap: new Map(),
    // lessonId -> { [sectionId]: status }
    sectionProgressMap: new Map(),
    // All courses list for UserDashboard
    coursesList: null,
  });

  return (
    <LessonCacheContext.Provider value={cache.current}>
      {children}
    </LessonCacheContext.Provider>
  );
}

export function useLessonCache() {
  const context = useContext(LessonCacheContext);
  if (!context) {
    throw new Error('useLessonCache must be used within a LessonCacheProvider');
  }
  return context;
}
