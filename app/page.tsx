"use client";

import { useState, useEffect, useMemo } from "react";

type FeedbackItem = {
  category: string;
  problem: string;
  solution1: string;
  solution2: string;
};

export default function Home() {
  const [data, setData] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<Record<number, 1 | 2>>({});

  // AI Search States
  const [aiAnalysisResults, setAiAnalysisResults] = useState<FeedbackItem[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/feedback');
        if (!res.ok) throw new Error('Failed to fetch');
        const jsonData = await res.json();
        setData(jsonData);
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(data.map((item) => item.category)));
    return ["All", ...cats];
  }, [data]);

  // Filter Logic (Standard vs AI)
  const filteredData = useMemo(() => {
    // If AI results exist, prioritize them
    if (aiAnalysisResults) {
      return aiAnalysisResults;
    }

    // Standard Filter
    return data.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        item.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.solution1.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.solution2 && item.solution2.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [data, searchQuery, selectedCategory, aiAnalysisResults]);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
    setCopiedIndex(null);
  };

  const switchVersion = (e: React.MouseEvent, index: number, version: 1 | 2) => {
    e.stopPropagation();
    setSelectedVersions(prev => ({ ...prev, [index]: version }));
    setCopiedIndex(null);
  };

  const copyToClipboard = (e: React.MouseEvent, text: string, index: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsAiSearching(true);
    setAiAnalysisResults(null);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 503) {
          alert("⚠️ Gemini API Key가 설정되지 않았습니다. .env 파일을 확인해주세요.");
        } else {
          throw new Error(err.error || 'AI Search Failed');
        }
        return;
      }

      const results = await res.json();
      setAiAnalysisResults(results);
      setSelectedCategory("All"); // Reset category to show all AI results
    } catch (e) {
      console.error("AI Search Error", e);
      alert("AI 검색 중 오류가 발생했습니다.");
    } finally {
      setIsAiSearching(false);
    }
  };

  const clearAiResults = () => {
    setAiAnalysisResults(null);
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            📚 크리투스 피드백 백과사전
          </h1>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
            Ver 1.3 (AI Search)
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-10">

        {/* 1. Category Selection (First Step) */}
        <div className="mb-10">
          <h2 className="text-base font-bold text-gray-400 mb-4 uppercase tracking-wider">
            Step 1. 대주제 선택
          </h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setExpandedIndex(null);
                  setAiAnalysisResults(null); // Clear AI results on category click
                }}
                className={`px-8 py-5 rounded-2xl text-xl font-bold transition-all duration-200 border shadow-sm flex-grow md:flex-grow-0 text-center ${!aiAnalysisResults && selectedCategory === category
                    ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 shadow-md transform scale-105"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar (Optional) */}
        <div className="mb-8 relative">
          <div className="relative">
            <input
              type="text"
              className={`block w-full pl-6 pr-32 py-5 text-lg border rounded-2xl bg-white focus:outline-none focus:ring-4 transition-all placeholder:text-gray-400 ${aiAnalysisResults
                  ? "border-blue-500 ring-4 ring-blue-500/10"
                  : "border-gray-200 focus:ring-blue-500/10 focus:border-blue-500"
                }`}
              placeholder="내가 적은 문제점을 복사하여 붙여넣어보세요. 관련도순으로 찾아드립니다."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value === "") setAiAnalysisResults(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
            />
            <div className="absolute right-2 top-2 bottom-2 flex items-center gap-2">
              {aiAnalysisResults && (
                <button
                  onClick={clearAiResults}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
              <button
                onClick={handleAiSearch}
                disabled={isAiSearching}
                className={`h-full px-5 rounded-xl font-bold flex items-center gap-2 transition-all ${isAiSearching
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95"
                  }`}
              >
                {isAiSearching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                ) : (
                  <>
                    <span>AI 검색</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Search Indicator */}
          {aiAnalysisResults && (
            <div className="mt-3 flex items-center gap-2 text-blue-600 animate-fade-in-up">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-sm font-bold">AI가 '{searchQuery}'와(과) 가장 연관성 높은 결과를 찾았습니다.</span>
            </div>
          )}
        </div>

        {/* 2. Problem List (Single Column) */}
        <div>
          <h2 className="text-base font-bold text-gray-400 mb-4 uppercase tracking-wider flex items-center justify-between">
            Step 2. 문제점 리스트
            <span className="text-sm font-normal text-gray-400">{filteredData.length}개의 항목</span>
          </h2>

          <div className="space-y-4">
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => {
                const isExpanded = expandedIndex === index;
                const isCopied = copiedIndex === index;
                const currentVersion = selectedVersions[index] || 1;
                const currentSolution = currentVersion === 1 ? item.solution1 : item.solution2;
                const hasSolution2 = !!item.solution2;

                return (
                  <div
                    key={index}
                    onClick={() => toggleExpand(index)}
                    className={`bg-white rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden ${isExpanded
                        ? "border-blue-500 ring-4 ring-blue-500/10 shadow-xl scale-[1.01] relative z-10"
                        : "border-gray-100 hover:border-gray-300 hover:shadow-md"
                      }`}
                  >
                    {/* Card Header (Always Visible) */}
                    <div className="p-7 flex items-start gap-6">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-colors mt-1 ${isExpanded ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                        }`}>
                        Q
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-md">
                            {item.category}
                          </span>
                        </div>
                        <h3 className={`text-xl md:text-2xl font-bold leading-snug transition-colors ${isExpanded ? "text-gray-900" : "text-gray-700"
                          }`}>
                          {item.problem}
                        </h3>
                      </div>
                      <div className="flex-shrink-0 pt-2 text-gray-300">
                        <svg className={`w-7 h-7 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>

                    {/* Card Body (Expandable Solution) */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                    >
                      <div className="px-7 pb-8 pt-0 pl-[5.5rem]">
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 text-gray-800 relative group/solution">

                          {/* Version Tabs (Only if Solution 2 exists) */}
                          {hasSolution2 && (
                            <div className="flex gap-2 mb-6">
                              <button
                                onClick={(e) => switchVersion(e, index, 1)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentVersion === 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                              >
                                Ver 1
                              </button>
                              <button
                                onClick={(e) => switchVersion(e, index, 2)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentVersion === 2 ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                              >
                                Ver 2
                              </button>
                            </div>
                          )}

                          <div className="absolute top-5 left-6 font-bold text-blue-600 text-sm uppercase tracking-wide mb-2" style={{ top: hasSolution2 ? '4.5rem' : '1.5rem' }}>
                            크리투스 솔루션 {hasSolution2 ? `(Ver ${currentVersion})` : ''}
                          </div>

                          {/* Copy Button */}
                          <button
                            onClick={(e) => copyToClipboard(e, currentSolution, index)}
                            className={`absolute top-4 right-4 p-2 rounded-lg transition-all flex items-center gap-2 ${isCopied
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-500 hover:bg-blue-200 hover:text-blue-700"
                              }`}
                            title="내용 복사"
                          >
                            {isCopied ? (
                              <>
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                <span className="text-sm font-bold">복사됨</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                <span className="text-sm font-bold hidden sm:inline">복사</span>
                              </>
                            )}
                          </button>

                          {/* Main Solution Text */}
                          <div className="mt-8 text-lg leading-loose text-gray-800 whitespace-pre-wrap font-medium" style={{ marginTop: hasSolution2 ? '3.5rem' : '2.5rem' }}>
                            {currentSolution}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-24 text-lg text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                <p>조건에 맞는 피드백이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
