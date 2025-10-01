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
    // まず実行場所の langs/ フォルダから読み込みを試行（Tauri環境）
    try {
      const { homeDir, join } = await import('@tauri-apps/api/path');
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

      const homePath = await homeDir();
      const basePath = await join(homePath, 'Documents', 'PEXData', 'BedrockProxy');
      const langsPath = await join(basePath, 'langs');
      const langFilePath = await join(langsPath, `${langCode}.json`);

      console.log(`[Language] Checking Tauri path: ${langFilePath}`);

      const langsExists = await exists(langsPath);
      console.log(`[Language] Langs folder exists: ${langsExists}`);
      
      if (langsExists) {
        const fileExists = await exists(langFilePath);
        console.log(`[Language] File ${langCode}.json exists: ${fileExists}`);
        
        if (fileExists) {
          const content = await readTextFile(langFilePath);
          console.log(`[Language] Successfully loaded ${langCode} from Tauri path`);
          return JSON.parse(content);
        }
      }
    } catch (tauriError) {
      // Tauri APIが利用できない場合は次の方法を試す
      console.log('[Language] Not in Tauri environment, trying public folder');
    }

    // Tauri環境でファイルがない場合、または Web環境の場合は public/lang/ から読み込み
    const response = await fetch(`/lang/${langCode}.json`);
    if (response.ok) {
      console.log(`[Language] Successfully loaded ${langCode} from public folder`);
      return await response.json();
    }

    return null;
  } catch (error) {
    console.debug(`[Language] Language file not found: ${langCode}`);
    return null;
  }
};

// 利用可能な言語を検出する関数
const detectAvailableLanguages = async (): Promise<LanguageInfo[]> => {
  const languages: LanguageInfo[] = [
    { code: 'ja_JP', name: '日本語', isCustom: false }
  ];

  // public/lang/ から利用可能な言語をチェック（Web環境用）
  const publicLanguages = [
    { code: 'en_US', name: 'English' },
  ];

  for (const lang of publicLanguages) {
    const customLang = await loadCustomLanguage(lang.code);
    if (customLang) {
      languages.push({
        code: lang.code,
        name: lang.name,
        isCustom: true
      });
    }
  }

  // Tauri環境: langs/ フォルダをスキャンして言語ファイルを検知
  try {
    const { readDir, exists } = await import('@tauri-apps/plugin-fs');
    const { homeDir, join } = await import('@tauri-apps/api/path');

    const homePath = await homeDir();
    const basePath = await join(homePath, 'Documents', 'PEXData', 'BedrockProxy');
    const langsPath = await join(basePath, 'langs');

    console.log('[Language] Checking langs folder path:', langsPath);

    const langsExists = await exists(langsPath);
    console.log('[Language] Langs folder exists:', langsExists);
    
    if (langsExists) {
      console.log('[Language] Scanning langs folder for JSON files...');
      const entries = await readDir(langsPath);
      console.log('[Language] Found entries:', entries.length);
      
      for (const entry of entries) {
        console.log('[Language] Entry:', entry.name, 'isFile:', entry.isFile);
        
        if (entry.name?.endsWith('.json')) {
          const langCode = entry.name.replace('.json', '');
          console.log('[Language] Processing JSON file:', langCode);
          
          // すでに検知済みの言語はスキップ
          if (!languages.find(lang => lang.code === langCode)) {
            console.log('[Language] Loading custom language:', langCode);
            const customLang = await loadCustomLanguage(langCode);
            if (customLang) {
              // 言語名を取得（ファイル内のlang.nameキーから、なければコード名）
              const langName = customLang['lang.name'] || customLang['language.name'] || langCode;
              languages.push({
                code: langCode,
                name: langName,
                isCustom: true
              });
              console.log(`[Language] ✅ Detected custom language: ${langCode} (${langName})`);
            } else {
              console.log(`[Language] ❌ Failed to load: ${langCode}`);
            }
          } else {
            console.log('[Language] Skipping already detected:', langCode);
          }
        }
      }
      console.log('[Language] Total languages detected:', languages.length);
    } else {
      console.log('[Language] Langs folder does not exist, skipping scan');
    }
  } catch (error) {
    // Tauri APIが利用できない場合やエラーが発生した場合は無視
    console.log('[Language] Error scanning langs folder:', error);
    console.log('[Language] Not in Tauri environment or langs folder not accessible');
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