import React, { createContext, useContext, ReactNode } from 'react';
import { useLanguage } from '../hooks/useLanguage';

// 言語コンテキストの型定義
interface LanguageContextType {
  currentLang: string;
  availableLanguages: Array<{
    code: string;
    name: string;
    isCustom: boolean;
  }>;
  isLoading: boolean;
  changeLanguage: (langCode: string) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  getCurrentLanguageInfo: () => { code: string; name: string; isCustom: boolean; } | undefined;
}

// 言語コンテキスト作成
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 言語プロバイダーコンポーネント
interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const languageState = useLanguage();

  return (
    <LanguageContext.Provider value={languageState}>
      {children}
    </LanguageContext.Provider>
  );
};

// 言語コンテキストを使用するためのカスタムフック
export const useLanguageContext = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;