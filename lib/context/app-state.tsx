'use client'

import {createContext, useState, ReactNode, useContext, useRef, useEffect} from 'react'
import {Article} from "@/lib/types/article";
import {Decision} from "@/lib/types/decision";
import {MikeMode} from "@/lib/types/mode";
import {ChunkingMode} from "@/lib/types/chunking";

type ArticleCache = Map<string, Article>;
type DecisionCache = Map<string, Decision>;

interface AppState {
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  articleCache: ArticleCache;
  getCachedArticle: (articleNumber: string, articleSource: string) => Article | undefined;
  setCachedArticle: (articleNumber: string, articleSource: string, article: Article) => void;
  decisionCache: DecisionCache;
  getCachedDecision: (decisionNumber: string) => Decision | undefined;
  setCachedDecision: (decisionNumber: string, decision: Decision) => void;
  timeSaved: number;
  setTimeSaved: (timeSaved: number) => void;
  onSignup: () => void;
  hasJustSignUp: boolean;
  selectedMode: MikeMode;
  setSelectedMode: (mode: MikeMode) => void;
  chunkingMode: ChunkingMode;
  setChunkingMode: (mode: ChunkingMode) => void;
  analysisFiles: File[];
  setAnalysisFiles: (files: File[]) => void;
}

const LOCAL_STORAGE_CHUNKING_MODE_KEY = 'chunkingMode';

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const articleCache = useRef(new Map<string, Article>());
  const decisionCache = useRef(new Map<string, Decision>());
  const [timeSaved, setTimeSaved] = useState<number>(0);
  const [hasJustSignUp, setHasJustSignUp] = useState(false);
  const [selectedMode, setSelectedMode] = useState<MikeMode>("research");
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);

  const [chunkingMode, setChunkingModeState] = useState<ChunkingMode>(() => {
    // Default value during SSR
    if (typeof window === 'undefined') {
      return 'semantic';
    }
    // Access localStorage only in the browser
    return localStorage.getItem(LOCAL_STORAGE_CHUNKING_MODE_KEY) as ChunkingMode || 'semantic';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CHUNKING_MODE_KEY, chunkingMode);
    }
  }, [chunkingMode]);

  const setChunkingMode = (mode: ChunkingMode) => {
    setChunkingModeState(mode);
  };

  const getCachedArticle = (articleNumber: string, articleSource: string): Article | undefined => {
    const cacheKey = `${articleNumber}_${articleSource}`;
    return articleCache.current.get(cacheKey);
  };

  const setCachedArticle = (articleNumber: string, articleSource: string, article: Article): void => {
    const cacheKey = `${articleNumber}_${articleSource}`;
    articleCache.current.set(cacheKey, article);
  };

  const getCachedDecision = (decisionNumber: string): Decision | undefined => {
    return decisionCache.current.get(decisionNumber);
  };

  const setCachedDecision = (decisionNumber: string, decision: Decision): void => {
    decisionCache.current.set(decisionNumber, decision);
  };

  const onSignup = () => {
    setHasJustSignUp(true);
  };

  return (
    <AppStateContext.Provider
      value={{
        isGenerating,
        setIsGenerating,
        isStreaming,
        setIsStreaming,
        articleCache: articleCache.current,
        getCachedArticle,
        setCachedArticle,
        decisionCache: decisionCache.current,
        getCachedDecision,
        setCachedDecision,
        timeSaved,
        setTimeSaved,
        onSignup,
        hasJustSignUp,
        selectedMode,
        setSelectedMode,
        chunkingMode,
        setChunkingMode,
        analysisFiles,
        setAnalysisFiles,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
