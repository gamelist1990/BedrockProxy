import { useState, useEffect } from 'react';
import ja_JP from '../lang/ja_JP';

// 翻訳辞書の型定義
type TranslationDict = Record<string, string>;

// サポート言語のリスト
interface LanguageInfo {
  code: string;
  name: string;
  isCustom: boolean;
}

// 動的にカスタム言語ファイルを読み込む関数
const loadCustomLanguage = async (langCode: string): Promise<TranslationDict | null> => {
  try {
    const response = await fetch(`/lang/${langCode}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load custom language: ${langCode}`, error);
    return null;
  }
};

// 利用可能な言語を検出する関数
const detectAvailableLanguages = async (): Promise<LanguageInfo[]> => {
  const languages: LanguageInfo[] = [
    { code: 'ja_JP', name: '日本語', isCustom: false }
  ];

  // よく使われる言語コードをチェック
  const commonLanguages = [
    { code: 'en_US', name: 'English' },
    { code: 'zh_CN', name: '中文简体' },
    { code: 'zh_TW', name: '中文繁體' },
    { code: 'ko_KR', name: '한국어' },
    { code: 'fr_FR', name: 'Français' },
    { code: 'de_DE', name: 'Deutsch' },
    { code: 'es_ES', name: 'Español' },
    { code: 'pt_BR', name: 'Português' },
    { code: 'ru_RU', name: 'Русский' },
  ];

  // 各言語ファイルの存在を確認
  for (const lang of commonLanguages) {
    const customLang = await loadCustomLanguage(lang.code);
    if (customLang) {
      languages.push({
        code: lang.code,
        name: lang.name,
        isCustom: true
      });
    }
  }

  return languages;
};

// 言語管理フック
export const useLanguage = () => {
  const [currentLang, setCurrentLang] = useState<string>('ja_JP');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
  const [translations, setTranslations] = useState<TranslationDict>(ja_JP);
  const [isLoading, setIsLoading] = useState(true);

  // 初期化：利用可能な言語を検出し、保存された設定を復元
  useEffect(() => {
    const initializeLanguages = async () => {
      setIsLoading(true);
      
      // 利用可能な言語を検出
      const languages = await detectAvailableLanguages();
      setAvailableLanguages(languages);

      // 保存された言語設定を復元
      const savedLang = localStorage.getItem('selectedLanguage');
      if (savedLang && languages.find(lang => lang.code === savedLang)) {
        changeLanguage(savedLang);
      } else {
        setIsLoading(false);
      }
    };

    initializeLanguages();
  }, []);

  // 言語を変更する関数
  const changeLanguage = async (langCode: string) => {
    setIsLoading(true);

    try {
      if (langCode === 'ja_JP') {
        // デフォルト日本語
        setTranslations(ja_JP);
      } else {
        // カスタム言語を読み込み
        const customTranslations = await loadCustomLanguage(langCode);
        if (customTranslations) {
          setTranslations(customTranslations);
        } else {
          // フォールバック：デフォルト日本語
          console.warn(`Language ${langCode} not found, falling back to ja_JP`);
          setTranslations(ja_JP);
          langCode = 'ja_JP';
        }
      }

      setCurrentLang(langCode);
      localStorage.setItem('selectedLanguage', langCode);
    } catch (error) {
      console.error('Failed to change language:', error);
      // エラー時はデフォルト日本語にフォールバック
      setTranslations(ja_JP);
      setCurrentLang('ja_JP');
    } finally {
      setIsLoading(false);
    }
  };

  // 翻訳関数：キーから翻訳テキストを取得
  const t = (key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
  };

  // 現在の言語情報を取得
  const getCurrentLanguageInfo = (): LanguageInfo | undefined => {
    return availableLanguages.find(lang => lang.code === currentLang);
  };

  return {
    currentLang,
    availableLanguages,
    isLoading,
    changeLanguage,
    t,
    getCurrentLanguageInfo,
  };
};

export default useLanguage;