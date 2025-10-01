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
    // まず public/lang/ から読み込みを試行（既存の動作を維持）
    const response = await fetch(`/lang/${langCode}.json`);
    if (response.ok) {
      return await response.json();
    }

    // public/lang/ にない場合は、実行場所の langs/ フォルダから読み込みを試行
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

      const appPath = await appDataDir();
      const langsPath = await join(appPath, 'langs');
      const langFilePath = await join(langsPath, `${langCode}.json`);

      const langsExists = await exists(langsPath);
      if (!langsExists) return null;

      const fileExists = await exists(langFilePath);
      if (!fileExists) return null;

      const content = await readTextFile(langFilePath);
      return JSON.parse(content);
    } catch (tauriError) {
      // Tauri APIが利用できない場合（Web環境など）は無視
      console.warn('Tauri API not available for custom language loading:', tauriError);
      return null;
    }
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
    { code: 'it_IT', name: 'Italiano' },
    { code: 'nl_NL', name: 'Nederlands' },
    { code: 'sv_SE', name: 'Svenska' },
    { code: 'da_DK', name: 'Dansk' },
    { code: 'no_NO', name: 'Norsk' },
    { code: 'fi_FI', name: 'Suomi' },
    { code: 'pl_PL', name: 'Polski' },
    { code: 'cs_CZ', name: 'Čeština' },
    { code: 'hu_HU', name: 'Magyar' },
    { code: 'tr_TR', name: 'Türkçe' },
    { code: 'ar_SA', name: 'العربية' },
    { code: 'he_IL', name: 'עברית' },
    { code: 'th_TH', name: 'ไทย' },
    { code: 'vi_VN', name: 'Tiếng Việt' },
    { code: 'id_ID', name: 'Bahasa Indonesia' },
    { code: 'ms_MY', name: 'Bahasa Melayu' },
    { code: 'hi_IN', name: 'हिन्दी' },
  ];

  // 各言語ファイルの存在を確認（public/lang/ と langs/ の両方をチェック）
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

  // 実行場所の langs/ フォルダをスキャンして追加の言語ファイルを検知
  try {
    const { readDir, exists } = await import('@tauri-apps/plugin-fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');

    const appDataPath = await appDataDir();
    const langsPath = await join(appDataPath, 'langs');

    const langsExists = await exists(langsPath);
    if (langsExists) {
      const entries = await readDir(langsPath);
      for (const entry of entries) {
        if (entry.name?.endsWith('.json')) {
          const langCode = entry.name.replace('.json', '');
          // すでに検知済みの言語はスキップ
          if (!languages.find(lang => lang.code === langCode)) {
            const customLang = await loadCustomLanguage(langCode);
            if (customLang) {
              // 言語名を取得（ファイル名から推測するか、デフォルト名を使用）
              const langName = customLang['lang.name'] || customLang['language.name'] || langCode;
              languages.push({
                code: langCode,
                name: langName,
                isCustom: true
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // Tauri APIが利用できない場合やエラーが発生した場合は無視
    console.warn('Failed to scan langs folder:', error);
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