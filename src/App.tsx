import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Volume2,
  Globe,
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpen,
  Home,
  Calendar,
  CheckCircle2,
  Bell,
  BellOff,
  Sparkles,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Mail,
  Lock,
  Moon,
  User,
  Image as ImageIcon,
  Copy,
  Cloud as CloudIcon,
  Layout,
  Star,
  Settings,
  Pencil,
  Trash2,
  Share2,
  CreditCard,
  HelpCircle,
  Info,
  LogOut,
  Camera,
  Eye,
  EyeOff,
  ArrowLeft,
  MessageSquare,
  Heart,
  FileText,
  Type,
  Check,
  Share,
  Highlighter,
  Sun,
  Play,
  Pause,
  Square,
  Mic,
  Users,
  Headphones,
  History,
  Send,
  Loader2,
  Settings2,
  MapPin,
  Compass,
  BookMarked,
  X,
  PenTool
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BIBLE_BOOKS, READING_PLANS, DAILY_VERSES, type BibleBook, type ReadingPlan } from './constants';
import { searchBible, generateVerseImage, askAuthor, extractScriptureReference, getVerseDeepDive, getWeeklyReflection, generateSermonContentPack, type SearchResult, type AISearchResponse, type ScriptureRef, type VerseDeepDive, type WeeklyReflection, type WeeklyReflectionInput, type SermonContentPack } from './services/geminiService';
import { fetchChapterVerses, TRANSLATION_MAP } from './services/bibleService';
import { audioService, type AudioChunk, type GoogleVoice } from './services/audioService';
import { getSacredGeography, type SacredLocation } from './services/geminiService';
import { sermonService } from './services/sermonService';
import { atmosphereService, type AtmosphereType } from './services/atmosphereService';
import { InkCanvas } from './components/InkCanvas';
import { dbService, type User as DBUser } from './services/dbService';
import { getGalleryFromIndexedDB, saveGalleryToIndexedDB, type GalleryImage } from './services/localDbService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Verse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleResponse {
  reference: string;
  verses: Verse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

const TRANSLATIONS = [
  { id: 'web', name: 'WEB', fullName: 'World English Bible' },
  { id: 'webbe', name: 'WEBBE', fullName: 'WEB British Edition' },
  { id: 'asv', name: 'ASV', fullName: 'American Standard Version' },
  { id: 'kjv', name: 'KJV', fullName: 'King James Version' },
  { id: 'fbv', name: 'FBV', fullName: 'Free Bible Version' },
  { id: 'lsv', name: 'LSV', fullName: 'Literal Standard Version' },
];

type Tab = 'home' | 'bible' | 'search' | 'plans' | 'profile' | 'gallery';

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('bible_auth_token'));
  const [currentUser, setCurrentUser] = useState<DBUser | null>(() => {
    try {
      const saved = localStorage.getItem('bible_user_info');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [authView, setAuthView] = useState<'intro' | 'login' | 'signup'>('intro');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Bible Reader State
  const [currentBook, setCurrentBook] = useState<BibleBook>(BIBLE_BOOKS[18]); // Default to Psalms
  const [currentChapter, setCurrentChapter] = useState(23); // Default to Psalm 23
  const [currentTranslation, setCurrentTranslation] = useState(TRANSLATIONS[0]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [showNavigator, setShowNavigator] = useState(false);
  const [navigatorTab, setNavigatorTab] = useState<'book' | 'chapter' | 'verse' | 'version'>('book');
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null);
  const [copiedVerseId, setCopiedVerseId] = useState<number | null>(null);
  const [testamentFilter, setTestamentFilter] = useState<'OT' | 'NT'>('OT');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [showNavButtons, setShowNavButtons] = useState(false);
  const [dramatizedChunks, setDramatizedChunks] = useState<AudioChunk[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<GoogleVoice[]>([]);
  const [selectedNarratorURI, setSelectedNarratorURI] = useState<string>('');
  const [selectedCharacterURI, setSelectedCharacterURI] = useState<string>('');

  // Sacred Geography State
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [sacredLocations, setSacredLocations] = useState<SacredLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<SacredLocation | null>(null);

  // Live Sermon Mode State
  const [isSermonListening, setIsSermonListening] = useState(false);
  const [sermonTranscript, setSermonTranscript] = useState('');
  const [detectedRef, setDetectedRef] = useState<ScriptureRef | null>(null);
  const [showSermonToast, setShowSermonToast] = useState(false);
  const [autoJump, setAutoJump] = useState(false);
  const [sermonNotes, setSermonNotes] = useState<ScriptureRef[]>([]);
  const [sermonBridgeToast, setSermonBridgeToast] = useState<string | null>(null);
  const [showSermonNotesPanel, setShowSermonNotesPanel] = useState(false);
  const sermonTranscriptRef = useRef('');
  const fullSermonTranscriptRef = useRef('');
  const sermonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [sermonContent, setSermonContent] = useState<SermonContentPack | null>(() => {
    try {
      const saved = localStorage.getItem('lumina_sermon_content');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isGeneratingSermonPack, setIsGeneratingSermonPack] = useState(false);

  // Verse Archeology State
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [deepDiveData, setDeepDiveData] = useState<VerseDeepDive | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

  // Verse of the Day State
  const [votd, setVotd] = useState(DAILY_VERSES[0]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [atmosphericReadingEnabled, setAtmosphericReadingEnabled] = useState(false);
  const [isScribeMode, setIsScribeMode] = useState(false);
  const [scribeTexture, setScribeTexture] = useState<'parchment' | 'stone'>('parchment');
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);
  const [weeklyReflectionData, setWeeklyReflectionData] = useState<WeeklyReflection | null>(null);
  const [isReflectionLoading, setIsReflectionLoading] = useState(false);

  // Search State
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Profile State
  const [name, setName] = useState(() => localStorage.getItem('bible_user_name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('bible_user_email') || '');
  const [promoEmails, setPromoEmails] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [readingMode, setReadingMode] = useState<'light' | 'sepia' | 'dark'>('light');
  const [themeColor, setThemeColor] = useState<'emerald' | 'amber' | 'rose' | 'blue' | 'purple'>('emerald');
  const [isDark, setIsDark] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState('https://picsum.photos/seed/user/200/200');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fontEmphasis, setFontEmphasis] = useState<'normal' | 'bold' | 'italic'>('normal');
  const [profileSubView, setProfileSubView] = useState<'main' | 'saved' | 'history' | 'badges'>('main');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<'all' | 'bookmarks' | 'notes'>('all');

  // Real Stats State
  const [streak, setStreak] = useState(1);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [chaptersReadToday, setChaptersReadToday] = useState(0);
  const [lastReadDate, setLastReadDate] = useState<string | null>(null);
  const [history, setHistory] = useState<{ reference: string, date: string }[]>(() => {
    try {
      const saved = localStorage.getItem('bible_history');
      return (saved && saved !== 'null') ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Data States
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>({});
  const [bookmarks, setBookmarks] = useState<Record<string, { text: string, reference: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNoteVerse, setEditingNoteVerse] = useState<Verse | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [activePlanId, setActivePlanId] = useState<string | null>(() => localStorage.getItem('bible_active_plan'));
  const [selectedPlanForDetails, setSelectedPlanForDetails] = useState<ReadingPlan | null>(null);
  const [highlights, setHighlights] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('bible_highlights');
      return (saved && saved !== 'null') ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);
  const [visualizingVerse, setVisualizingVerse] = useState<Verse | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // Hydrate gallery from IndexedDB on mount
  useEffect(() => {
    getGalleryFromIndexedDB().then(saved => {
      if (saved && saved.length > 0) {
        setGallery(saved);
      } else {
        // Fallback migration from old localStorage string
        try {
          const oldSaved = localStorage.getItem('lumina_gallery');
          if (oldSaved && oldSaved !== 'null') {
            const parsed = JSON.parse(oldSaved);
            setGallery(parsed);
            saveGalleryToIndexedDB(parsed); // migrate it
            localStorage.removeItem('lumina_gallery'); // clear quotas
          }
        } catch { }
      }
    });
  }, []);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<string | null>(null);

  // Derived States
  const firstName = useMemo(() => name ? name.split(' ')[0] : 'Jerless', [name]);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  }, []);

  const chapterProgress = useMemo(() => {
    return (currentChapter / currentBook.chapters) * 100;
  }, [currentChapter, currentBook.chapters]);

  const earnedBadges = useMemo(() => {
    const b = [];
    const numChapters = Object.keys(completedChapters || {}).length;
    const numBookmarks = Object.keys(bookmarks || {}).length;
    const numImages = (gallery || []).length;

    if (numChapters >= 1) b.push({ id: 'first_steps', icon: BookOpen, label: 'First Steps', desc: 'Read your first chapter', color: 'text-emerald-500', bg: 'bg-emerald-500/10' });
    if (streak >= 3) b.push({ id: 'consistent', icon: Sparkles, label: 'Consistent', desc: '3 day reading streak', color: 'text-amber-500', bg: 'bg-amber-500/10' });
    if (numChapters >= 10) b.push({ id: 'scholar', icon: BookOpen, label: 'Scholar', desc: 'Read 10 chapters', color: 'text-blue-500', bg: 'bg-blue-500/10' });
    if (numBookmarks >= 5) b.push({ id: 'treasurer', icon: Bookmark, label: 'Treasurer', desc: 'Save 5 verses', color: 'text-purple-500', bg: 'bg-purple-500/10' });
    if (numImages >= 3) b.push({ id: 'visionary', icon: ImageIcon, label: 'Visionary', desc: 'Generate 3 verse images', color: 'text-rose-500', bg: 'bg-rose-500/10' });

    return b;
  }, [completedChapters, streak, bookmarks, gallery]);

  const HIGHLIGHT_COLORS = [
    { id: 'yellow', bg: 'bg-yellow-200/60', darkBg: 'dark:bg-yellow-500/30', dot: 'bg-yellow-400' },
    { id: 'green', bg: 'bg-green-200/60', darkBg: 'dark:bg-green-500/30', dot: 'bg-green-400' },
    { id: 'blue', bg: 'bg-blue-200/60', darkBg: 'dark:bg-blue-500/30', dot: 'bg-blue-400' },
    { id: 'purple', bg: 'bg-purple-200/60', darkBg: 'dark:bg-purple-500/30', dot: 'bg-purple-400' },
    { id: 'orange', bg: 'bg-orange-200/60', darkBg: 'dark:bg-orange-500/30', dot: 'bg-orange-400' },
  ];

  const toggleHighlight = (v: Verse, colorId: string) => {
    const key = `${v.book_name}-${v.chapter}:${v.verse}`;
    const newHighlights = { ...highlights };
    if (newHighlights[key] === colorId) {
      delete newHighlights[key];
    } else {
      newHighlights[key] = colorId;
    }
    setHighlights(newHighlights);
    localStorage.setItem('bible_highlights', JSON.stringify(newHighlights));
  };

  // Author Chat State
  type Persona = {
    id: string;
    name: string;
    role: string;
    avatar: string;
    greeting: string;
    color: string;
    bg: string;
    gradient: string;
  };

  type ChatMessage = {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
  };

  const PERSONAS: Persona[] = [
    {
      id: 'david',
      name: 'David',
      role: 'Shepherd, King, Psalmist',
      avatar: '👑',
      greeting: 'Peace be with you. I am David, son of Jesse. I poured my heart out to the Lord in the Psalms—in times of great joy and deep despair. What would you like to ask me?',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      gradient: 'from-amber-500 to-orange-500'
    },
    {
      id: 'paul',
      name: 'Paul',
      role: 'Apostle to the Gentiles',
      avatar: '📜',
      greeting: 'Grace and peace to you! Once Saul the persecutor, now Paul the servant of Christ. I wrote to many early churches to encourage and correct them. How can I help clarify my letters?',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      gradient: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'esther',
      name: 'Esther',
      role: 'Queen of Persia',
      avatar: '✨',
      greeting: 'Welcome. I was placed in the palace "for such a time as this" to save my people. God\'s hand was moving even when unseen. What shall we discuss?',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      gradient: 'from-rose-500 to-pink-500'
    }
  ];

  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    saveGalleryToIndexedDB(gallery);
  }, [gallery]);

  useEffect(() => {
    if (sermonContent) {
      localStorage.setItem('lumina_sermon_content', JSON.stringify(sermonContent));
    }
  }, [sermonContent]);

  useEffect(() => {
    // Setup listeners for cloud audio buffering
    audioService.onAudioStartLoading = () => setIsAudioLoading(true);
    audioService.onAudioFinishLoading = () => setIsAudioLoading(false);

    // Init Google Voices
    setAvailableVoices(audioService.getVoices());
    setSelectedNarratorURI(audioService.getNarratorVoice().name);
    setSelectedCharacterURI(audioService.getCharacterVoice().name);
  }, []);
  const syncDataWithDB = async () => {
    if (!isAuthenticated) return;
    setIsSyncing(true);
    try {
      // Format notes for DB
      const dbNotes = Object.entries(notes).map(([key, content]) => {
        const [book, rest] = key.split('-');
        const [chapter, verse] = rest.split(':');
        return { book, chapter: parseInt(chapter), verse: parseInt(verse), content };
      });

      // Format bookmarks for DB
      const dbBookmarks = Object.entries(bookmarks).map(([key, bm]: [string, any]) => {
        const [book, rest] = key.split('-');
        const [chapter, verse] = rest.split(':');
        return { book, chapter: parseInt(chapter), verse: parseInt(verse), reference: bm.reference };
      });

      // Format highlights for DB
      const dbHighlights = Object.entries(highlights).map(([verse_key, color]) => ({
        verse_key, color
      }));

      // Gallery: only sync tiny metadata — the image itself is saved server-side at generation time.
      // Sending base64 URLs would cause a 413 Payload Too Large error.
      const dbGallery = gallery.map(item => ({
        id: item.id,
        reference: item.reference,
        text: item.text,
        date: item.date
        // Note: url is intentionally excluded — already stored in DB from /api/ai/image
      }));

      await dbService.syncData({
        notes: dbNotes,
        bookmarks: dbBookmarks,
        progress: { activePlanId, completedChapters },
        highlights: dbHighlights,
        gallery: dbGallery
      });
      console.log('☁️ Data synced to cloud');
    } catch (err) {
      console.error('Failed to sync with DB:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // One-time recovery: push all localStorage gallery images to Neon DB.
  // Run this from desktop after a Render redeploy to make old images available cross-device.
  const pushLocalGalleryToCloud = async () => {
    if (!isAuthenticated || isUploadingGallery) return;
    const itemsWithUrl = gallery.filter(item => item.url && item.url.startsWith('data:'));
    if (itemsWithUrl.length === 0) {
      setGalleryUploadStatus('✅ All images already synced!');
      setTimeout(() => setGalleryUploadStatus(null), 3000);
      return;
    }
    setIsUploadingGallery(true);
    setGalleryUploadStatus(`Uploading 0 / ${itemsWithUrl.length}...`);
    let successCount = 0;
    for (let i = 0; i < itemsWithUrl.length; i++) {
      try {
        await dbService.uploadGalleryItem(itemsWithUrl[i]);
        successCount++;
        setGalleryUploadStatus(`Uploading ${i + 1} / ${itemsWithUrl.length}...`);
      } catch (err) {
        console.error('Failed to upload gallery item:', err);
      }
    }
    setIsUploadingGallery(false);
    setGalleryUploadStatus(`✅ Synced ${successCount} / ${itemsWithUrl.length} images to cloud!`);
    setTimeout(() => setGalleryUploadStatus(null), 5000);
  };

  // Debounced Sync Effect
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      syncDataWithDB();
    }, 2000); // Wait 2s after last change
    return () => clearTimeout(timer);
  }, [notes, bookmarks, completedChapters, activePlanId, highlights, gallery, isAuthenticated]);

  useEffect(() => {
    // Load progress from localStorage
    const savedProgress = localStorage.getItem('bible_progress');
    if (savedProgress) {
      setCompletedChapters(JSON.parse(savedProgress) || {});
    }

    // Check auth status
    const authStatus = localStorage.getItem('bible_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }

    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem('bible_bookmarks');
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks) || {});
    }

    // Load notes from localStorage
    const savedNotes = localStorage.getItem('bible_notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes) || {});
    }

    // Load font size from localStorage
    const savedFontSize = localStorage.getItem('bible_font_size');
    if (savedFontSize) {
      setFontSize(savedFontSize as 'small' | 'medium' | 'large');
    }

    // Load font emphasis from localStorage
    const savedFontEmphasis = localStorage.getItem('bible_font_emphasis');
    if (savedFontEmphasis) {
      setFontEmphasis(savedFontEmphasis as 'normal' | 'bold' | 'italic');
    }

    // Load reading mode from localStorage
    const savedReadingMode = localStorage.getItem('bible_reading_mode');
    if (savedReadingMode) {
      setReadingMode(savedReadingMode as 'light' | 'sepia' | 'dark');
    }

    // Load theme color from localStorage
    const savedThemeColor = localStorage.getItem('bible_theme_color');
    if (savedThemeColor) {
      setThemeColor(savedThemeColor as any);
    }

    // Load dark mode preference from localStorage
    const savedDarkMode = localStorage.getItem('bible_dark_mode');
    if (savedDarkMode !== null) {
      setIsDark(savedDarkMode !== 'false');
    }

    // Load Stats
    const savedStreak = localStorage.getItem('bible_streak');
    if (savedStreak) setStreak(parseInt(savedStreak));

    const savedDailyGoal = localStorage.getItem('bible_daily_goal');
    if (savedDailyGoal) setDailyGoal(parseInt(savedDailyGoal));

    const savedLastReadDate = localStorage.getItem('bible_last_read_date');
    const today = new Date().toDateString();

    if (savedLastReadDate === today) {
      const savedTodayCount = localStorage.getItem('bible_today_count');
      if (savedTodayCount) setChaptersReadToday(parseInt(savedTodayCount));
      setLastReadDate(today);
    } else {
      // Check for streak break
      if (savedLastReadDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (savedLastReadDate !== yesterday.toDateString()) {
          setStreak(0); // Reset streak if they missed a day
          localStorage.setItem('bible_streak', '0');
        }
      }
      setChaptersReadToday(0);
      setLastReadDate(today);
      localStorage.setItem('bible_last_read_date', today);
      localStorage.setItem('bible_today_count', '0');
    }

    // Set Verse of the Day based on date
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    setVotd(DAILY_VERSES[dayOfYear % DAILY_VERSES.length]);
  }, []);

  const toggleProgress = (book: string, chapter: number) => {
    const key = `${book}-${chapter}`;
    const isMarkingComplete = !completedChapters[key];
    const newProgress = { ...completedChapters, [key]: isMarkingComplete };
    setCompletedChapters(newProgress);
    localStorage.setItem('bible_progress', JSON.stringify(newProgress));

    if (isMarkingComplete) {
      const today = new Date().toDateString();
      const newTodayCount = chaptersReadToday + 1;
      setChaptersReadToday(newTodayCount);
      localStorage.setItem('bible_today_count', newTodayCount.toString());

      if (lastReadDate !== today || streak === 0) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setLastReadDate(today);
        localStorage.setItem('bible_streak', newStreak.toString());
        localStorage.setItem('bible_last_read_date', today);
      }

      // Add to history
      const historyItem = { reference: `${book} ${chapter}`, date: new Date().toISOString() };
      const newHistory = [historyItem, ...history.slice(0, 49)]; // Keep last 50
      setHistory(newHistory);
      localStorage.setItem('bible_history', JSON.stringify(newHistory));
    }
  };

  const toggleBookmark = (verse: Verse) => {
    const key = `${verse.book_name}-${verse.chapter}:${verse.verse}`;
    const newBookmarks = { ...bookmarks };
    if (newBookmarks[key]) {
      delete newBookmarks[key];
    } else {
      newBookmarks[key] = {
        text: verse.text,
        reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`
      };
    }
    setBookmarks(newBookmarks);
    localStorage.setItem('bible_bookmarks', JSON.stringify(newBookmarks));
  };

  const deleteBookmark = (key: string) => {
    const newBookmarks = { ...bookmarks };
    delete newBookmarks[key];
    setBookmarks(newBookmarks);
    localStorage.setItem('bible_bookmarks', JSON.stringify(newBookmarks));
  };

  const deleteNote = (key: string) => {
    const newNotes = { ...notes };
    delete newNotes[key];
    setNotes(newNotes);
    localStorage.setItem('bible_notes', JSON.stringify(newNotes));
  };

  const handleOpenNote = (verse: Verse | { book_name: string, chapter: number, verse: number, text: string }) => {
    const key = `${verse.book_name}-${verse.chapter}:${verse.verse}`;
    setEditingNoteVerse(verse as Verse);
    setTempNote(notes[key] || '');
  };

  const handleVisualize = async (verse: Verse) => {
    setVisualizingVerse(verse);
    setIsGeneratingImage(true);
    setGeneratedImage(null);
    const reference = `${currentBook.name} ${currentChapter}:${verse.verse}`;
    const { imageUrl, galleryItem } = await generateVerseImage(verse.text, reference);
    setGeneratedImage(imageUrl);
    setIsGeneratingImage(false);

    if (imageUrl) {
      // Use the server-assigned ID if available (image already saved to DB server-side),
      // otherwise fall back to a local timestamp ID.
      const newItem = {
        id: galleryItem?.id ?? Date.now().toString(),
        url: imageUrl,
        reference: galleryItem?.reference ?? reference,
        text: galleryItem?.text ?? verse.text,
        date: galleryItem?.date ?? new Date().toLocaleDateString()
      };
      setGallery(prev => [newItem, ...prev]);
    }
  };

  const selectedVerseClass = useMemo(() => {
    if (readingMode === 'dark') return "bg-[var(--theme-primary)]/15 ring-2 ring-[var(--theme-primary)]/40 shadow-sm z-10";
    if (readingMode === 'sepia') return "bg-[color-mix(in_srgb,var(--theme-primary-900)_15%,transparent)] ring-2 ring-[var(--theme-primary)]/40 shadow-sm z-10";
    return "bg-[color-mix(in_srgb,var(--theme-primary)_8%,white)] ring-2 ring-[var(--theme-primary)]/30 shadow-sm z-10";
  }, [readingMode]);

  const saveNote = () => {
    if (!editingNoteVerse) return;
    const key = `${editingNoteVerse.book_name}-${editingNoteVerse.chapter}:${editingNoteVerse.verse}`;
    const newNotes = { ...notes };
    if (tempNote.trim()) {
      newNotes[key] = tempNote;
    } else {
      delete newNotes[key];
    }
    setNotes(newNotes);
    localStorage.setItem('bible_notes', JSON.stringify(newNotes));
    setEditingNoteVerse(null);
  };

  const copyVerse = async (v: Verse | { book_name: string, chapter: number, verse: number, text: string }) => {
    const fullText = `${v.book_name} ${v.chapter}:${v.verse} – ${v.text}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedVerseId(v.verse);
      setTimeout(() => setCopiedVerseId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareVerse = async (v: Verse | { book_name: string, chapter: number, verse: number, text: string }) => {
    const fullText = `${v.book_name} ${v.chapter}:${v.verse} – ${v.text}`;
    const shareData = {
      title: `${v.book_name} ${v.chapter}:${v.verse}`,
      text: fullText,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(fullText);
        setCopiedVerseId(v.verse);
        setTimeout(() => setCopiedVerseId(null), 2000);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  };

  const toggleVotdBookmark = () => {
    const match = votd.reference.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (match) {
      const book_name = match[1];
      const chapter = parseInt(match[2]);
      const verseNum = parseInt(match[3]);

      const verseObj = {
        book_id: '',
        book_name,
        chapter,
        verse: verseNum,
        text: votd.text
      };
      toggleBookmark(verseObj as Verse);
    }
  };

  const shareVotd = async () => {
    const shareData = {
      title: 'Verse of the Day',
      text: `"${votd.text}" - ${votd.reference}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\nShared from Lumina Bible App`);
        // We could use a toast here, but for now alert is fine or just silent success
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  };

  const isVotdBookmarked = useMemo(() => {
    const match = votd.reference.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (match) {
      const key = `${match[1]}-${match[2]}:${match[3]}`;
      return !!bookmarks[key];
    }
    return false;
  }, [votd, bookmarks]);

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    localStorage.setItem('bible_font_size', size);
  };

  const handleFontEmphasisChange = (emphasis: 'normal' | 'bold' | 'italic') => {
    setFontEmphasis(emphasis);
    localStorage.setItem('bible_font_emphasis', emphasis);
  };

  const updateReadingMode = (newMode: 'light' | 'sepia' | 'dark') => {
    setReadingMode(newMode);
    localStorage.setItem('bible_reading_mode', newMode);
  };

  const updateThemeColor = (color: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple') => {
    setThemeColor(color);
    localStorage.setItem('bible_theme_color', color);
  };

  const handleLogout = () => {
    localStorage.removeItem('bible_auth_token');
    localStorage.removeItem('bible_user_info');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthView('intro');
  };

  const handleDBSignup = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const res = await dbService.signup(authEmail, authPassword, authName);
      localStorage.setItem('bible_auth_token', res.token);
      localStorage.setItem('bible_user_info', JSON.stringify(res.user));
      // Sync local profile state
      setName(res.user.displayName || '');
      setEmail(res.user.email);
      setCurrentUser(res.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleDBLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const res = await dbService.login(authEmail, authPassword);
      localStorage.setItem('bible_auth_token', res.token);
      localStorage.setItem('bible_user_info', JSON.stringify(res.user));
      // Sync local profile state
      setName(res.user.displayName || '');
      setEmail(res.user.email);
      setCurrentUser(res.user);
      setIsAuthenticated(true);

      // Load server data into local state (cross-device sync)
      try {
        const serverData = await dbService.fetchUserData();

        // Merge bookmarks from server into local state
        if (serverData.bookmarks?.length) {
          const serverBookmarks: Record<string, { text: string; reference: string }> = {};
          for (const bm of serverData.bookmarks) {
            const key = `${bm.book}-${bm.chapter}:${bm.verse}`;
            serverBookmarks[key] = { text: bm.reference, reference: bm.reference };
          }
          setBookmarks(prev => ({ ...serverBookmarks, ...prev }));
        }

        // Merge notes from server into local state
        if (serverData.notes?.length) {
          const serverNotes: Record<string, string> = {};
          for (const n of serverData.notes) {
            const key = `${n.book}-${n.chapter}:${n.verse}`;
            serverNotes[key] = n.content;
          }
          setNotes(prev => ({ ...serverNotes, ...prev }));
        }

        // Load reading progress from server
        if (serverData.progress) {
          if (serverData.progress.active_plan_id) setActivePlanId(serverData.progress.active_plan_id);
          if (serverData.progress.completed_chapters) setCompletedChapters(serverData.progress.completed_chapters);
        }
        // Load highlights from server
        if (serverData.highlights?.length) {
          const serverHighlights: Record<string, string> = {};
          for (const h of serverData.highlights) {
            serverHighlights[h.verse_key] = h.color;
          }
          setHighlights(prev => ({ ...serverHighlights, ...prev }));
        }

        // Load gallery from server
        if (serverData.gallery?.length) {
          setGallery(prev => {
            const existingIds = new Set(prev.map(g => g.id));
            const newItems = serverData.gallery.filter((g: any) => !existingIds.has(g.id));
            return [...newItems, ...prev];
          });
        }
      } catch (fetchErr) {
        console.warn('Could not load server data after login:', fetchErr);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const fetchVerses = async (book: BibleBook, chapter: number, translation: string) => {
    // Prevent overlapping fetch requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      if (!book.apiId) throw new Error("API ID missing for this book.");

      const realVerses = await fetchChapterVerses(book.apiId, chapter, translation, book.name);

      if (realVerses && realVerses.length > 0) {
        setVerses(realVerses);
      } else {
        throw new Error('No verses found for this chapter.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scripture. Please try again.');
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (activeTab === 'bible') {
      fetchVerses(currentBook, currentChapter, currentTranslation.id);
    }
    // Stop reading if tab or chapter changes
    window.speechSynthesis.cancel();
    setIsReading(false);
  }, [currentBook.name, currentChapter, currentTranslation.id, activeTab]);

  // Safety timeout for loading state
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        if (loading) {
          setLoading(false);
          isFetchingRef.current = false;
          if (!verses.length && !error) {
            setError("The scrolls are taking longer than usual to open. Please try again.");
          }
        }
      }, 15000);
    }
    return () => clearTimeout(timer);
  }, [loading, verses.length, error]);

  useEffect(() => {
    if (selectedVerseId && !loading && verses.length > 0) {
      const element = document.getElementById(`verse-${selectedVerseId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedVerseId, loading, verses]);

  const handleSermonToggle = () => {
    if (isSermonListening) {
      sermonService.stop();
      setIsSermonListening(false);
      return;
    }

    if (!sermonService.isSupported()) {
      alert("Live Sermon Mode is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    sermonTranscriptRef.current = '';
    fullSermonTranscriptRef.current = '';
    setSermonTranscript('');

    sermonService.onTranscript = (text, isFinal) => {
      // Keep a rolling buffer of late transcript
      if (isFinal) {
        sermonTranscriptRef.current += ' ' + text;
        fullSermonTranscriptRef.current += ' ' + text;
        // Keep only last ~300 chars to save tokens
        if (sermonTranscriptRef.current.length > 300) {
          sermonTranscriptRef.current = sermonTranscriptRef.current.slice(-300);
        }
      }
      setSermonTranscript(text);

      // Debounce Gemini API hit
      if (sermonTimeoutRef.current) clearTimeout(sermonTimeoutRef.current);
      sermonTimeoutRef.current = setTimeout(async () => {
        if (!sermonTranscriptRef.current) return;

        const result = await extractScriptureReference(sermonTranscriptRef.current);
        if (result) {
          // Found a reference!

          // Translation Bridge checking
          if (result.translation && result.translation.toUpperCase() !== currentTranslation.name.toUpperCase()) {
            setSermonBridgeToast(`Detected ${result.translation}, viewing in ${currentTranslation.name}...`);
            setTimeout(() => setSermonBridgeToast(null), 5000);
          }

          setDetectedRef(result);

          // Log to notes
          setSermonNotes(prev => {
            const exists = prev.some(r => r.book === result.book && r.chapter === result.chapter && r.verse === result.verse);
            if (!exists) return [...prev, result];
            return prev;
          });

          if (autoJump) {
            handleSermonJump(result);
          } else {
            setShowSermonToast(true);
            setTimeout(() => setShowSermonToast(false), 10000); // Wait 10 seconds before auto-dismiss
          }

          // Clear buffer after a successful detection (only the rolling buffer)
          sermonTranscriptRef.current = '';
        }
      }, 2000); // 2 second pause before processing
    };

    sermonService.onError = (err) => {
      if (err !== 'no-speech') {
        setIsSermonListening(false);
      }
    };

    sermonService.start();
    setIsSermonListening(true);
  };

  const handleGenerateSermonInsights = async () => {
    if (!fullSermonTranscriptRef.current || fullSermonTranscriptRef.current.length < 50) {
      alert("Not enough sermon audio recorded to generate insights.");
      return;
    }
    
    setIsGeneratingSermonPack(true);
    // Optionally stop listening if they generate it
    if (isSermonListening) {
      sermonService.stop();
      setIsSermonListening(false);
    }
    
    const pack = await generateSermonContentPack(fullSermonTranscriptRef.current);
    if (pack) {
      setSermonContent(pack);
    } else {
      alert("Failed to generate sermon insights.");
    }
    setIsGeneratingSermonPack(false);
  };

  const handleSermonJump = (ref: ScriptureRef) => {
    const book = BIBLE_BOOKS.find(b => b.name.toLowerCase() === ref.book.toLowerCase() || b.apiId.toLowerCase() === ref.book.toLowerCase());
    if (book) {
      setCurrentBook(book);
      setCurrentChapter(ref.chapter);
      if (ref.verse) {
        // Clear it first to force re-scroll
        setSelectedVerseId(null);
        setTimeout(() => setSelectedVerseId(ref.verse), 100);
      }
    }
    setShowSermonToast(false);
  };

  const handleDeepDive = async (verse: any) => {
    setIsDeepDiveLoading(true);
    setShowDeepDive(true);
    setDeepDiveData(null);

    const reference = `${verse.book_name} ${verse.chapter}:${verse.verse}`;
    const data = await getVerseDeepDive(reference, verse.text);

    setDeepDiveData(data);
    setIsDeepDiveLoading(false);
  };

  const handleGenerateReflection = async () => {
    setShowWeeklyReflection(true);
    setIsReflectionLoading(true);
    setWeeklyReflectionData(null);

    // Gather user data from existing app state (now objects)
    const savedHighlights = Object.entries(bookmarks).map(([key, data]) => ({
      reference: (data as any).reference || key,
      text: (data as any).text || '',
      note: notes[key] || '',
    })).filter(h => h.reference);

    const userNotes = Object.entries(notes).map(([key, content]) => ({
      reference: key,
      content: content as string,
    }));

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // last Sunday
    const weekStartDate = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const input: WeeklyReflectionInput = {
      highlights: savedHighlights.slice(0, 15),
      notes: userNotes.slice(0, 10),
      booksRead: [...new Set(Object.keys(completedChapters).map(k => k.split('-')[0]))],
      versesRead: Object.keys(bookmarks).length + Object.keys(notes).length,
      userName: name || 'Friend',
      weekStartDate,
    };

    const data = await getWeeklyReflection(input);
    setWeeklyReflectionData(data);
    setIsReflectionLoading(false);
  };

  const getAtmosphere = (bookName: string): AtmosphereType => {
    const book = bookName.toLowerCase();

    // Waters: Psalms
    if (book === 'psalms') return 'waters';

    // Desert: Exodus, Numbers, Deuteronomy, Joshua, Judges
    const desertBooks = ['exodus', 'numbers', 'deuteronomy', 'joshua', 'judges'];
    if (desertBooks.includes(book)) return 'desert';

    // Morning: Matthew, Mark, Luke, John, Acts
    const morningBooks = ['matthew', 'mark', 'luke', 'john', 'acts'];
    if (morningBooks.includes(book)) return 'morning';

    return 'none';
  };

  useEffect(() => {
    if (activeTab === 'bible' && atmosphericReadingEnabled) {
      const atmos = getAtmosphere(currentBook.name);
      atmosphereService.play(atmos);
    } else {
      atmosphereService.stop();
    }
  }, [currentBook, activeTab, atmosphericReadingEnabled]);

  const toggleAudio = () => {
    if (audioService.isPlaying || isReading) {
      audioService.stop();
      setIsReading(false);
      setDramatizedChunks([]);
    } else {
      const chunks = audioService.parseChapterToDialogue(verses);
      setDramatizedChunks(chunks);
      setIsReading(true);
      setCurrentAudioIndex(0);
      audioService.play(
        chunks,
        (idx) => setCurrentAudioIndex(idx),
        () => {
          setIsReading(false);
          setDramatizedChunks([]);
        }
      );
    }
  };

  const handleToggleMap = async () => {
    if (showMapOverlay) {
      setShowMapOverlay(false);
      return;
    }

    setShowMapOverlay(true);
    if (!sacredLocations.length) {
      setIsMapLoading(true);
      const chapterText = verses.map(v => v.text).join(' ');
      const locations = await getSacredGeography(`${currentBook.name} ${currentChapter}`, chapterText);
      setSacredLocations(locations);
      if (locations.length > 0) {
        setSelectedLocation(locations[0]);
      }
      setIsMapLoading(false);
    }
  };

  const handleGlobalSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!globalSearchQuery.trim()) return;
    setIsSearching(true);
    setAiAnswer(null);
    const response = await searchBible(globalSearchQuery);
    setSearchResults(response.results);
    setAiAnswer(response.answer);
    setIsSearching(false);
  };

  const navigateToVerse = (reference: string) => {
    // Basic parser for "Book Chapter:Verse" or "Book Chapter"
    const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
    if (match) {
      const bookName = match[1];
      const chapter = parseInt(match[2]);
      const verse = match[3] ? parseInt(match[3]) : null;

      // Handle aliases (e.g. Psalm -> Psalms)
      const normalizedBookName = bookName.toLowerCase() === 'psalm' ? 'psalms' : bookName.toLowerCase();

      const book = BIBLE_BOOKS.find(b => b.name.toLowerCase() === normalizedBookName);
      if (book) {
        setCurrentBook(book);
        setCurrentChapter(chapter);
        if (verse) {
          setSelectedVerseId(verse);
        } else {
          setSelectedVerseId(null);
        }
        setActiveTab('bible');
      }
    }
  };

  const handleBookSelect = (book: BibleBook) => {
    setCurrentBook(book);
    setCurrentChapter(1);
    setNavigatorTab('chapter');
    setBookSearchQuery('');
  };

  const handleChapterSelect = (chapter: number) => {
    setCurrentChapter(chapter);
    setNavigatorTab('verse');
  };

  const handleVerseSelect = (verse: number) => {
    setSelectedVerseId(verse);
    setShowNavigator(false);
    // Scroll logic will be in a useEffect
  };

  const handleEditProfile = () => {
    const newName = prompt('Enter your new name:', name || '');
    if (newName !== null && newName.trim() !== '') {
      setName(newName.trim());
      localStorage.setItem('bible_user_name', newName.trim());
    }
    const newEmail = prompt('Enter your new email:', email || '');
    if (newEmail !== null && newEmail.trim() !== '') {
      setEmail(newEmail.trim());
      localStorage.setItem('bible_user_email', newEmail.trim());
    }
  };

  const handleShareProfile = async () => {
    const shareData = {
      title: `${name || 'Lumina User'}'s Lumina Bible Profile`,
      text: `Check out my reading progress on Lumina Bible! I have a ${streak} day streak!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`Check out my Lumina Bible Profile: ${window.location.href}`);
        alert('Profile link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing profile:', err);
    }
  };

  const calculatePlanProgress = (plan: ReadingPlan) => {
    if (!completedChapters) return 0;
    let totalChapters = 0;
    let readChapters = 0;

    plan.books.forEach(bookName => {
      const book = BIBLE_BOOKS.find(b => b.name === bookName);
      if (book) {
        totalChapters += book.chapters;
        for (let c = 1; c <= book.chapters; c++) {
          if (completedChapters[`${bookName}-${c}`]) {
            readChapters++;
          }
        }
      }
    });

    return totalChapters > 0 ? Math.round((readChapters / totalChapters) * 100) : 0;
  };

  const findNextPlanChapter = (plan: ReadingPlan) => {
    for (const bookName of plan.books) {
      const book = BIBLE_BOOKS.find(b => b.name === bookName);
      if (book) {
        for (let c = 1; c <= book.chapters; c++) {
          if (!completedChapters[`${bookName}-${c}`]) {
            return { book, chapter: c };
          }
        }
      }
    }
    // All read, return first one or null
    const firstBook = BIBLE_BOOKS.find(b => b.name === plan.books[0]);
    return firstBook ? { book: firstBook, chapter: 1 } : null;
  };

  const handleSelectPlan = (plan: ReadingPlan) => {
    setActivePlanId(plan.id);
    localStorage.setItem('bible_active_plan', plan.id);
    const next = findNextPlanChapter(plan);
    if (next) {
      setCurrentBook(next.book);
      setCurrentChapter(next.chapter);
      setActiveTab('bible');
    }
  };

  const getPlanStats = (plan: ReadingPlan) => {
    let totalChapters = 0;
    let readChapters = 0;
    const bookStatuses = plan.books.map(bookName => {
      const book = BIBLE_BOOKS.find(b => b.name === bookName);
      let bookChapters = book?.chapters || 0;
      let bookRead = 0;
      if (book) {
        totalChapters += bookChapters;
        for (let c = 1; c <= bookChapters; c++) {
          if (completedChapters[`${bookName}-${c}`]) {
            bookRead++;
            readChapters++;
          }
        }
      }
      return {
        name: bookName,
        chapters: bookChapters,
        completedCount: bookRead,
        isFinished: bookRead === bookChapters && bookChapters > 0
      };
    });

    return {
      totalChapters,
      readChapters,
      chaptersPerDay: Math.ceil(totalChapters / plan.durationDays),
      bookStatuses,
      progress: totalChapters > 0 ? Math.round((readChapters / totalChapters) * 100) : 0
    };
  };

  const handlePhotoUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfilePhoto(url);
    }
  };

  const nextChapter = () => {
    if (currentChapter < currentBook.chapters) {
      setCurrentChapter(prev => prev + 1);
    } else {
      const currentIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook.name);
      if (currentIndex < BIBLE_BOOKS.length - 1) {
        setCurrentBook(BIBLE_BOOKS[currentIndex + 1]);
        setCurrentChapter(1);
      }
    }
  };

  const prevChapter = () => {
    if (currentChapter > 1) {
      setCurrentChapter(prev => prev - 1);
    } else {
      const currentIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook.name);
      if (currentIndex > 0) {
        const prevBook = BIBLE_BOOKS[currentIndex - 1];
        setCurrentBook(prevBook);
        setCurrentChapter(prevBook.chapters);
      }
    }
  };

  const groupedBooks = useMemo(() => {
    let filtered = BIBLE_BOOKS;
    if (bookSearchQuery) {
      filtered = BIBLE_BOOKS.filter(b => b.name.toLowerCase().includes(bookSearchQuery.toLowerCase()));
    } else {
      filtered = BIBLE_BOOKS.filter(b => b.testament === testamentFilter);
    }
    const groups: Record<string, BibleBook[]> = {};
    filtered.forEach(book => {
      if (!groups[book.category]) groups[book.category] = [];
      groups[book.category].push(book);
    });
    return groups;
  }, [testamentFilter, bookSearchQuery]);

  return (
    <div className={`min-h-screen font-sans pb-24 ${themeColor === 'emerald' ? '' : `theme-${themeColor}`} ${!isDark ? 'light-mode' : ''}`} style={{ background: isDark ? 'linear-gradient(135deg, var(--theme-primary-950) 0%, #0A0A0A 40%, var(--theme-primary-900) 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 55%, #ecfdf5 100%)', color: isDark ? '#F0F0F0' : '#111827' }}>
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] overflow-hidden flex flex-col"
          >
            {/* Gradient Background */}
            {/* Premium Animated Background */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-[#0A0A0A]">
              <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/noise-pattern-with-subtle-cross-lines.png')] opacity-20 mix-blend-overlay"></div>
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] transition-colors duration-1000"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)' }}
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[130px] transition-colors duration-1000"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary-900) 40%, transparent)' }}
              />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
              <AnimatePresence mode="wait">
                {authView === 'intro' && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="w-full max-w-md text-center space-y-16 mt-12"
                  >
                    <div className="space-y-8">
                      <div className="flex justify-center relative">
                        {/* Glow effect back of logo */}
                        <div
                          className="absolute inset-0 blur-2xl rounded-full scale-150 transition-colors duration-500"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}
                        />
                        <div
                          className="relative w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl border border-white/20 backdrop-blur-xl group hover:scale-105 transition-all duration-500"
                          style={{
                            background: 'linear-gradient(to bottom right, var(--theme-primary-400), var(--theme-primary-600))',
                            boxShadow: '0 25px 50px -12px color-mix(in srgb, var(--theme-primary) 30%, transparent)'
                          }}
                        >
                          <BookOpen size={56} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h1 className="text-4xl xs:text-5xl font-black tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                          Lumina
                        </h1>
                        <p
                          className="font-medium text-lg tracking-wide uppercase max-w-[280px] mx-auto leading-relaxed transition-colors duration-500"
                          style={{ color: 'color-mix(in srgb, var(--theme-primary-400) 80%, white)' }}
                        >
                          Illuminate Your Walk With The Word
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5 w-full max-w-[320px] mx-auto">
                      <button
                        onClick={() => setAuthView('signup')}
                        className="w-full py-4 px-8 text-[#022c22] rounded-2xl font-bold text-sm tracking-widest uppercase transition-all hover:-translate-y-1 active:translate-y-0"
                        style={{
                          backgroundColor: 'var(--theme-primary)',
                          boxShadow: '0 0 40px -10px color-mix(in srgb, var(--theme-primary) 50%, transparent)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 60px -10px color-mix(in srgb, var(--theme-primary) 70%, transparent)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 0 40px -10px color-mix(in srgb, var(--theme-primary) 50%, transparent)'}
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => setAuthView('login')}
                        className="w-full py-4 px-8 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-sm tracking-widest uppercase backdrop-blur-md transition-all hover:border-white/20"
                      >
                        Sign In
                      </button>
                    </div>
                  </motion.div>
                )}

                {(authView === 'login' || authView === 'signup') && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="w-full max-w-sm space-y-8 relative"
                  >
                    {/* Glass Container */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl z-0 -mx-6 -my-8 sm:mx-0" />

                    <div className="relative z-10 px-2 sm:px-6 py-4">
                      <div className="flex items-center justify-between mb-8">
                        <button
                          onClick={() => setAuthView('intro')}
                          className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-white transition-colors"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-colors duration-500"
                          style={{ background: 'linear-gradient(to bottom right, var(--theme-primary-400), var(--theme-primary-600))' }}
                        >
                          <BookOpen size={20} />
                        </div>
                      </div>

                      <div className="mb-10 text-center sm:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {authView === 'login' ? 'Welcome Back' : 'Join Lumina'}
                        </h2>
                        <p className="text-gray-400 font-medium text-sm">
                          {authView === 'login' ? 'Sign in to sync your progress.' : 'Create an account to save bookmarks.'}
                        </p>
                      </div>

                      <form
                        onSubmit={authView === 'login' ? handleDBLogin : handleDBSignup}
                        className="space-y-5"
                      >
                        {authError && (
                          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                            {authError}
                          </div>
                        )}

                        {authView === 'signup' && (
                          <div className="space-y-1">
                            <label
                              className="text-[10px] font-bold uppercase tracking-widest ml-4 transition-colors duration-500"
                              style={{ color: 'color-mix(in srgb, var(--theme-primary-400) 80%, white)' }}
                            >
                              Full Name
                            </label>
                            <div className="relative group">
                              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-300" size={20} />
                              <input
                                type="text"
                                required
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full pl-14 pr-4 py-4 md:py-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all focus:bg-white/10 relative z-10"
                                style={{ '--tw-ring-color': 'color-mix(in srgb, var(--theme-primary) 50%, transparent)' } as any}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label
                            className="text-[10px] font-bold uppercase tracking-widest ml-4 transition-colors duration-500"
                            style={{ color: 'color-mix(in srgb, var(--theme-primary-400) 80%, white)' }}
                          >
                            Email Address
                          </label>
                          <div className="relative group">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-300" size={20} />
                            <input
                              type="email"
                              required
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              placeholder="you@email.com"
                              className="w-full pl-14 pr-4 py-4 md:py-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all focus:bg-white/10 relative z-10"
                              style={{ '--tw-ring-color': 'color-mix(in srgb, var(--theme-primary) 50%, transparent)' } as any}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label
                            className="text-[10px] font-bold uppercase tracking-widest ml-4 transition-colors duration-500"
                            style={{ color: 'color-mix(in srgb, var(--theme-primary-400) 80%, white)' }}
                          >
                            Password
                          </label>
                          <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-300" size={20} />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-14 pr-14 py-4 md:py-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all focus:bg-white/10 relative z-10"
                              style={{ '--tw-ring-color': 'color-mix(in srgb, var(--theme-primary) 50%, transparent)' } as any}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 z-20"
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isAuthLoading}
                          className="w-full py-4 md:py-5 text-[#022c22] rounded-2xl font-bold text-sm uppercase tracking-widest transition-all mt-8 relative overflow-hidden flex items-center justify-center gap-2 group disabled:opacity-70"
                          style={{
                            backgroundColor: 'var(--theme-primary)',
                            boxShadow: '0 0 30px -10px color-mix(in srgb, var(--theme-primary) 40%, transparent)'
                          }}
                          onMouseEnter={(e) => !isAuthLoading && (e.currentTarget.style.boxShadow = '0 0 50px -10px color-mix(in srgb, var(--theme-primary) 60%, transparent)')}
                          onMouseLeave={(e) => !isAuthLoading && (e.currentTarget.style.boxShadow = '0 0 30px -10px color-mix(in srgb, var(--theme-primary) 40%, transparent)')}
                        >
                          {isAuthLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <>
                              {authView === 'login' ? 'Sign In' : 'Join Now'}
                              <ArrowRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </button>
                      </form>

                      <p className="text-center text-sm text-gray-400 mt-8 mb-4">
                        {authView === 'login' ? (
                          <>
                            New here?{' '}
                            <button
                              onClick={() => setAuthView('signup')}
                              className="font-bold transition-colors"
                              style={{ color: 'var(--theme-primary)' }}
                            >
                              Create Account
                            </button>
                          </>
                        ) : (
                          <>
                            Already enrolled?{' '}
                            <button
                              onClick={() => setAuthView('login')}
                              className="font-bold transition-colors"
                              style={{ color: 'var(--theme-primary)' }}
                            >
                              Sign In
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <div key="app-content" className={cn(
            "app-content transition-all duration-1000 min-h-screen",
            activeTab === 'bible' && atmosphericReadingEnabled ? `atmos-${getAtmosphere(currentBook.name)}` : "",
            isScribeMode && `scribe-mode scribe-${scribeTexture}`
          )}>
            {isScribeMode && (
              <InkCanvas
                chapterKey={`${currentBook.id}_${currentChapter}`}
                texture={scribeTexture}
                onExit={() => setIsScribeMode(false)}
              />
            )}
            {/* Header (Contextual) */}
            <header className="sticky top-0 z-30 bg-black/20 backdrop-blur-xl border-b border-white/5 px-6 pt-6 md:pt-12 pb-4">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--theme-primary)] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold tracking-tight">Lumina</h1>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Bible App</p>
                    </div>
                  </div>
                </div>
                {/* Removed redundant profile icon button */}
                {activeTab === 'home' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 md:pt-0">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">
                      Good <span className="text-[var(--theme-primary)]">{greeting}</span> {firstName}
                    </h1>
                    <p className="text-gray-400 font-medium text-sm md:text-base">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </motion.div>
                )}

                {activeTab === 'bible' && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className={cn(
                      "flex items-center gap-1 p-1.5 rounded-2xl shadow-sm border transition-colors backdrop-blur-md w-full md:flex-1 shrink-0",
                      readingMode === 'light' ? "bg-black/20 backdrop-blur-md border-white/10" :
                        readingMode === 'sepia' ? "bg-[#e8dfc8]/90 border-[#dcd0b0]" :
                          "bg-[#2a2a2a]/90 border-white/10"
                    )}>

                      {/* Book & Chapter Selector */}
                      <button
                        onClick={() => {
                          setNavigatorTab('book');
                          setShowNavigator(true);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors flex-1 min-w-0",
                          readingMode === 'light' ? "hover:bg-black/5" :
                            readingMode === 'sepia' ? "hover:bg-[#dfd4b8]" :
                              "hover:bg-[#333333]"
                        )}
                      >
                        <span className={cn(
                          "text-[15px] font-bold truncate",
                          readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary-400)]"
                        )}>
                          {currentBook.name} {currentChapter}
                        </span>
                        <ChevronDown size={16} className="text-gray-400 shrink-0" />
                      </button>

                      {/* Divider */}
                      <div className={cn(
                        "w-px h-6 mx-1",
                        readingMode === 'dark' ? "bg-white/10" : "bg-black/10"
                      )} />

                      {/* Verse Selector */}
                      <button
                        onClick={() => {
                          setNavigatorTab('verse');
                          setShowNavigator(true);
                        }}
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-xl transition-colors shrink-0",
                          readingMode === 'light' ? "hover:bg-black/5" :
                            readingMode === 'sepia' ? "hover:bg-[#dfd4b8]" :
                              "hover:bg-[#333333]"
                        )}
                        title="Select Verse"
                      >
                        <span className="text-sm font-bold text-gray-400">V</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-2 -mx-2 px-2 md:mx-0 md:px-0 md:pb-0 scroll-smooth md:ml-3 snap-x">
                      {/* Audio Toggle */}
                      <button
                        onClick={toggleAudio}
                        className={cn(
                          "w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm border shrink-0 snap-center",
                          isReading
                            ? "bg-amber-500 text-white border-amber-400 animate-pulse shadow-amber-200"
                            : readingMode === 'light' ? "bg-white border-white/10 text-gray-500 hover:text-amber-500" :
                              readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0] text-gray-300 hover:text-amber-600" :
                                "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-amber-400"
                        )}
                      >
                        {isReading ? <Headphones size={20} /> : <Volume2 size={20} />}
                      </button>

                      <button
                        onClick={handleSermonToggle}
                        className={cn(
                          "w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm border shrink-0 snap-center",
                          isSermonListening
                            ? "bg-green-500 text-white border-green-400 animate-pulse shadow-green-200"
                            : readingMode === 'light' ? "bg-white border-white/10 text-gray-500 hover:text-green-500" :
                              readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0] text-gray-300 hover:text-green-600" :
                                "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-green-400"
                        )}
                        title="Live Sermon Mode"
                      >
                        <Mic size={20} />
                      </button>

                      <button
                        onClick={() => setShowSermonNotesPanel(true)}
                        className={cn(
                          "w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm border relative shrink-0 snap-center",
                          showSermonNotesPanel
                            ? "bg-[var(--theme-primary)] text-white border-[var(--theme-primary-400)] shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                            : readingMode === 'light' ? "bg-white border-white/10 text-gray-500 hover:text-[var(--theme-primary)]" :
                              readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0] text-gray-300 hover:text-[var(--theme-primary)]" :
                                "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                        )}
                        title="Sermon Notes"
                      >
                        <FileText size={20} />
                        {sermonNotes.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                            {sermonNotes.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={handleToggleMap}
                        className={cn(
                          "w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm border shrink-0 snap-center",
                          showMapOverlay
                            ? "bg-[var(--theme-primary)] text-white border-[var(--theme-primary-400)] shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                            : readingMode === 'light' ? "bg-white border-white/10 text-gray-500 hover:text-[var(--theme-primary)]" :
                              readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0] text-gray-300 hover:text-[var(--theme-primary)]" :
                                "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                        )}
                        title="Sacred Geography Map"
                      >
                        <MapPin size={20} />
                      </button>

                      {/* Scribe Mode */}
                      <button
                        onClick={() => setIsScribeMode(true)}
                        className={cn(
                          "w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm border shrink-0 snap-center",
                          readingMode === 'light' ? "bg-white border-white/10 text-gray-500 hover:text-[var(--theme-primary)]" :
                            readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0] text-gray-300 hover:text-[var(--theme-primary)]" :
                              "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                        )}
                        title="Enter Scribe Mode – Just you and the Word"
                      >
                        <PenTool size={20} />
                      </button>

                      {/* Translation Selector */}
                      <button
                        onClick={() => {
                          setNavigatorTab('version');
                          setShowNavigator(true);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-4 h-11 rounded-2xl border font-bold text-sm transition-all shrink-0 snap-center",
                          "bg-[color-mix(in_srgb,var(--theme-primary-900)_30%,transparent)] border-[var(--theme-primary)]/20 text-[var(--theme-primary-400)] hover:bg-[color-mix(in_srgb,var(--theme-primary-900)_50%,transparent)]"
                        )}
                      >
                        {currentTranslation.name}
                        <ChevronDown size={14} className="opacity-50" />
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'bible' && (
                  <div className="max-w-2xl mx-auto mt-4 px-1">
                    <div className={cn(
                      "w-full h-1 rounded-full overflow-hidden",
                      readingMode === 'dark' ? "bg-white/5" : "bg-black/5"
                    )}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${chapterProgress}%` }}
                        className="h-full bg-[var(--theme-primary)] shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'search' && (
                  <form onSubmit={handleGlobalSearch} className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search keywords, topics, or verses..."
                      value={globalSearchQuery}
                      onChange={(e) => setGlobalSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] transition-all text-lg"
                    />
                  </form>
                )}

                {activeTab === 'plans' && (
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reading Plans</h1>
                    <p className="text-gray-400 font-medium">Track your spiritual journey</p>
                  </div>
                )}

                {activeTab === 'profile' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4">
                      {profileSubView !== 'main' && (
                        <button
                          onClick={() => setProfileSubView('main')}
                          className="p-1.5 md:p-2 hover:bg-white/50 rounded-full transition-colors"
                        >
                          <ArrowLeft size={24} className="scale-75 md:scale-100" />
                        </button>
                      )}
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                          {profileSubView === 'main' ? 'Settings' : 'Saved Items'}
                        </h1>
                        <p className="text-[11px] md:text-sm text-gray-400 font-medium">
                          {profileSubView === 'main' ? 'Manage your account' : 'Bookmarks & Notes'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-2 md:p-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-sm text-gray-500 hover:text-red-500 transition-colors"
                      title="Log out"
                    >
                      <LogOut size={18} className="md:w-5 md:h-5" />
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-6 pt-6">
              <AnimatePresence mode="wait">
                {activeTab === 'home' && (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-10 pb-12"
                  >
                    {/* Verse of the Day - Editorial Style */}
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-600)] rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-10 shadow-sm border border-white/10 overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] rounded-full blur-3xl opacity-50" />

                        <div className="relative z-10 space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-1 h-8 bg-[var(--theme-primary)] rounded-full" />
                              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
                                Verse of the Day
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={shareVotd}
                                className="w-10 h-10 rounded-full flex items-center justify-center transition-all border bg-white text-gray-400 border-white/10 hover:text-[var(--theme-primary)] hover:border-[color-mix(in_srgb,var(--theme-primary)_20%,white)]"
                                title="Share Verse"
                              >
                                <Share2 size={18} />
                              </button>
                              <button
                                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center transition-all border",
                                  notificationsEnabled
                                    ? "bg-[var(--theme-primary)] text-white border-[var(--theme-primary-400)] shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)]"
                                    : "bg-white text-gray-300 border-white/10 hover:text-[var(--theme-primary)] hover:border-[color-mix(in_srgb,var(--theme-primary)_20%,white)]"
                                )}
                                title="Notifications"
                              >
                                {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                              </button>
                            </div>
                          </div>

                          <blockquote className="text-3xl md:text-4xl font-serif italic leading-[1.15] text-white tracking-tight">
                            "{votd.text}"
                          </blockquote>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-xs">
                                {votd.reference.substring(0, 1)}
                              </div>
                              <button
                                onClick={() => navigateToVerse(votd.reference)}
                                className="text-left group/ref"
                              >
                                <p className="text-sm font-black text-white uppercase tracking-wider group-hover/ref:text-[var(--theme-primary)] transition-colors">{votd.reference}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Holy Bible</p>
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={toggleVotdBookmark}
                                className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shadow-sm",
                                  isVotdBookmarked
                                    ? "bg-[var(--theme-primary)] text-white border-[var(--theme-primary-400)] shadow-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)]"
                                    : "bg-white text-gray-400 border-white/10 hover:text-[var(--theme-primary-400)] hover:border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                                )}
                                title="Bookmark Verse"
                              >
                                {isVotdBookmarked ? <BookmarkCheck size={20} fill="currentColor" /> : <Bookmark size={20} />}
                              </button>
                              <button
                                onClick={() => navigateToVerse(votd.reference)}
                                className="group/btn flex items-center justify-center gap-3 px-6 py-3 bg-[var(--theme-primary)] text-white rounded-2xl font-bold text-sm hover:bg-[var(--theme-primary-600)] transition-all shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] h-12"
                              >
                                Read Chapter
                                <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions - Bento Style */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setActiveTab('bible')}
                        className="group relative bg-gray-900 text-white p-6 md:p-8 rounded-[32px] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
                        <div className="relative z-10 flex flex-col h-full justify-between gap-6 md:gap-8">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                            <BookOpen size={24} />
                          </div>
                          <div className="text-left">
                            <p className="text-2xl font-bold tracking-tight mb-1">Continue Reading</p>
                            <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
                              {currentBook.name} {currentChapter}
                              <ArrowRight size={14} />
                            </p>
                          </div>
                        </div>
                      </button>

                      <div className="grid grid-rows-2 gap-4">
                        <button
                          onClick={() => setActiveTab('plans')}
                          className="group bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-6 rounded-[28px] flex items-center justify-between hover:bg-white/10 transition-all hover:shadow-md"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] text-[var(--theme-primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Calendar size={20} />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white">Reading Plans</p>
                              <p className="text-xs text-gray-400 font-medium">4 Active Journeys</p>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-300 group-hover:text-[var(--theme-primary)] transition-colors" />
                        </button>

                        <button
                          onClick={() => setActiveTab('ask')}
                          className="group bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed border border-white/10 p-5 md:p-6 rounded-[28px] flex items-center justify-between hover:border-[color-mix(in_srgb,var(--theme-primary)_40%,white)] transition-all hover:shadow-lg relative overflow-hidden"
                          style={{ backgroundBlendMode: 'overlay', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--theme-primary)]/20 rounded-full blur-3xl group-hover:bg-[var(--theme-primary)]/30 transition-colors" />
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                              <MessageSquare size={20} className="fill-white/20" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white">Ask the Author</p>
                              <p className="text-xs text-gray-400 font-medium line-clamp-1">Chat with David, Paul & more</p>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-300 group-hover:text-white relative z-10 transition-colors" />
                        </button>
                      </div>
                    </div>

                    {/* Recently Bookmarked Section */}
                    {Object.keys(bookmarks).length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 text-[var(--theme-primary-400)] flex items-center justify-center">
                              <Bookmark size={16} fill="currentColor" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight text-white">
                              Recently Bookmarked
                            </h3>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab('profile');
                              setProfileSubView('saved');
                            }}
                            className="text-xs font-black text-[var(--theme-primary-400)] uppercase tracking-widest hover:underline"
                          >
                            View All
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {(Object.entries(bookmarks) as [string, { text: string, reference: string }][]).slice(0, 3).map(([key, data]) => (
                            <div
                              key={key}
                              className="group relative w-full bg-white/5 backdrop-blur-xl p-6 rounded-[28px] border border-white/10 hover:border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)] transition-all hover:shadow-xl hover:shadow-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                              <div className="relative z-10 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => navigateToVerse(data.reference)}
                                    className="px-3 py-1 bg-white/10 text-[var(--theme-primary-400)] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                                  >
                                    {data.reference}
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => shareVerse({ book_name: '', chapter: 0, verse: 0, text: data.text, ...data } as any)}
                                      className="p-2 text-gray-300 hover:text-[var(--theme-primary-400)] transition-colors"
                                    >
                                      <Share2 size={16} />
                                    </button>
                                    <ArrowRight
                                      size={16}
                                      className="text-gray-300 group-hover:text-[var(--theme-primary-400)] group-hover:translate-x-1 transition-all cursor-pointer"
                                      onClick={() => navigateToVerse(data.reference)}
                                    />
                                  </div>
                                </div>
                                <p
                                  className="text-gray-300 text-base font-serif italic leading-relaxed line-clamp-2 cursor-pointer"
                                  onClick={() => navigateToVerse(data.reference)}
                                >
                                  "{data.text}"
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'bible' && (
                  <motion.div
                    key="bible"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "rounded-[32px] transition-all duration-500 relative",
                      readingMode === 'sepia' && "bg-[#f4ecd8] text-[#5b4636]",
                      readingMode === 'dark' && "bg-[#1a1a1a] text-[#d1d1d1]"
                    )}
                    onPanEnd={(_, info) => {
                      const threshold = 50;
                      if (info.offset.x > threshold) {
                        prevChapter();
                      } else if (info.offset.x < -threshold) {
                        nextChapter();
                      }
                    }}
                    onHoverStart={() => setShowNavButtons(true)}
                    onHoverEnd={() => setShowNavButtons(false)}
                    onClick={() => setShowNavButtons(!showNavButtons)}
                  >
                    {/* Floating Navigation Buttons */}
                    <AnimatePresence>
                      {showNavButtons && (
                        <>
                          <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              prevChapter();
                            }}
                            className={cn(
                              "fixed left-6 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-xl border transition-all active:scale-90",
                              readingMode === 'dark'
                                ? "bg-white/10 border-white/10 text-white hover:bg-white/20"
                                : "bg-white/80 border-white/10 text-white hover:bg-white"
                            )}
                          >
                            <ChevronLeft size={28} />
                          </motion.button>
                          <motion.button
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              nextChapter();
                            }}
                            className={cn(
                              "fixed right-6 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-xl border transition-all active:scale-90",
                              readingMode === 'dark'
                                ? "bg-white/10 border-white/10 text-white hover:bg-white/20"
                                : "bg-white/80 border-white/10 text-white hover:bg-white"
                            )}
                          >
                            <ChevronRight size={28} />
                          </motion.button>
                        </>
                      )}
                    </AnimatePresence>
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-gray-500 font-medium">Opening the scrolls...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-32">
                        <p className="text-red-500 mb-4">{error}</p>
                        <button
                          onClick={() => fetchVerses(currentBook, currentChapter, currentTranslation.id)}
                          className="px-6 py-2 bg-[var(--theme-primary)] text-white rounded-full font-semibold"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="text-center mb-12 relative py-8">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                            <h1 className="text-[160px] font-black uppercase tracking-tighter text-gray-500/20">
                              {currentBook.name.substring(0, 2)}
                            </h1>
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 text-white/50">
                            {currentBook.category}
                          </p>
                          <h2 className="text-4xl font-serif italic tracking-tight text-white">
                            {currentBook.name} <span className="font-sans not-italic font-black ml-1 text-[var(--theme-primary)]">{currentChapter}</span>
                          </h2>
                          <div className="w-12 h-1 mx-auto mt-6 rounded-full bg-[var(--theme-primary)]/20" />
                        </div>

                        <div className="space-y-1">
                          {verses.map((v) => {
                            const key = `${v.book_name}-${v.chapter}:${v.verse}`;
                            const isBookmarked = !!bookmarks[key];
                            const hasNote = !!notes[key];
                            const highlightId = highlights[key];
                            const highlight = HIGHLIGHT_COLORS.find(c => c.id === highlightId);
                            const isSelected = selectedVerseId === v.verse;

                            return (
                              <div
                                key={v.verse}
                                id={`verse-${v.verse}`}
                                onClick={() => {
                                  setSelectedVerseId(isSelected ? null : v.verse);
                                  setShowHighlighterMenu(false);
                                }}
                                className={cn(
                                  "relative group px-6 py-4 rounded-3xl transition-all duration-300 cursor-pointer",
                                  isSelected
                                    ? (readingMode === 'dark' ? "bg-[var(--theme-primary)]/10" : "bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)]/50")
                                    : "hover:bg-white/10/30",
                                  readingMode === 'sepia' && isSelected && "bg-[#e8dfc8]",
                                  readingMode === 'dark' && !isSelected && "hover:bg-white/5",
                                  highlight && (readingMode === 'dark' ? highlight.darkBg : highlight.bg)
                                )}
                              >
                                {/* Verse Content */}
                                <div className={cn(
                                  "leading-relaxed transition-colors flex items-start gap-6",
                                  fontSize === 'small' ? 'text-base' : fontSize === 'large' ? 'text-xl' : 'text-lg',
                                  fontEmphasis === 'bold' && "font-bold",
                                  fontEmphasis === 'italic' && "italic",
                                  readingMode === 'sepia' ? 'text-[#5b4636]' : readingMode === 'dark' ? 'text-[#d1d1d1]' : (hasNote ? "text-white" : "text-gray-200")
                                )}>
                                  <div className="flex flex-col items-center select-none flex-shrink-0 w-8 pt-1">
                                    <span className={cn(
                                      "text-[11px] font-black transition-colors",
                                      isSelected ? "text-[var(--theme-primary)]" : "text-gray-300"
                                    )}>
                                      {v.verse}
                                    </span>
                                    <div className="flex gap-0.5 mt-1">
                                      {isBookmarked && <div className="w-1 h-1 rounded-full bg-[var(--theme-primary)]" />}
                                      {hasNote && <div className="w-1 h-1 rounded-full bg-[var(--theme-primary)]" />}
                                      {highlight && <div className={cn("w-1 h-1 rounded-full", highlight.dot)} />}
                                    </div>
                                  </div>

                                  <span className={cn(
                                    "relative flex-1",
                                    hasNote && "decoration-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] decoration-2 underline-offset-4 underline"
                                  )}>
                                    {v.text}
                                  </span>
                                </div>

                                {/* Floating Action Bar for Selected Verse */}
                                <AnimatePresence>
                                  {isSelected && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      className="mt-4 flex flex-col items-center gap-2 w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {showHighlighterMenu && (
                                        <motion.div
                                          initial={{ opacity: 0, y: 5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="flex items-center gap-3 p-2 bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-xl border border-white/10 dark:border-white/10"
                                        >
                                          {HIGHLIGHT_COLORS.map((c) => (
                                            <button
                                              key={c.id}
                                              onClick={() => toggleHighlight(v, c.id)}
                                              className={cn(
                                                "w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 border-2",
                                                c.bg,
                                                highlightId === c.id ? "border-[var(--theme-primary)]" : "border-transparent"
                                              )}
                                            />
                                          ))}
                                          <div className="w-px h-6 bg-gray-100 dark:bg-white/10 mx-1" />
                                          <button
                                            onClick={() => {
                                              const key = `${v.book_name}-${v.chapter}:${v.verse}`;
                                              const newHighlights = { ...highlights };
                                              delete newHighlights[key];
                                              setHighlights(newHighlights);
                                              localStorage.setItem('bible_highlights', JSON.stringify(newHighlights));
                                            }}
                                            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                                            title="Clear Highlight"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </motion.div>
                                      )}

                                      <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 p-1.5 bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-xl border border-white/10 dark:border-white/10 max-w-[calc(100vw-2rem)] mx-auto">
                                        <button
                                          onClick={() => toggleBookmark(v)}
                                          className={cn(
                                            "p-2.5 rounded-xl transition-all shrink-0",
                                            isBookmarked ? "bg-[var(--theme-primary)] text-white" : "text-gray-400 hover:bg-white/15 dark:hover:bg-white/5 hover:text-[var(--theme-primary-400)]"
                                          )}
                                          title="Bookmark"
                                        >
                                          <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                                        </button>
                                        <button
                                          onClick={() => handleOpenNote(v)}
                                          className={cn(
                                            "p-2.5 rounded-xl transition-all shrink-0",
                                            hasNote ? "bg-[var(--theme-primary)] text-white" : "text-gray-400 hover:bg-white/15 dark:hover:bg-white/5 hover:text-[var(--theme-primary)]"
                                          )}
                                          title="Note"
                                        >
                                          <Pencil size={18} />
                                        </button>
                                        <button
                                          onClick={() => setShowHighlighterMenu(!showHighlighterMenu)}
                                          className={cn(
                                            "p-2.5 rounded-xl transition-all shrink-0",
                                            highlightId ? "bg-yellow-400 text-white" : "text-gray-400 hover:bg-white/15 dark:hover:bg-white/5 hover:text-yellow-600"
                                          )}
                                          title="Highlight"
                                        >
                                          <Highlighter size={18} />
                                        </button>
                                        <button
                                          onClick={() => handleDeepDive(v)}
                                          className="p-2.5 rounded-xl transition-all text-gray-400 hover:bg-white/15 dark:hover:bg-white/5 hover:text-cyan-400 shrink-0"
                                          title="Deep Dive (Archeology)"
                                        >
                                          <Compass size={18} />
                                        </button>
                                        <button
                                          onClick={() => copyVerse(v)}
                                          className="p-2.5 rounded-xl text-gray-500 hover:bg-white/15 dark:hover:bg-white/5 hover:text-[var(--theme-primary)] transition-all shrink-0"
                                          title="Copy"
                                        >
                                          {copiedVerseId === v.verse ? <Check size={18} className="text-[var(--theme-primary)]" /> : <Copy size={18} />}
                                        </button>
                                        <button
                                          onClick={() => shareVerse(v)}
                                          className="p-2.5 rounded-xl text-gray-500 hover:bg-white/15 dark:hover:bg-white/5 hover:text-[var(--theme-primary)] transition-all shrink-0"
                                          title="Share"
                                        >
                                          <Share2 size={18} />
                                        </button>
                                        <div className="w-px h-6 bg-gray-100 dark:bg-white/10 mx-1 shrink-0" />
                                        <button
                                          onClick={() => handleVisualize(v)}
                                          className="flex items-center shrink-0 gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-xl font-bold text-xs hover:bg-[var(--theme-primary)] transition-all"
                                        >
                                          <Eye size={16} />
                                          Visualize
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>

                        {/* Navigation */}
                        <div className={cn(
                          "flex items-center justify-between pt-12 border-t mt-12 mb-32 md:mb-8",
                          readingMode === 'dark' ? "border-white/10" : "border-white/10"
                        )}>
                          <button
                            onClick={prevChapter}
                            className={cn(
                              "flex items-center gap-2 transition-colors font-bold text-sm uppercase tracking-widest",
                              readingMode === 'dark' ? "text-gray-500 hover:text-[var(--theme-primary-400)]" : "text-gray-400 hover:text-[var(--theme-primary)]"
                            )}
                          >
                            <ChevronLeft size={20} />
                            <span>Prev Chapter</span>
                          </button>
                          
                          <button
                            onClick={() => toggleProgress(currentBook.name, currentChapter)}
                            className={cn(
                              "flex flex-col md:flex-row items-center gap-1.5 md:gap-2 px-4 py-2 md:px-6 md:py-3 rounded-2xl font-bold text-xs md:text-sm tracking-widest uppercase transition-all shadow-md hover:shadow-lg hover:-translate-y-1 active:translate-y-0 disabled:opacity-50",
                              completedChapters[`${currentBook.name}-${currentChapter}`]
                                ? "bg-[var(--theme-primary)] text-white shadow-[var(--theme-primary)]/20"
                                : readingMode === 'dark'
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] text-[var(--theme-primary)] hover:bg-[color-mix(in_srgb,var(--theme-primary)_15%,white)]"
                            )}
                          >
                            <CheckCircle2 size={16} className={cn("transition-transform md:w-[18px] md:h-[18px]", completedChapters[`${currentBook.name}-${currentChapter}`] && "text-white scale-110")} />
                            <span className="text-[10px] md:text-sm text-center leading-tight">{completedChapters[`${currentBook.name}-${currentChapter}`] ? 'Completed' : 'Mark\nComplete'}</span>
                          </button>

                          <button
                            onClick={nextChapter}
                            className={cn(
                              "flex items-center gap-2 transition-colors font-bold text-sm uppercase tracking-widest text-right",
                              readingMode === 'dark' ? "text-gray-500 hover:text-[var(--theme-primary-400)]" : "text-gray-400 hover:text-[var(--theme-primary)]"
                            )}
                          >
                            <span>Next Chapter</span>
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'search' && (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {isSearching ? (
                      <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-12 h-12 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
                        <div className="text-center space-y-2">
                          <p className="text-white font-bold text-xl">Consulting the AI Chaplain...</p>
                          <p className="text-gray-400 text-sm italic">"Seek and ye shall find..."</p>
                        </div>
                      </div>
                    ) : (searchResults.length > 0 || aiAnswer) ? (
                      <div className="space-y-8">
                        {aiAnswer && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[var(--theme-primary)] text-white p-8 rounded-[32px] shadow-xl shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] relative overflow-hidden group"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all" />
                            <div className="relative z-10 space-y-4">
                              <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-[color-mix(in_srgb,var(--theme-primary)_50%,white)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--theme-primary)_30%,white)]">AI Insight</span>
                              </div>
                              <p className="text-xl font-serif italic leading-relaxed">
                                {aiAnswer}
                              </p>
                            </div>
                          </motion.div>
                        )}

                        <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 ml-4">Relevant Verses</h3>
                          <div className="grid grid-cols-1 gap-4">
                            {searchResults.map((result, idx) => (
                              <button
                                key={idx}
                                onClick={() => navigateToVerse(result.reference)}
                                className="w-full text-left bg-white/5 backdrop-blur-xl p-6 rounded-[28px] border border-white/10 hover:border-[color-mix(in_srgb,var(--theme-primary)_30%,white)] transition-all group hover:shadow-lg hover:shadow-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)]"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-black text-[var(--theme-primary)] text-sm tracking-tight">{result.reference}</span>
                                  <ArrowRight size={16} className="text-gray-300 group-hover:text-[var(--theme-primary-400)] group-hover:translate-x-1 transition-all" />
                                </div>
                                <p className="text-gray-200 italic mb-4 line-clamp-3 font-serif text-lg leading-relaxed">"{result.preview}"</p>
                                <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-xl">
                                  <Info size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-gray-400 leading-tight">{result.relevance}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : globalSearchQuery ? (
                      <div className="text-center py-32">
                        <p className="text-gray-400 font-medium">No results found for "{globalSearchQuery}"</p>
                      </div>
                    ) : (
                      <div className="space-y-12 py-12">
                        <div className="text-center space-y-4">
                          <div className="w-20 h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-sm border border-white/10 flex items-center justify-center mx-auto text-[var(--theme-primary)]">
                            <Search size={32} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-white">AI Scripture Search</h2>
                            <p className="text-gray-400 font-medium">Ask questions or search for topics</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { query: "How to find peace in anxiety?", icon: Sparkles },
                            { query: "Verses about God's love", icon: Heart },
                            { query: "Strength for hard times", icon: BookOpen },
                            { query: "Meaning of John 3:16", icon: Info },
                          ].map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setGlobalSearchQuery(item.query);
                                handleGlobalSearch({ preventDefault: () => { } } as any);
                              }}
                              className="flex items-center gap-4 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] border border-white/10 hover:border-[color-mix(in_srgb,var(--theme-primary)_30%,white)] transition-all text-left group"
                            >
                              <div className="w-10 h-10 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] text-[var(--theme-primary)] flex items-center justify-center group-hover:bg-[var(--theme-primary)] group-hover:text-white transition-colors">
                                <item.icon size={20} />
                              </div>
                              <span className="font-bold text-gray-200 group-hover:text-[var(--theme-primary-600)] transition-colors">{item.query}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'ask' && (
                  <motion.div
                    key="ask"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col h-[calc(100vh-180px)]"
                  >
                    {!selectedPersona ? (
                      // Persona Selection Grid
                      <div className="space-y-6 overflow-y-auto no-scrollbar pb-12">
                        <div className="text-center space-y-2 mb-8 mt-4">
                          <h2 className="text-3xl font-black text-white tracking-tight">Ask the Author</h2>
                          <p className="text-gray-400 font-medium">Have a conversation with Biblical figures</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {PERSONAS.map(persona => (
                            <button
                              key={persona.id}
                              onClick={() => setSelectedPersona(persona)}
                              className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 text-left overflow-hidden hover:shadow-2xl transition-all duration-300"
                            >
                              <div className={cn(
                                "absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity",
                                persona.bg
                              )} />

                              <div className="relative z-10 flex items-start gap-5">
                                <div className={cn(
                                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg",
                                  "bg-gradient-to-br", persona.gradient
                                )}>
                                  {persona.avatar}
                                </div>
                                <div className="flex-1 space-y-1">
                                  <h3 className="text-xl font-bold text-white group-hover:text-[var(--theme-primary)] transition-colors">{persona.name}</h3>
                                  <p className={cn("text-xs font-bold uppercase tracking-widest", persona.color)}>{persona.role}</p>
                                  <p className="text-sm text-gray-400 mt-3 line-clamp-2 leading-relaxed">
                                    {persona.greeting}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Active Chat Interface
                      <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
                        {/* Chat Header */}
                        <div className="px-6 py-4 border-b border-white/10 bg-black/20 flex items-center gap-4">
                          <button
                            onClick={() => setSelectedPersona(null)}
                            className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                          >
                            <ArrowLeft size={20} />
                          </button>
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm",
                            "bg-gradient-to-br", selectedPersona.gradient
                          )}>
                            {selectedPersona.avatar}
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{selectedPersona.name}</h3>
                            <p className={cn("text-[10px] uppercase tracking-widest font-bold", selectedPersona.color)}>{selectedPersona.role}</p>
                          </div>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar relative min-h-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed" style={{ backgroundBlendMode: 'overlay', backgroundColor: 'transparent' }}>
                          {/* Greeting bubble */}
                          <div className="flex justify-start">
                            <div className="bg-white/10 backdrop-blur-md border border-white/10 text-gray-100 rounded-2xl rounded-tl-sm px-5 py-3 max-w-[85%] shadow-sm leading-relaxed">
                              {selectedPersona.greeting}
                            </div>
                          </div>

                          {/* Historical Messages */}
                          {(chatMessages[selectedPersona.id] || []).map(msg => (
                            <div key={msg.id} className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}>
                              <div className={cn(
                                "rounded-2xl px-5 py-3 max-w-[85%] shadow-sm leading-relaxed",
                                msg.isUser
                                  ? "bg-[var(--theme-primary)] text-white rounded-tr-sm"
                                  : "bg-white/10 backdrop-blur-md border border-white/10 text-gray-100 rounded-tl-sm"
                              )}>
                                {msg.text}
                              </div>
                            </div>
                          ))}

                          {isAiTyping && (
                            <div className="flex justify-start">
                              <div className="bg-white/10 backdrop-blur-md border border-white/10 text-gray-400 rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          )}
                          <div ref={chatScrollRef} />
                        </div>

                        {/* Chat Input */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!chatInput.trim() || isAiTyping) return;

                            const newMsg: ChatMessage = {
                              id: Date.now().toString(),
                              text: chatInput.trim(),
                              isUser: true,
                              timestamp: new Date()
                            };

                            setChatMessages(prev => ({
                              ...prev,
                              [selectedPersona.id]: [...(prev[selectedPersona.id] || []), newMsg]
                            }));
                            setChatInput('');
                            setIsAiTyping(true);

                            // Real AI Response
                            const historyContext = (chatMessages[selectedPersona.id] || []).map(m => ({
                              isUser: m.isUser,
                              text: m.text
                            }));

                            askAuthor(selectedPersona.name, selectedPersona.role, chatInput.trim(), historyContext)
                              .then(aiResponseText => {
                                const aiMsg: ChatMessage = {
                                  id: (Date.now() + 1).toString(),
                                  text: aiResponseText,
                                  isUser: false,
                                  timestamp: new Date()
                                };
                                setChatMessages(prev => ({
                                  ...prev,
                                  [selectedPersona.id]: [...(prev[selectedPersona.id] || []), aiMsg]
                                }));
                                setIsAiTyping(false);
                              })
                              .catch(err => {
                                console.error("Chat Failed", err);
                                setIsAiTyping(false);
                              });
                          }}
                          className="p-4 bg-black/20 border-t border-white/10 mt-auto shrink-0"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder={`Message ${selectedPersona.name}...`}
                              className="flex-1 bg-white/10 border border-white/10 text-white rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] placeholder-gray-500"
                            />
                            <button
                              type="submit"
                              disabled={!chatInput.trim() || isAiTyping}
                              className="p-3 bg-[var(--theme-primary)] text-white rounded-full hover:bg-[var(--theme-primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                            >
                              <Send size={20} className="ml-0.5" />
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'plans' && (
                  <motion.div
                    key="plans"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-10 pb-12"
                  >
                    <div className="grid grid-cols-1 gap-6">
                      {READING_PLANS.map((plan, idx) => {
                        const planStyles = [
                          { icon: Sparkles, color: 'text-[var(--theme-primary)]', bg: 'bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)]', border: 'border-[color-mix(in_srgb,var(--theme-primary)_20%,white)]', accent: 'bg-[var(--theme-primary)]', shadow: 'shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)]' },
                          { icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', accent: 'bg-rose-600', shadow: 'shadow-rose-100' },
                          { icon: Globe, color: 'text-[var(--theme-primary-400)]', bg: 'bg-white/10', border: 'border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]', accent: 'bg-[var(--theme-primary)]', shadow: 'shadow-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)]' },
                          { icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', accent: 'bg-amber-600', shadow: 'shadow-amber-100' },
                        ][idx % 4];

                        return (
                          <div
                            key={plan.id}
                            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 border border-white/10 shadow-sm hover:shadow-xl hover:shadow-black/5 transition-all duration-500 overflow-hidden"
                          >
                            {/* Background Decoration */}
                            <div className={cn(
                              "absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30",
                              planStyles.bg
                            )} />

                            <div className="relative z-10 space-y-6">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                                    planStyles.bg,
                                    planStyles.color
                                  )}>
                                    <planStyles.icon size={28} />
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-black tracking-tight text-white">{plan.title}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest",
                                        planStyles.bg,
                                        planStyles.color
                                      )}>
                                        {plan.durationDays} Days
                                      </span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {plan.books.length} Books
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <p className="text-gray-500 leading-relaxed text-sm font-medium">
                                {plan.description}
                              </p>

                              {(() => {
                                const progress = calculatePlanProgress(plan);
                                return (
                                  <>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex justify-between items-end">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Progress</p>
                                        <p className={cn("text-xs font-black", planStyles.color)}>{progress}%</p>
                                      </div>
                                      <div className="w-full h-3 bg-white/5 backdrop-blur-sm rounded-full overflow-hidden p-0.5 border border-white/10">
                                        <div
                                          className={cn("h-full rounded-full transition-all duration-1000", planStyles.accent)}
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                      <button
                                        onClick={() => handleSelectPlan(plan)}
                                        className={cn(
                                          "flex-1 py-4 rounded-2xl font-black text-sm text-white transition-all shadow-lg active:scale-95",
                                          planStyles.accent,
                                          planStyles.shadow
                                        )}
                                      >
                                        {activePlanId === plan.id ? 'Resume Journey' : 'Start Journey'}
                                      </button>
                                      <button
                                        onClick={() => setSelectedPlanForDetails(plan)}
                                        className="p-4 rounded-2xl bg-white/5 text-gray-400 hover:text-white border border-white/10 transition-all active:scale-95"
                                      >
                                        <Info size={20} />
                                      </button>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {selectedPlanForDetails && ((() => {
                        const stats = getPlanStats(selectedPlanForDetails);
                        return (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                          >
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setSelectedPlanForDetails(null)}
                              className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            />

                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 20 }}
                              className="relative w-full max-w-2xl max-h-[85vh] bg-neutral-900/90 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
                            >
                              {/* Header */}
                              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-[var(--theme-primary)]/20 flex items-center justify-center text-[var(--theme-primary)]">
                                    <BookOpen size={24} />
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-black text-white">{selectedPlanForDetails.title}</h2>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{selectedPlanForDetails.durationDays} Day Journey</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setSelectedPlanForDetails(null)}
                                  className="p-3 rounded-full hover:bg-white/5 text-gray-400 transition-colors"
                                >
                                  <X size={24} />
                                </button>
                              </div>

                              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                                {/* Stats Row */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Reading Rate</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-3xl font-black text-white">{stats.chaptersPerDay}</span>
                                      <span className="text-xs font-bold text-gray-400">chap/day</span>
                                    </div>
                                  </div>
                                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Progress</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-3xl font-black text-white">{stats.progress}%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Content Breakdown */}
                                <div className="space-y-4">
                                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Journey Breakdown</h3>
                                  <div className="space-y-3">
                                    {stats.bookStatuses.map((book, bIdx) => (
                                      <div
                                        key={bIdx}
                                        className="p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between group"
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                            book.isFinished ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"
                                          )}>
                                            {book.isFinished ? <Check size={20} /> : <BookMarked size={20} />}
                                          </div>
                                          <div>
                                            <p className="font-bold text-white group-hover:text-[var(--theme-primary)] transition-colors">{book.name}</p>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                              {book.completedCount} / {book.chapters} Chapters
                                            </p>
                                          </div>
                                        </div>
                                        <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-[var(--theme-primary)] transition-all duration-700"
                                            style={{ width: `${(book.completedCount / book.chapters) * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Action */}
                              <div className="p-8 border-t border-white/5 shrink-0">
                                <button
                                  onClick={() => {
                                    handleSelectPlan(selectedPlanForDetails);
                                    setSelectedPlanForDetails(null);
                                  }}
                                  className="w-full py-5 rounded-[24px] bg-[var(--theme-primary)] text-white font-black text-lg shadow-xl shadow-[var(--theme-primary)]/20 active:scale-95 transition-all"
                                >
                                  {activePlanId === selectedPlanForDetails.id ? 'Continue Journey' : 'Begin This Journey'}
                                </button>
                              </div>
                            </motion.div>
                          </motion.div>
                        );
                      })())}
                    </AnimatePresence>
                  </motion.div>
                )}

                {activeTab === 'gallery' && (
                  <motion.div
                    key="gallery"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8 pb-32"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h1 className="text-4xl font-black tracking-tight text-white">Meditation Gallery</h1>
                          <p className="text-gray-400 font-medium tracking-wide uppercase text-[10px]">Your personal collection of scripture-inspired art</p>
                        </div>
                        {isAuthenticated && gallery.length > 0 && (
                          <button
                            onClick={pushLocalGalleryToCloud}
                            disabled={isUploadingGallery}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all"
                          >
                            {isUploadingGallery ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                            {isUploadingGallery ? 'Syncing...' : 'Sync to Cloud'}
                          </button>
                        )}
                      </div>
                      
                      {isAuthenticated && gallery.some(g => g.url && g.url.startsWith('data:image')) && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 text-sm text-blue-100 items-start">
                          <CloudIcon size={18} className="text-blue-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-blue-200">Cloud Sync Available</p>
                            <p className="text-blue-100/70 leading-relaxed text-xs">
                              You have images stored only on this device. Click <strong>Sync to Cloud</strong> to back them up to your account so you can view them on your phone.
                            </p>
                          </div>
                        </div>
                      )}

                      {galleryUploadStatus && (
                        <p className="text-xs text-emerald-400 font-medium">{galleryUploadStatus}</p>
                      )}
                    </div>

                    {gallery.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                        <div className="w-24 h-24 rounded-[32px] bg-gray-50 flex items-center justify-center text-gray-300">
                          <ImageIcon size={48} strokeWidth={1} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-white">Your gallery is empty</h3>
                          <p className="text-gray-400 max-w-[240px] text-sm leading-relaxed">
                            Visualize verses in the Bible reader to start your collection.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('bible')}
                          className="px-8 py-4 bg-[var(--theme-primary)] text-white rounded-2xl font-bold text-sm hover:bg-[var(--theme-primary-600)] transition-all shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)]"
                        >
                          Go to Bible
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {gallery.map((item) => (
                          <motion.div
                            key={item.id}
                            layoutId={item.id}
                            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-sm border border-white/10 hover:shadow-xl transition-all duration-500"
                          >
                            <div className="aspect-square relative overflow-hidden">
                              <img
                                src={item.url}
                                alt={item.reference}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = item.url;
                                      link.download = `Lumina_${item.reference}.png`;
                                      link.click();
                                    }}
                                    className="flex-1 py-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                                  >
                                    <Copy size={16} />
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setGallery(prev => prev.filter(i => i.id !== item.id));
                                    }}
                                    className="p-3 bg-red-500/20 backdrop-blur-md hover:bg-red-500/40 text-red-200 rounded-xl transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="p-6 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-black text-[var(--theme-primary)] uppercase tracking-widest">{item.reference}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.date}</p>
                              </div>
                              <p className="text-sm text-gray-300 italic font-serif line-clamp-2">"{item.text}"</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6 md:space-y-8 pb-32 md:pb-12"
                  >
                    {profileSubView === 'main' ? (
                      <>
                        {/* Profile Header */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] md:rounded-[32px] p-6 md:p-8 shadow-sm space-y-6 md:space-y-8 relative overflow-hidden">
                          {/* Decorative Background Element */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />

                          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                            <div className="relative">
                              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[color-mix(in_srgb,var(--theme-primary)_10%,white)] shadow-md">
                                <img
                                  src={profilePhoto}
                                  alt="Profile"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoUpload}
                                accept="image/*"
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 p-2 bg-[var(--theme-primary)] text-white rounded-full shadow-lg border-2 border-white hover:bg-[var(--theme-primary-600)] transition-all transform hover:scale-110"
                              >
                                <Camera size={14} />
                              </button>
                            </div>
                            <div className="text-center md:text-left flex-1">
                              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <h2 className="text-3xl font-bold text-white tracking-tight">{name || 'Lumina User'}</h2>
                                <div className="px-2 py-0.5 bg-[var(--theme-primary)] text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]">
                                  {Object.keys(completedChapters).length > 50 ? 'Elite' : 'Pro'}
                                </div>
                              </div>
                              <p className="text-gray-400 font-medium">{email || 'user@luminabible.com'}</p>
                              <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mt-4 flex-wrap">
                                <button onClick={handleEditProfile} className="px-5 py-2 md:px-4 md:py-1.5 bg-[var(--theme-primary)] text-white text-[11px] md:text-xs font-bold rounded-full hover:bg-[var(--theme-primary-600)] transition-colors shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] flex-1 md:flex-none">Edit Profile</button>
                                <button onClick={handleShareProfile} className="px-5 py-2 md:px-4 md:py-1.5 bg-white/10 border border-white/20 text-gray-200 text-[11px] md:text-xs font-bold rounded-full hover:bg-white/20 transition-colors flex-1 md:flex-none">Share Profile</button>
                              </div>
                            </div>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 md:gap-4 pt-6 md:pt-8 border-t border-white/10">
                            <div className="space-y-1 bg-white/5 md:bg-transparent p-3 md:p-0 rounded-[20px]">
                              <p className="text-xl md:text-2xl font-black text-white leading-none text-center md:text-left">{Object.keys(completedChapters).length}</p>
                              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center md:text-left break-words">Chapters</p>
                            </div>
                            <div className="space-y-1 bg-white/5 md:bg-transparent p-3 md:p-0 rounded-[20px] md:rounded-none md:border-x border-white/10 md:px-4">
                              <p className="text-xl md:text-2xl font-black text-white leading-none text-center md:text-left">{Object.keys(bookmarks).length}</p>
                              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center md:text-left break-words">Saved</p>
                            </div>
                            <div className="space-y-1 bg-white/5 md:bg-transparent p-3 md:p-0 rounded-[20px]">
                              <div className="flex items-center justify-center md:justify-start gap-1">
                                <p className="text-xl md:text-2xl font-black text-white leading-none text-center md:text-left">{streak}</p>
                                <Sparkles size={14} className="text-amber-500" />
                              </div>
                              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center md:text-left break-words">Day Streak</p>
                            </div>
                          </div>
                        </div>

                        {/* Reading Activity Section */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Reading Activity</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-6 rounded-[24px] md:rounded-[28px] space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="p-2 rounded-xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] text-[var(--theme-primary)]">
                                  <BookOpen size={20} />
                                </div>
                                <span className="text-[10px] font-bold text-[var(--theme-primary)] uppercase bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] px-2 py-1 rounded-md">Last Read</span>
                              </div>
                              <button
                                onClick={() => navigateToVerse(`${currentBook.name} ${currentChapter}`)}
                                className="text-left group/ref"
                              >
                                <h4 className="font-bold text-white group-hover/ref:text-[var(--theme-primary)] transition-colors">{currentBook.name} {currentChapter}</h4>
                                <p className="text-xs text-gray-400 mt-1">Read 2 hours ago</p>
                              </button>
                              <button
                                onClick={() => setActiveTab('bible')}
                                className="w-full py-2.5 bg-[var(--theme-primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--theme-primary-600)] transition-colors shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)]"
                              >
                                Continue Reading
                              </button>
                            </div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-6 rounded-[24px] md:rounded-[28px] space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="p-2 rounded-xl bg-white/10 text-[var(--theme-primary-400)]">
                                  <Calendar size={20} />
                                </div>
                                <span className="text-[10px] font-bold text-[var(--theme-primary-400)] uppercase bg-white/10 px-2 py-1 rounded-md">Daily Goal</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-white">{dailyGoal} Chapters / Day</h4>
                                <div className="mt-3 space-y-2">
                                  <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                    <span>Progress</span>
                                    <span>{Math.min(100, Math.round((chaptersReadToday / dailyGoal) * 100))}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[var(--theme-primary)] rounded-full transition-all duration-1000"
                                      style={{ width: `${Math.min(100, (chaptersReadToday / dailyGoal) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 font-medium">
                                {chaptersReadToday >= dailyGoal
                                  ? "Goal reached! Amazing work."
                                  : `${dailyGoal - chaptersReadToday} more chapter${dailyGoal - chaptersReadToday === 1 ? '' : 's'} to reach your goal!`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Reading Statistics */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Reading Statistics</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-6 rounded-[24px] md:rounded-[28px] space-y-6">
                            <div className="flex items-end justify-between h-32 px-2">
                              {(() => {
                                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                const todayIdx = new Date().getDay();
                                const last7Days = Array.from({ length: 7 }, (_, i) => {
                                  const d = new Date();
                                  d.setDate(d.getDate() - (6 - i));
                                  return d;
                                });

                                const stats = last7Days.map(date => {
                                  const dateStr = date.toDateString();
                                  const count = (history || []).filter(h => h && h.date && new Date(h.date).toDateString() === dateStr).length;
                                  return {
                                    day: days[date.getDay()],
                                    count,
                                    active: dateStr === new Date().toDateString()
                                  };
                                });

                                const maxCount = Math.max(...stats.map(s => s.count), 1);

                                return stats.map((stat, i) => (
                                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                    <div
                                      className={cn(
                                        "w-full max-w-[12px] rounded-full transition-all duration-500",
                                        stat.active ? "bg-[var(--theme-primary)] shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)]" : "bg-white/10"
                                      )}
                                      style={{ height: `${Math.max(10, (stat.count / maxCount) * 100)}%` }}
                                    />
                                    <span className={cn(
                                      "text-[10px] font-bold",
                                      stat.active ? "text-[var(--theme-primary)]" : "text-gray-400"
                                    )}>{stat.day}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                              <div className="text-center">
                                <p className="text-sm font-bold text-white">{chaptersReadToday}</p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Chapters Today</p>
                              </div>
                              <div className="text-center border-l border-white/10">
                                <p className="text-sm font-bold text-white">
                                  {(history || []).filter(h => {
                                    if (!h || !h.date) return false;
                                    const d = new Date(h.date);
                                    const now = new Date();
                                    const diff = now.getTime() - d.getTime();
                                    return diff < 7 * 24 * 60 * 60 * 1000;
                                  }).length}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">This Week</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Achievements */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between ml-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Achievements</h3>
                            {earnedBadges.length > 0 && (
                              <button
                                onClick={() => setProfileSubView('badges')}
                                className="text-[10px] font-bold text-[var(--theme-primary)] uppercase tracking-wider hover:underline"
                              >
                                View Trophy Room
                              </button>
                            )}
                          </div>
                          {earnedBadges.length > 0 ? (
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-4 -mx-4">
                              {earnedBadges.map((badge) => (
                                <div key={badge.id} className="flex-shrink-0 flex flex-col items-center gap-2">
                                  <div className={cn(
                                    "w-16 h-16 rounded-full flex items-center justify-center shadow-sm border border-white/10",
                                    badge.bg,
                                    badge.color
                                  )}>
                                    <badge.icon size={24} />
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{badge.label}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-[24px] md:rounded-[28px] text-center">
                              <p className="text-xs text-gray-500 italic">No badges earned yet. Keep reading to unlock achievements!</p>
                            </div>
                          )}
                        </div>

                        {/* Account & Content */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Account & Content</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] border border-white/10 shadow-sm overflow-hidden">
                            <button
                              onClick={() => setProfileSubView('saved')}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/10 transition-colors border-b border-white/10 group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-2xl bg-white/10 text-[var(--theme-primary-400)] group-hover:scale-110 transition-transform">
                                  <Bookmark size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-gray-100">Saved Items</p>
                                  <p className="text-xs text-gray-400">Manage your {Object.keys(bookmarks).length} bookmarks and notes</p>
                                </div>
                              </div>
                              <ChevronRight size={18} className="text-gray-300 group-hover:text-[var(--theme-primary-400)] transition-colors" />
                            </button>

                            <button
                              onClick={() => setProfileSubView('history')}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-2xl bg-white/10 text-[var(--theme-primary-400)] group-hover:scale-110 transition-transform">
                                  <History size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-gray-100">Reading History</p>
                                  <p className="text-xs text-gray-400">View your recent activity ({history.length} items)</p>
                                </div>
                              </div>
                              <ChevronRight size={18} className="text-gray-300 group-hover:text-[var(--theme-primary-400)] transition-colors" />
                            </button>
                          </div>
                        </div>

                        {/* Reading Experience */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Reading Experience</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] md:rounded-[28px] border border-white/10 shadow-sm p-5 md:p-6 space-y-5 md:space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-white/10 text-[var(--theme-primary-400)]">
                                  <Moon size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-gray-100">Reading Mode</p>
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Theme & colors</p>
                                </div>
                              </div>
                              <div className="flex bg-black/30 border border-white/10 p-1 rounded-xl">
                                {(['light', 'sepia', 'dark'] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    onClick={() => updateReadingMode(mode)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                      readingMode === mode
                                        ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                        : "text-gray-400 hover:text-gray-200"
                                    )}
                                  >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-white/10 text-[var(--theme-primary-400)]">
                                  <Type size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-gray-100">Font Size</p>
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Adjust reading comfort</p>
                                </div>
                              </div>
                              <div className="flex bg-black/30 border border-white/10 p-1 rounded-xl">
                                {(['small', 'medium', 'large'] as const).map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => handleFontSizeChange(size)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                      fontSize === size
                                        ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                        : "text-gray-400 hover:text-gray-200"
                                    )}
                                  >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-white/10 text-[var(--theme-primary-400)]">
                                  <Type size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-gray-100">Font Style</p>
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Emphasis & weight</p>
                                </div>
                              </div>
                              <div className="flex bg-black/30 border border-white/10 p-1 rounded-xl">
                                {(['normal', 'bold', 'italic'] as const).map((emphasis) => (
                                  <button
                                    key={emphasis}
                                    onClick={() => handleFontEmphasisChange(emphasis)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                      fontEmphasis === emphasis
                                        ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                        : "text-gray-400 hover:text-gray-200"
                                    )}
                                  >
                                    {emphasis.charAt(0).toUpperCase() + emphasis.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Personalization */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Personalization</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] border border-white/10 shadow-sm overflow-hidden p-6 space-y-6">

                            {/* App Theme: Light / Dark */}
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-100 flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl text-[var(--theme-primary-400)]">
                                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                                </div>
                                App Theme
                              </span>
                              <div className="flex bg-black/30 border border-white/10 p-1 rounded-xl">
                                {([
                                  { label: '☀️ Light', value: false },
                                  { label: '🌑 Dark', value: true },
                                ] as const).map((opt) => (
                                  <button
                                    key={String(opt.value)}
                                    onClick={() => {
                                      setIsDark(opt.value);
                                      localStorage.setItem('bible_dark_mode', String(opt.value));
                                    }}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                      isDark === opt.value
                                        ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                        : "text-gray-400 hover:text-gray-200"
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <hr className="border-white/10" />

                            {/* App Theme Accent */}
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="font-bold text-gray-100 flex items-center gap-3">
                                  <div className="p-2 bg-white/10 rounded-xl text-gray-600"><Star size={18} /></div>
                                  Accent Color
                                </span>
                              </div>
                              <div className="flex gap-4 p-2 bg-white/5 backdrop-blur-sm rounded-2xl justify-between">
                                {[
                                  { id: 'emerald', bg: 'bg-[var(--theme-primary)]', name: 'Emerald' },
                                  { id: 'rose', bg: 'bg-rose-500', name: 'Rose' },
                                  { id: 'amber', bg: 'bg-amber-500', name: 'Amber' },
                                  { id: 'blue', bg: 'bg-blue-500', name: 'Ocean' },
                                  { id: 'purple', bg: 'bg-purple-500', name: 'Royal' },
                                ].map((swatch) => (
                                  <button
                                    key={swatch.id}
                                    onClick={() => updateThemeColor(swatch.id as any)}
                                    className={`w-10 h-10 rounded-full outline-none focus:outline-none transition-all relative
                                      ${themeColor === swatch.id ? 'scale-110 shadow-lg ring-4 ring-white/40 ring-offset-2 ring-offset-black/60' : 'hover:scale-105 opacity-70 hover:opacity-100'}
                                      ${swatch.bg}
                                    `}
                                  >
                                    {themeColor === swatch.id && (
                                      <Check size={16} className="absolute inset-0 m-auto text-white shadow-sm" strokeWidth={3} />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <hr className="border-white/10" />

                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-100">Push Notifications</span>
                              <button
                                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                className={cn(
                                  "w-14 h-8 rounded-full p-1 transition-colors relative",
                                  notificationsEnabled ? "bg-[var(--theme-primary)]" : "bg-white/10 border border-white/10"
                                )}
                              >
                                <motion.div
                                  layout
                                  className="w-6 h-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-sm"
                                  animate={{ x: notificationsEnabled ? 24 : 0 }}
                                />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-100">Promotional Emails</span>
                              <button
                                onClick={() => setPromoEmails(!promoEmails)}
                                className={cn(
                                  "w-14 h-8 rounded-full p-1 transition-colors relative",
                                  promoEmails ? "bg-[var(--theme-primary)]" : "bg-white/10 border border-white/10"
                                )}
                              >
                                <motion.div
                                  layout
                                  className="w-6 h-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-sm"
                                  animate={{ x: promoEmails ? 24 : 0 }}
                                />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-100 block">Sermon Auto-Jump</span>
                                <span className="text-xs text-gray-500">Automatically navigate when a verse is detected</span>
                              </div>
                              <button
                                onClick={() => setAutoJump(!autoJump)}
                                className={cn(
                                  "w-14 h-8 rounded-full p-1 transition-colors relative",
                                  autoJump ? "bg-[var(--theme-primary)]" : "bg-white/10 border border-white/10"
                                )}
                              >
                                <motion.div
                                  layout
                                  className="w-6 h-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-sm"
                                  animate={{ x: autoJump ? 24 : 0 }}
                                />
                              </button>
                            </div>

                            <hr className="border-white/10" />

                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-100 block">Scribe Texture</span>
                                <span className="text-xs text-gray-500">Choice of background for Scribe Mode</span>
                              </div>
                              <div className="flex bg-black/30 border border-white/10 p-1 rounded-xl">
                                {[
                                  { label: '📜 Parchment', value: 'parchment' },
                                  { label: '🪨 Stone', value: 'stone' },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setScribeTexture(opt.value as any)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                      scribeTexture === opt.value
                                        ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                        : "text-gray-400 hover:text-gray-200"
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* My Journey */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">My Journey</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] overflow-hidden">
                            <button
                              onClick={handleGenerateReflection}
                              className="w-full flex items-center justify-between p-5 hover:bg-amber-500/10 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                  <Sparkles size={20} />
                                </div>
                                <div className="text-left">
                                  <p className="font-semibold text-white group-hover:text-amber-300 transition-colors">Weekly Growth Report</p>
                                  <p className="text-xs text-gray-400">AI-curated spiritual journal for this week</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-full">New</span>
                                <ArrowRight size={18} className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Support & Community */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-4">Support & Community</h3>
                          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] border border-white/10 shadow-sm overflow-hidden">
                            {[
                              { id: 'giving', icon: CreditCard, label: 'My Giving', color: 'text-rose-400', bg: 'bg-rose-500/20', desc: 'Manage your contributions' },
                              { id: 'story', icon: Share2, label: 'Share Your Story', color: 'text-purple-400', bg: 'bg-purple-500/20', desc: 'Inspire others with your journey' },
                              { id: 'support', icon: HelpCircle, label: 'Help & Support', color: 'text-[var(--theme-primary-400)]', bg: 'bg-[var(--theme-primary)]/20', desc: 'Get assistance or report issues' },
                              { id: 'about', icon: Info, label: 'About App', color: 'text-gray-300', bg: 'bg-white/10', desc: 'Version 2.4.0' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  if (item.id === 'giving') alert('Redirecting to secure giving portal...');
                                  if (item.id === 'story') alert('Opening story submission form...');
                                  if (item.id === 'support') window.location.href = 'mailto:support@luminabible.com';
                                  if (item.id === 'about') alert('Lumina Bible v2.4.0\n\nA modern, beautiful way to read the scripture. Created with love.');
                                }}
                                className="w-full flex items-center justify-between p-5 hover:bg-white/10 transition-colors border-b border-white/10 last:border-0 group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", item.bg, item.color)}>
                                    <item.icon size={20} />
                                  </div>
                                  <div className="text-left">
                                    <p className="font-bold text-gray-100">{item.label}</p>
                                    <p className="text-xs text-gray-400">{item.desc}</p>
                                  </div>
                                </div>
                                <ChevronRight size={18} className="text-gray-500 group-hover:text-[var(--theme-primary-400)] transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-4 space-y-3">
                          <button
                            onClick={handleLogout}
                            className="w-full py-4 flex items-center justify-center gap-2 text-gray-400 font-bold hover:bg-white/10 rounded-[20px] transition-colors border border-white/10"
                          >
                            <LogOut size={18} />
                            Sign Out
                          </button>
                          <button className="w-full py-4 flex items-center justify-center gap-2 text-red-400 font-bold hover:bg-red-500/10 rounded-[20px] transition-colors border border-red-500/20">
                            <Trash2 size={18} />
                            Delete Account
                          </button>
                        </div>
                      </>
                    ) : profileSubView === 'saved' ? (
                      <div className="space-y-6">
                        {/* Header for Saved Items */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button onClick={() => setProfileSubView('main')} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                              <ArrowLeft size={20} />
                            </button>
                            <h2 className="text-2xl font-bold text-white">Saved Items</h2>
                          </div>
                          {(Object.keys(bookmarks).length > 0 || Object.keys(notes).length > 0) && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to clear all saved items? This cannot be undone.')) {
                                  setBookmarks({});
                                  setNotes({});
                                  localStorage.removeItem('bible_bookmarks');
                                  localStorage.removeItem('bible_notes');
                                }
                              }}
                              className="text-xs font-bold text-red-400 hover:text-red-500 transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {/* Search and Filters */}
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                              type="text"
                              placeholder="Search bookmarks and notes..."
                              value={savedSearchQuery}
                              onChange={(e) => setSavedSearchQuery(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] transition-all shadow-sm"
                            />
                          </div>
                          <div className="flex gap-2 bg-white/10 border border-white/10 p-1 rounded-2xl">
                            {(['all', 'bookmarks', 'notes'] as const).map((filter) => (
                              <button
                                key={filter}
                                onClick={() => setSavedFilter(filter)}
                                className={cn(
                                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                                  savedFilter === filter
                                    ? "bg-white/15 text-[var(--theme-primary)] shadow-sm border border-white/10"
                                    : "text-gray-400 hover:text-gray-200"
                                )}
                              >
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List of Items */}
                        <div className="space-y-4">
                          {(() => {
                            const filteredItems = [
                              ...(Object.entries(bookmarks) as [string, { text: string, reference: string }][]).map(([key, data]) => ({
                                key,
                                type: 'bookmark' as const,
                                text: data.text,
                                reference: data.reference
                              })),
                              ...(Object.entries(notes) as [string, string][]).map(([key, text]) => {
                                const [book, rest] = key.split('-');
                                const [chapter, verse] = rest.split(':');
                                return {
                                  key,
                                  type: 'note' as const,
                                  text,
                                  reference: key,
                                  book_name: book,
                                  chapter: parseInt(chapter),
                                  verse: parseInt(verse)
                                };
                              })
                            ].filter(item => {
                              const matchesSearch = item.text.toLowerCase().includes(savedSearchQuery.toLowerCase()) ||
                                item.reference.toLowerCase().includes(savedSearchQuery.toLowerCase());
                              const matchesFilter = savedFilter === 'all' ||
                                (savedFilter === 'bookmarks' && item.type === 'bookmark') ||
                                (savedFilter === 'notes' && item.type === 'note');
                              return matchesSearch && matchesFilter;
                            });

                            if (filteredItems.length === 0) {
                              return (
                                <div className="text-center py-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] border border-white/10 border-dashed">
                                  <div className="w-16 h-16 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search size={24} className="text-gray-300" />
                                  </div>
                                  <p className="text-gray-400 font-medium">No saved items found</p>
                                </div>
                              );
                            }

                            return filteredItems.map((item) => (
                              <div
                                key={item.key}
                                className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[24px] shadow-sm space-y-4 group"
                              >
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => navigateToVerse(item.reference)}
                                    className="flex items-center gap-2 group/ref"
                                  >
                                    <div className={cn(
                                      "p-1.5 rounded-lg transition-colors",
                                      item.type === 'bookmark' ? "bg-white/10 text-[var(--theme-primary-400)] group-hover/ref:bg-white/20" : "bg-[color-mix(in_srgb,var(--theme-primary)_10%,white)] text-[var(--theme-primary)] group-hover/ref:bg-[color-mix(in_srgb,var(--theme-primary)_15%,white)]"
                                    )}>
                                      {item.type === 'bookmark' ? <Bookmark size={14} /> : <FileText size={14} />}
                                    </div>
                                    <span className="font-bold text-gray-100 group-hover/ref:text-[var(--theme-primary)] transition-colors">{item.reference}</span>
                                  </button>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.type === 'note' && (
                                      <button
                                        onClick={() => handleOpenNote({
                                          book_name: (item as any).book_name,
                                          chapter: (item as any).chapter,
                                          verse: (item as any).verse,
                                          text: item.text
                                        })}
                                        className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-[var(--theme-primary)] transition-colors"
                                      >
                                        <Pencil size={18} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => item.type === 'bookmark' ? deleteBookmark(item.key) : deleteNote(item.key)}
                                      className="p-2 hover:bg-red-500/10 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                                <p className={cn(
                                  "text-gray-300 text-sm leading-relaxed",
                                  item.type === 'bookmark' ? "italic" : ""
                                )}>
                                  {item.type === 'bookmark' ? `"${item.text}"` : item.text}
                                </p>
                                <button
                                  onClick={() => navigateToVerse(item.reference)}
                                  className="text-xs font-bold text-[var(--theme-primary)] hover:underline flex items-center gap-1"
                                >
                                  View in Bible <ArrowRight size={12} />
                                </button>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    ) : profileSubView === 'history' ? (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <button onClick={() => setProfileSubView('main')} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                          </button>
                          <h2 className="text-2xl font-bold text-white">Reading History</h2>
                        </div>
                        <div className="space-y-3">
                          {history.length > 0 ? history.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => navigateToVerse(item.reference)}
                              className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-[24px] flex items-center justify-between hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-xl bg-white/10 text-gray-400">
                                  <BookOpen size={18} />
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-white group-hover:text-[var(--theme-primary)] transition-colors">{item.reference}</p>
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              <ArrowRight size={16} className="text-gray-500 group-hover:text-[var(--theme-primary)] group-hover:translate-x-1 transition-all" />
                            </button>
                          )) : (
                            <div className="text-center py-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] border-dashed">
                              <p className="text-gray-400 font-medium">No history recorded yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : profileSubView === 'badges' ? (
                      <div className="space-y-6 text-center">
                        <div className="flex items-center gap-4 text-left mb-8">
                          <button onClick={() => setProfileSubView('main')} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                          </button>
                          <h2 className="text-2xl font-bold text-white">Achievement Gallery</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          {earnedBadges.map((badge) => (
                            <div key={badge.id} className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] relative overflow-hidden group">
                              <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br transition-opacity group-hover:opacity-20", badge.gradient || "from-white to-transparent")} />
                              <div className={cn(
                                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 shadow-lg",
                                badge.bg,
                                badge.color,
                                "border-white/10"
                              )}>
                                <badge.icon size={32} />
                              </div>
                              <h4 className="font-bold text-white text-lg tracking-tight">{badge.label}</h4>
                              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{badge.desc}</p>
                            </div>
                          ))}
                        </div>
                        {earnedBadges.length === 0 && (
                          <div className="py-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] border-dashed">
                            <Sparkles className="mx-auto mb-4 text-gray-600" size={40} />
                            <p className="text-gray-400 font-medium px-8">Your trophy room is currently empty. Embark on your journey and earn badges through reading, bookmarking, and creating!</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Dramatized Audio Player Overlay */}
              <AnimatePresence>
                {isReading && dramatizedChunks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-28 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 pointer-events-auto"
                  >
                    <div className={cn(
                      "backdrop-blur-xl rounded-3xl p-4 shadow-2xl border transition-colors",
                      readingMode === 'light' ? "bg-white/90 border-black/5 shadow-black/10" :
                        readingMode === 'sepia' ? "bg-[#f4ecd8]/95 border-[#dcd0b0] shadow-[#5b4636]/10" :
                          "bg-[#1a1a1a]/95 border-white/10 shadow-black/50"
                    )}>

                      {/* Speaker Indicator and Controls */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                          dramatizedChunks[currentAudioIndex]?.role === 'character'
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        )}>
                          {dramatizedChunks[currentAudioIndex]?.role === 'character' ? <Users size={14} /> : <Mic size={14} />}
                          {dramatizedChunks[currentAudioIndex]?.role === 'character' ? 'Character Dialogue' : 'Narrator'}
                        </div>
                        <div className="flex items-center gap-1">
                          {isAudioLoading && (
                            <div className="flex items-center justify-center w-8 h-8 mr-1">
                              <div className="w-4 h-4 rounded-full border-2 border-[var(--theme-primary)] border-t-transparent animate-spin" />
                            </div>
                          )}
                          <button
                            onClick={() => setShowAudioSettings(!showAudioSettings)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                              showAudioSettings ? "bg-black/10 dark:bg-white/20 text-gray-800 dark:text-white" : "hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"
                            )}
                          >
                            <Settings2 size={16} />
                          </button>
                          <button
                            onClick={toggleAudio}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Settings Dropdown */}
                      <AnimatePresence>
                        {showAudioSettings && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="py-2 px-1 mb-3 space-y-3 border-b border-black/5 dark:border-white/10 pb-4">
                              <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Narrator Voice</label>
                                <select
                                  value={selectedNarratorURI}
                                  onChange={(e) => {
                                    setSelectedNarratorURI(e.target.value);
                                    audioService.setNarratorVoice(e.target.value);
                                  }}
                                  className={cn(
                                    "w-full text-sm rounded-lg p-2 outline-none appearance-none cursor-pointer",
                                    readingMode === 'light' ? "bg-black/5 border-transparent" : "bg-black/20 border-white/10 text-white"
                                  )}
                                >
                                  {availableVoices.map(v => (
                                    <option key={v.name} value={v.name}>{v.label} ({v.languageCode})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Character Voice</label>
                                <select
                                  value={selectedCharacterURI}
                                  onChange={(e) => {
                                    setSelectedCharacterURI(e.target.value);
                                    audioService.setCharacterVoice(e.target.value);
                                  }}
                                  className={cn(
                                    "w-full text-sm rounded-lg p-2 outline-none appearance-none cursor-pointer",
                                    readingMode === 'light' ? "bg-black/5 border-transparent" : "bg-black/20 border-white/10 text-white"
                                  )}
                                >
                                  {availableVoices.map(v => (
                                    <option key={v.name} value={v.name}>{v.label} ({v.languageCode})</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Animated Waveform */}
                      <div className="flex items-center justify-center gap-1 h-12 mb-4">
                        {[...Array(24)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{
                              height: isReading && audioService.isPlaying
                                ? ['20%', `${40 + Math.random() * 60}%`, '20%']
                                : '20%'
                            }}
                            transition={{
                              duration: 0.5 + Math.random() * 0.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            className={cn(
                              "w-1 rounded-full",
                              dramatizedChunks[currentAudioIndex]?.role === 'character' ? "bg-amber-500" : "bg-blue-400"
                            )}
                          />
                        ))}
                      </div>

                      {/* Controls */}
                      <div className="flex justify-center items-center gap-6">
                        <button
                          onClick={() => {
                            if (audioService.isPlaying) { audioService.pause(); } else { audioService.resume(); }
                          }}
                          className={cn(
                            "w-14 h-14 flex items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95",
                            dramatizedChunks[currentAudioIndex]?.role === 'character' ? "bg-amber-500 shadow-amber-500/25" : "bg-blue-500 shadow-blue-500/25"
                          )}
                        >
                          {audioService.isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
                        </button>

                        <button
                          onClick={toggleAudio}
                          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500"
                        >
                          <Square size={20} className="fill-current" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sacred Geography Overlay Component */}
              <AnimatePresence>
                {showMapOverlay && activeTab === 'bible' && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className={cn(
                      "fixed bottom-24 left-4 right-4 md:left-auto md:right-8 lg:right-12 xl:right-16 md:w-[400px] lg:w-[480px] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.15)] overflow-hidden backdrop-blur-3xl border z-50",
                      readingMode === 'light' ? "bg-white/98 border-black/10" :
                        readingMode === 'sepia' ? "bg-[#f4ecd8]/98 border-[#dcd0b0]/50" :
                          "bg-[#1a1a1a]/98 border-white/10"
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-[14px] flex items-center justify-center",
                            "bg-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)] text-[var(--theme-primary)]"
                          )}>
                            <MapPin size={20} />
                          </div>
                          <div>
                            <h3 className={cn(
                              "font-bold text-base leading-tight",
                              readingMode === 'light' || readingMode === 'sepia' ? "text-gray-900" : "text-white"
                            )}>
                              Sacred Geography
                            </h3>
                            <p className={cn(
                              "text-xs font-medium",
                              readingMode === 'light' || readingMode === 'sepia' ? "text-gray-500" : "text-gray-400"
                            )}>
                              {currentBook.name} {currentChapter}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowMapOverlay(false)}
                          className={cn(
                            "w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                            readingMode === 'light' || readingMode === 'sepia' ? "hover:bg-black/5 text-gray-500 hover:text-gray-900" : "hover:bg-white/10 text-gray-400 hover:text-white"
                          )}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {isMapLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-5">
                          <Loader2 className="animate-spin text-[var(--theme-primary)]" size={36} />
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Charting Ancient Paths...</p>
                        </div>
                      ) : sacredLocations.length === 0 ? (
                        <div className="text-center py-14 px-6 relative">
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 rounded-2xl pointer-events-none" />
                          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4 border border-black/5 dark:border-white/5">
                            <MapPin size={28} className="text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className={cn("text-sm font-medium leading-relaxed", readingMode === 'light' || readingMode === 'sepia' ? "text-gray-600" : "text-gray-400")}>
                            No specific geographic locations were identified in this chapter.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Map Embed Container */}
                          <div className="w-full h-[220px] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 relative group">
                            {selectedLocation ? (
                              <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}&t=k&z=11&output=embed`}
                                allowFullScreen
                                title={`Map of ${selectedLocation.modernName}`}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium">Map Loading...</div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20">
                              <span className="text-white text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5 hover:text-[var(--theme-primary-300)] transition-colors cursor-default">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary-500)] animate-pulse" />
                                Live View
                              </span>
                            </div>
                          </div>

                          {/* Location Cards Carousel */}
                          <div className="relative -mx-2">
                            <div className="flex gap-3 overflow-x-auto pb-4 px-2 snap-x hide-scrollbar">
                              {sacredLocations.map((loc, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedLocation(loc)}
                                  className={cn(
                                    "flex-shrink-0 w-[240px] snap-center rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group",
                                    selectedLocation === loc
                                      ? "bg-[color-mix(in_srgb,var(--theme-primary)_6%,transparent)] border-[var(--theme-primary)]/40 shadow-sm"
                                      : readingMode === 'light' || readingMode === 'sepia'
                                        ? "bg-white/80 border-black/5 hover:border-black/15 shadow-sm hover:shadow-md"
                                        : "bg-white/5 border-white/10 hover:border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                                  )}
                                >
                                  {/* Active highlight bar */}
                                  <div className={cn(
                                    "absolute top-0 inset-x-0 h-1 transition-all duration-500",
                                    selectedLocation === loc ? "bg-[var(--theme-primary)]" : "bg-transparent"
                                  )} />

                                  <div className="p-4">
                                    <div className="flex items-baseline justify-between mb-2">
                                      <h4 className={cn("font-bold text-sm truncate pr-2", readingMode === 'light' || readingMode === 'sepia' ? "text-gray-900" : "text-white")}>
                                        {loc.ancientName}
                                      </h4>
                                      <span className="text-[9px] font-black text-[var(--theme-primary)] uppercase tracking-wider whitespace-nowrap bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded-full">
                                        {loc.modernName}
                                      </span>
                                    </div>
                                    <p className={cn("text-xs leading-relaxed line-clamp-3", readingMode === 'light' || readingMode === 'sepia' ? "text-gray-600" : "text-gray-300")}>
                                      {loc.context}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* Floating Pill Bottom Navigation */}
            <nav className="fixed bottom-6 left-0 right-0 px-4 z-40 p-[var(--safe-area-inset-bottom)] pointer-events-none flex justify-center">
              <div className={cn(
                "mx-auto backdrop-blur-2xl rounded-full p-2 flex items-center shadow-2xl pointer-events-auto transition-all duration-500",
                readingMode === 'light' ? "bg-white/10 backdrop-blur-2xl border border-white/20 shadow-black/30" :
                  readingMode === 'sepia' ? "bg-[#f4ecd8]/90 border border-[#dcd0b0] shadow-[#5b4636]/10" :
                    "bg-[#1a1a1a]/90 border border-white/10 shadow-black/50"
              )}>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'home', icon: Home, label: 'Home' },
                    { id: 'bible', icon: BookOpen, label: 'Bible' },
                    { id: 'gallery', icon: ImageIcon, label: 'Gallery' },
                    { id: 'ask', icon: MessageSquare, label: 'Ask' },
                    { id: 'plans', icon: Calendar, label: 'Plans' },
                    { id: 'profile', icon: User, label: 'Profile' },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={cn(
                          "relative py-3 px-4 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-500 ease-out",
                          isActive
                            ? (readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary-600)]")
                            : (readingMode === 'dark' ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"),
                          !isActive && "w-14"
                        )}
                      >
                        {/* Animated Active Background Pill */}
                        {isActive && (
                          <motion.div
                            layoutId="navPill"
                            className={cn(
                              "absolute inset-0 rounded-full",
                              readingMode === 'dark' ? "bg-white/10 shadow-inner" :
                                readingMode === 'sepia' ? "bg-[#e8dec0] shadow-inner" :
                                  "bg-[color-mix(in_srgb,var(--theme-primary)_25%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)]"
                            )}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-2 overflow-hidden">
                          <tab.icon
                            size={isActive ? 20 : 22}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={cn("transition-all duration-300 flex-shrink-0", isActive && "scale-105")}
                          />
                          <AnimatePresence>
                            {isActive && (
                              <motion.span
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "auto", opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="text-sm font-bold whitespace-nowrap overflow-hidden"
                              >
                                {tab.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>

            {/* Bible Navigator Modal (Styled after image) */}
            <AnimatePresence>
              {showNavigator && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowNavigator(false)}
                    className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 p-0 md:p-6 pointer-events-none"
                  >
                    <div className={cn(
                      "w-full md:max-w-xl md:rounded-[24px] rounded-t-[32px] max-h-[90vh] md:max-h-[80vh] overflow-hidden flex flex-col shadow-2xl pointer-events-auto border",
                      isDark ? "bg-[#0d1f17] border-white/10" : "bg-white border-gray-200"
                    )}>
                      {/* Modal Header */}
                      <div className={cn(
                        "px-6 py-4 border-b flex items-center justify-between sticky top-0 z-10",
                        isDark ? "bg-[#0d1f17] border-white/10" : "bg-white border-gray-100"
                      )}>
                        <button
                          onClick={() => setShowNavigator(false)}
                          className={cn("text-sm font-medium transition-colors", isDark ? "text-gray-500 hover:text-gray-100" : "text-gray-400 hover:text-gray-900")}
                        >
                          Cancel
                        </button>
                        <h3 className={cn("text-sm font-bold uppercase tracking-widest", isDark ? "text-white" : "text-gray-900")}>
                          {navigatorTab === 'book' ? 'Select Book' : navigatorTab === 'chapter' ? 'Select Chapter' : 'Select Version'}
                        </h3>
                        <button
                          onClick={() => setShowNavigator(false)}
                          className={cn(
                            "text-sm font-bold",
                            readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary)]"
                          )}
                        >
                          Done
                        </button>
                      </div>

                      {/* Navigator Tabs */}
                      <div className={cn(
                        "flex border-b p-1",
                        isDark ? "bg-black/20 border-white/10" : "bg-gray-50 border-gray-100"
                      )}>
                        {[
                          { id: 'book', label: 'Book' },
                          { id: 'chapter', label: 'Chapter' },
                          { id: 'verse', label: 'Verse' },
                          { id: 'version', label: 'Version' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setNavigatorTab(tab.id as any)}
                            className={cn(
                              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                              navigatorTab === tab.id
                                ? isDark
                                  ? "bg-white/10 text-[var(--theme-primary)] shadow-sm"
                                  : "bg-white text-[var(--theme-primary)] shadow-sm border border-gray-100"
                                : isDark
                                  ? "text-gray-400 hover:text-gray-200"
                                  : "text-gray-500 hover:text-gray-800"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Search Bar (Only for Book tab) */}
                      {navigatorTab === 'book' && (
                        <div className={cn(
                          "px-6 py-4 border-b",
                          readingMode === 'dark' ? "border-white/10" : "border-white/10"
                        )}>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                              type="text"
                              placeholder="Search books..."
                              value={bookSearchQuery}
                              onChange={(e) => setBookSearchQuery(e.target.value)}
                              className={cn(
                                "w-full pl-12 pr-4 py-3 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] transition-all",
                                isDark ? "bg-white/10 text-white placeholder-gray-500" : "bg-gray-100 text-gray-900 placeholder-gray-400"
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                        {navigatorTab === 'book' && (
                          <div className="space-y-8">
                            {/* Testament Filter (Only if not searching) */}
                            {!bookSearchQuery && (
                              <div className={cn("flex gap-2 mb-6 p-1 rounded-2xl", isDark ? "bg-black/20" : "bg-gray-100")}>
                                <button
                                  onClick={() => setTestamentFilter('OT')}
                                  className={cn(
                                    "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                                    testamentFilter === 'OT'
                                      ? isDark ? "bg-white/10 text-[var(--theme-primary)] shadow-sm" : "bg-white text-[var(--theme-primary)] shadow-sm border border-gray-100"
                                      : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-800"
                                  )}
                                >
                                  Old Testament
                                </button>
                                <button
                                  onClick={() => setTestamentFilter('NT')}
                                  className={cn(
                                    "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                                    testamentFilter === 'NT'
                                      ? isDark ? "bg-white/10 text-[var(--theme-primary)] shadow-sm" : "bg-white text-[var(--theme-primary)] shadow-sm border border-gray-100"
                                      : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-800"
                                  )}
                                >
                                  New Testament
                                </button>
                              </div>
                            )}

                            {(Object.entries(groupedBooks) as [string, BibleBook[]][]).length > 0 ? (
                              (Object.entries(groupedBooks) as [string, BibleBook[]][]).map(([category, books]) => (
                                <div key={category}>
                                  <h4 className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest mb-4",
                                    readingMode === 'dark' ? "text-gray-300" : "text-gray-300"
                                  )}>
                                    {category}
                                  </h4>
                                  <div className="space-y-1">
                                    {books.map(book => (
                                      <button
                                        key={book.name}
                                        onClick={() => handleBookSelect(book)}
                                        className={cn(
                                          "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group",
                                          currentBook.name === book.name
                                            ? "bg-[color-mix(in_srgb,var(--theme-primary)_12%,transparent)]"
                                            : isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                                        )}
                                      >
                                        <div>
                                          <p className={cn(
                                            "text-lg font-medium",
                                            currentBook.name === book.name
                                              ? "text-[var(--theme-primary)]"
                                              : isDark ? "text-gray-200" : "text-gray-800"
                                          )}>
                                            {book.name}
                                          </p>
                                          <p className="text-xs text-gray-400">{book.chapters} Chapters</p>
                                        </div>
                                        {currentBook.name === book.name && (
                                          <CheckCircle2 size={20} className={readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary)]"} />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-12">
                                <p className="text-gray-400 font-medium">No books found matching "{bookSearchQuery}"</p>
                              </div>
                            )}
                          </div>
                        )}

                        {navigatorTab === 'chapter' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-gray-400">{currentBook.name}</h4>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const currentIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook.name);
                                    if (currentIndex > 0) {
                                      handleBookSelect(BIBLE_BOOKS[currentIndex - 1]);
                                      setNavigatorTab('chapter');
                                    }
                                  }}
                                  disabled={BIBLE_BOOKS.findIndex(b => b.name === currentBook.name) === 0}
                                  className={cn(
                                    "p-2 rounded-xl border transition-all disabled:opacity-30 disabled:pointer-events-none",
                                    readingMode === 'dark' ? "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary-400)]" : "bg-gray-50 border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                                  )}
                                  title="Previous Book"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <button
                                  onClick={() => setNavigatorTab('book')}
                                  className={cn(
                                    "px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                                    readingMode === 'dark' ? "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary-400)]" : "bg-gray-50 border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                                  )}
                                >
                                  {currentBook.name}
                                </button>
                                <button
                                  onClick={() => {
                                    const currentIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook.name);
                                    if (currentIndex < BIBLE_BOOKS.length - 1) {
                                      handleBookSelect(BIBLE_BOOKS[currentIndex + 1]);
                                      setNavigatorTab('chapter');
                                    }
                                  }}
                                  disabled={BIBLE_BOOKS.findIndex(b => b.name === currentBook.name) === BIBLE_BOOKS.length - 1}
                                  className={cn(
                                    "p-2 rounded-xl border transition-all disabled:opacity-30 disabled:pointer-events-none",
                                    readingMode === 'dark' ? "bg-[#2a2a2a] border-white/10 text-gray-500 hover:text-[var(--theme-primary-400)]" : "bg-gray-50 border-white/10 text-gray-500 hover:text-[var(--theme-primary)]"
                                  )}
                                  title="Next Book"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                              {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map(chapter => (
                                <button
                                  key={chapter}
                                  onClick={() => handleChapterSelect(chapter)}
                                  className={cn(
                                    "aspect-square flex items-center justify-center rounded-2xl text-lg font-bold transition-all",
                                    currentChapter === chapter
                                      ? (readingMode === 'dark' ? "bg-[var(--theme-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary-900)_40%,transparent)] scale-105" : "bg-[var(--theme-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] scale-105")
                                      : (readingMode === 'dark' ? "bg-[#2a2a2a] text-gray-500 hover:bg-[#333333]" : "bg-gray-100 text-gray-500 hover:bg-gray-200")
                                  )}
                                >
                                  {chapter}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {navigatorTab === 'verse' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-gray-400">{currentBook.name} {currentChapter}</h4>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setNavigatorTab('chapter')}
                                  className={cn(
                                    "text-xs font-bold hover:underline",
                                    readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary)]"
                                  )}
                                >
                                  Change Chapter
                                </button>
                              </div>
                            </div>
                            {loading ? (
                              <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <div className={cn(
                                  "w-6 h-6 border-2 border-t-transparent rounded-full animate-spin",
                                  readingMode === 'dark' ? "border-[var(--theme-primary-400)]" : "border-[var(--theme-primary)]"
                                )} />
                                <p className="text-xs text-gray-400 font-medium">Loading verses...</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {verses.map((v) => (
                                  <button
                                    key={v.verse}
                                    onClick={() => handleVerseSelect(v.verse)}
                                    className={cn(
                                      "aspect-square flex items-center justify-center rounded-2xl text-lg font-bold transition-all",
                                      selectedVerseId === v.verse
                                        ? (readingMode === 'dark' ? "bg-[var(--theme-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary-900)_40%,transparent)] scale-105" : "bg-[var(--theme-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] scale-105")
                                        : (readingMode === 'dark' ? "bg-[#2a2a2a] text-gray-500 hover:bg-[#333333]" : "bg-gray-100 text-gray-500 hover:bg-gray-200")
                                    )}
                                  >
                                    {v.verse}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {navigatorTab === 'version' && (
                          <div className="space-y-1">
                            <h4 className={cn(
                              "text-[10px] font-bold uppercase tracking-widest mb-4",
                              readingMode === 'dark' ? "text-gray-300" : "text-gray-300"
                            )}>
                              English
                            </h4>
                            {TRANSLATIONS.map(t => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setCurrentTranslation(t);
                                  setShowNavigator(false);
                                }}
                                className={cn(
                                  "w-full text-left px-4 py-4 rounded-xl transition-all flex items-center justify-between group",
                                  currentTranslation.id === t.id
                                    ? "bg-[var(--theme-primary)]/10"
                                    : "hover:bg-white/10"
                                )}
                              >
                                <div>
                                  <p className={cn(
                                    "text-lg font-bold",
                                    currentTranslation.id === t.id
                                      ? "text-[var(--theme-primary-400)]"
                                      : "text-gray-300"
                                  )}>
                                    {t.name}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {t.id === 'web' ? 'World English Bible' :
                                      t.id === 'kjv' ? 'King James Version' :
                                        t.id === 'bbe' ? 'Bible in Basic English' : 'Open English Bible'}
                                  </p>
                                </div>
                                {currentTranslation.id === t.id && (
                                  <CheckCircle2 size={20} className={readingMode === 'dark' ? "text-[var(--theme-primary-400)]" : "text-[var(--theme-primary)]"} />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Note Modal */}
            <AnimatePresence>
              {editingNoteVerse && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setEditingNoteVerse(null)}
                    className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    className="fixed inset-x-0 bottom-0 z-[70] p-4 md:p-0 md:inset-0 md:flex md:items-center md:justify-center pointer-events-none"
                  >
                    <div className={cn(
                      "w-full md:max-w-md rounded-[32px] overflow-hidden flex flex-col shadow-2xl pointer-events-auto transition-colors duration-500",
                      readingMode === 'light' ? "bg-white" :
                        readingMode === 'sepia' ? "bg-[#f4ecd8]" :
                          "bg-[#1a1a1a]"
                    )}>
                      <div className={cn(
                        "p-6 border-b flex items-center justify-between",
                        readingMode === 'light' ? "border-white/10" :
                          readingMode === 'sepia' ? "border-[#dcd0b0]" :
                            "border-white/10"
                      )}>
                        <h3 className={cn(
                          "font-bold",
                          readingMode === 'light' ? "text-gray-900" :
                            readingMode === 'sepia' ? "text-[#5b4636]" :
                              "text-white"
                        )}>
                          Note for {editingNoteVerse.book_name} {editingNoteVerse.chapter}:{editingNoteVerse.verse}
                        </h3>
                        <button
                          onClick={() => setEditingNoteVerse(null)}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            readingMode === 'light' ? "hover:bg-black/5 text-gray-400" :
                              readingMode === 'sepia' ? "hover:bg-black/5 text-[#8a7560]" :
                                "hover:bg-white/10 text-gray-400"
                          )}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6 space-y-4">
                        <p className={cn(
                          "text-sm italic",
                          readingMode === 'light' ? "text-gray-600" :
                            readingMode === 'sepia' ? "text-[#7d6855]" :
                              "text-gray-400"
                        )}>"{editingNoteVerse.text}"</p>
                        <textarea
                          autoFocus
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="Write your personal reflections here..."
                          className={cn(
                            "w-full h-40 p-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all resize-none",
                            readingMode === 'light' ? "bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]" :
                              readingMode === 'sepia' ? "bg-[#e8dfc8] text-[#5b4636] placeholder:text-[#8a7560] focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]" :
                                "bg-[#2a2a2a] text-white placeholder:text-gray-500 focus:ring-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                          )}
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => setEditingNoteVerse(null)}
                            className={cn(
                              "flex-1 py-4 rounded-2xl font-bold transition-all",
                              readingMode === 'light' ? "bg-gray-100 text-gray-600 hover:bg-gray-200" :
                                readingMode === 'sepia' ? "bg-[#dcd0b0] text-[#5b4636] hover:bg-[#d0c4a0]" :
                                  "bg-[#2a2a2a] text-gray-400 hover:bg-[#333333]"
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveNote}
                            className={cn(
                              "flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg transform active:scale-95",
                              readingMode === 'dark' ? "bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary-400)] shadow-[color-mix(in_srgb,var(--theme-primary-900)_40%,transparent)]" : "bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary-600)] shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
                            )}
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            {/* Visualizer Modal */}
            <AnimatePresence>
              {visualizingVerse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setVisualizingVerse(null)}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-[40px] overflow-hidden shadow-2xl border border-white/10"
                  >
                    <div className="relative aspect-square w-full bg-black flex items-center justify-center">
                      {isGeneratingImage ? (
                        <div className="flex flex-col items-center gap-6 text-center px-12">
                          <div className="relative">
                            <div className="w-20 h-20 border-4 border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] rounded-full animate-ping absolute inset-0" />
                            <div className="w-20 h-20 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin relative z-10" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">Creating your vision...</h3>
                            <p className="text-[var(--theme-primary-400)]/60 italic font-serif">"And God said, Let there be light..."</p>
                          </div>
                        </div>
                      ) : generatedImage ? (
                        <motion.img
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          src={generatedImage}
                          alt="Scripture Visualization"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center p-12">
                          <p className="text-red-400">Failed to generate image. Please try again.</p>
                        </div>
                      )}

                      <button
                        onClick={() => setVisualizingVerse(null)}
                        className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="p-8 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--theme-primary)]/20 flex items-center justify-center text-[var(--theme-primary-400)]">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-lg">{currentBook.name} {currentChapter}:{visualizingVerse.verse}</h4>
                          <p className="text-[var(--theme-primary-400)]/60 text-xs uppercase tracking-widest font-black">AI Visualization</p>
                        </div>
                      </div>
                      <p className="text-gray-400 italic font-serif text-lg leading-relaxed">
                        "{visualizingVerse.text}"
                      </p>

                      <div className="pt-6 flex gap-4">
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = generatedImage || '';
                            link.download = `Lumina_${currentBook.name}_${currentChapter}_${visualizingVerse.verse}.png`;
                            link.click();
                          }}
                          disabled={!generatedImage}
                          className="flex-1 py-4 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] disabled:opacity-50 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Copy size={20} />
                          Save to Gallery
                        </button>
                        <button
                          onClick={() => setVisualizingVerse(null)}
                          className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Translation Bridge Toast */}
            <AnimatePresence>
              {sermonBridgeToast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 pointer-events-none w-full max-w-sm">
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="bg-black/80 backdrop-blur-md border border-[var(--theme-primary)]/30 shadow-2xl rounded-2xl p-3 text-center"
                  >
                    <p className="text-white text-sm font-medium flex items-center justify-center gap-2">
                      <Sparkles size={16} className="text-[var(--theme-primary)]" />
                      {sermonBridgeToast}
                    </p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Sermon Mode Confirmation Toast */}
            <AnimatePresence>
              {showSermonToast && detectedRef && !autoJump && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[100]">
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-[32px] overflow-hidden"
                  >
                    <div className="flex items-center gap-4 p-4 pb-2">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--theme-primary)]/20 flex items-center justify-center text-[var(--theme-primary)] shrink-0">
                        <MapPin size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-lg truncate">
                          {detectedRef.book} {detectedRef.chapter}{detectedRef.verse ? `:${detectedRef.verse}` : ''}
                        </h4>
                        <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">Live Sermon Detected</p>
                      </div>
                    </div>

                    <div className="flex gap-2 p-4 pt-2">
                      <button
                        onClick={() => setShowSermonToast(false)}
                        className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleSermonJump(detectedRef)}
                        className="flex-1 py-3 rounded-xl font-bold text-white transition-all bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-600)] shadow-[0_0_20px_-5px_color-mix(in_srgb,var(--theme-primary)_50%,transparent)]"
                      >
                        Jump Now
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Sermon Notes Panel */}
            <AnimatePresence>
              {showSermonNotesPanel && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowSermonNotesPanel(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={cn(
                      "fixed top-0 right-0 h-full w-full max-w-sm z-50 shadow-2xl border-l flex flex-col",
                      readingMode === 'dark' ? "bg-[#1a1a1a] border-white/10" :
                        readingMode === 'sepia' ? "bg-[#e8dfc8] border-[#dcd0b0]" :
                          "bg-white border-black/10"
                    )}
                  >
                    <div className={cn(
                      "p-6 flex items-center justify-between border-b",
                      readingMode === 'dark' ? "border-white/10" : "border-black/10"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)]/20 flex items-center justify-center text-[var(--theme-primary)]">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h2 className={cn("font-bold text-lg", readingMode === 'dark' ? "text-white" : "text-black")}>Sermon Notes</h2>
                          <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">Auto-Captured Verses</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowSermonNotesPanel(false)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          readingMode === 'dark' ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5"
                        )}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                      {/* 1. Captured Verses */}
                      <div>
                        {sermonNotes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 opacity-50">
                            <Mic size={48} className="text-[var(--theme-primary)] mb-2" />
                            <p className={cn("font-bold", readingMode === 'dark' ? "text-white" : "text-black")}>No verses detected yet</p>
                            <p className="text-sm px-4 text-gray-500">Turn on Live Sermon Mode and Lumina will automatically list any scriptures mentioned here.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {sermonNotes.map((note, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  handleSermonJump(note);
                                  setShowSermonNotesPanel(false);
                                }}
                                className={cn(
                                  "p-4 rounded-2xl cursor-pointer transition-all border group",
                                  readingMode === 'dark' ? "bg-white/5 border-white/10 hover:border-[var(--theme-primary)]" : "bg-black/5 border-black/5 hover:border-[var(--theme-primary)]"
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <h3 className={cn("font-bold text-lg", readingMode === 'dark' ? "text-white" : "text-black")}>
                                    {note.book} {note.chapter}{note.verse ? `:${note.verse}` : ''}
                                  </h3>
                                  <ArrowRight size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-[var(--theme-primary)]" />
                                </div>
                                {note.translation && (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] mt-2">
                                    {note.translation}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Sermon Content Engine */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                          <Sparkles size={16} className="text-[var(--theme-primary)]" />
                          <h3 className="font-bold text-sm tracking-widest uppercase text-gray-400">Content Engine</h3>
                        </div>

                        {isGeneratingSermonPack ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-4 border border-white/10 rounded-3xl bg-white/5">
                            <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-bold text-[var(--theme-primary)]">Distilling Message...</p>
                          </div>
                        ) : sermonContent ? (
                           <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                             {/* Summary Card */}
                             <div className="bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 rounded-2xl p-4">
                               <h4 className="font-bold text-[var(--theme-primary)] mb-2">Core Theme</h4>
                               <p className={cn("text-sm font-medium mb-4", readingMode === 'dark' ? 'text-white' : 'text-black')}>{sermonContent.summary.coreTheme}</p>
                               <ul className="text-xs space-y-2 text-gray-400">
                                 {sermonContent.summary.keyTakeaways.map((point, i) => (
                                   <li key={i} className="flex gap-2 items-start"><span className="text-[var(--theme-primary)] mt-0.5">•</span> <span>{point}</span></li>
                                 ))}
                               </ul>
                             </div>
                             
                             {/* Devotional Toggle */}
                             <details className={cn("border rounded-2xl overflow-hidden group", readingMode === 'dark' ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10")}>
                               <summary className="font-bold p-4 flex items-center justify-between cursor-pointer list-none select-none">
                                 <div className="flex items-center gap-2 text-sm">
                                   <BookOpen size={16} className="text-[var(--theme-primary)]"/> 7-Day Devotional
                                 </div>
                                 <ChevronRight size={16} className="transition-transform group-open:rotate-90 text-gray-400"/>
                               </summary>
                               <div className={cn("p-4 pt-0 space-y-6 border-t", readingMode === 'dark' ? "border-white/5" : "border-black/5")}>
                                 {sermonContent.devotional.map((day, i) => (
                                   <div key={i} className={cn("space-y-2 pb-4 border-b last:border-0 last:pb-0", readingMode === 'dark' ? "border-white/5" : "border-black/5")}>
                                     <h5 className="text-sm font-bold text-[var(--theme-primary)]">{day.day}: {day.theme}</h5>
                                     <p className={cn("text-xs font-bold", readingMode === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{day.scripture}</p>
                                     <p className="text-xs text-gray-400 leading-relaxed">{day.reflection}</p>
                                     <div className="bg-[var(--theme-primary)]/5 p-3 rounded-xl mt-2">
                                       <p className="text-xs italic text-[var(--theme-primary-400)] leading-relaxed"><span className="font-bold not-italic">Prayer:</span> {day.prayer}</p>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </details>
                     
                             {/* Social Media */}
                             <details className={cn("border rounded-2xl overflow-hidden group", readingMode === 'dark' ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10")}>
                               <summary className="font-bold p-4 flex items-center justify-between cursor-pointer list-none select-none">
                                 <div className="flex items-center gap-2 text-sm">
                                   <Share2 size={16} className="text-[var(--theme-primary)]"/> Social Media Pack
                                 </div>
                                 <ChevronRight size={16} className="transition-transform group-open:rotate-90 text-gray-400"/>
                               </summary>
                               <div className={cn("p-4 pt-0 space-y-4 border-t", readingMode === 'dark' ? "border-white/5" : "border-black/5")}>
                                 <div className="space-y-2">
                                   <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Shareable Quotes</span>
                                   {sermonContent.socialMedia.quotes.map((quote, i) => (
                                     <div key={i} className={cn("flex flex-col gap-2 p-3 rounded-xl", readingMode === 'dark' ? "bg-black/20" : "bg-white")}>
                                       <p className={cn("text-xs italic flex-1", readingMode === 'dark' ? 'text-gray-300' : 'text-gray-700')}>"{quote}"</p>
                                       <button onClick={() => navigator.clipboard.writeText(quote)} className="self-end flex items-center gap-1 text-[10px] text-gray-400 hover:text-[var(--theme-primary)] font-bold uppercase tracking-widest"><Copy size={12}/> Copy</button>
                                     </div>
                                   ))}
                                 </div>
                                 <div className="space-y-2 pt-2">
                                   <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Post Caption</span>
                                   <div className={cn("flex flex-col gap-2 p-3 rounded-xl", readingMode === 'dark' ? "bg-black/20" : "bg-white")}>
                                      <p className={cn("text-xs flex-1", readingMode === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{sermonContent.socialMedia.caption}</p>
                                      <button onClick={() => navigator.clipboard.writeText(sermonContent.socialMedia.caption)} className="self-end flex items-center gap-1 text-[10px] text-gray-400 hover:text-[var(--theme-primary)] font-bold uppercase tracking-widest"><Copy size={12}/> Copy</button>
                                   </div>
                                 </div>
                               </div>
                             </details>
                           </div>
                        ) : fullSermonTranscriptRef.current.length > 50 ? (
                          <button
                            onClick={handleGenerateSermonInsights}
                            className="w-full py-4 rounded-2xl font-bold border-2 border-[var(--theme-primary)]/30 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white hover:shadow-lg hover:shadow-[var(--theme-primary)]/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles size={18} /> Transform Sermon to Content
                          </button>
                        ) : (
                          <div className={cn("p-4 rounded-2xl text-center text-sm", readingMode === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-black/5 text-gray-500')}>
                            Listen to a longer sermon to unlock AI Content Generation.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={cn(
                      "p-6 border-t flex flex-col gap-3",
                      readingMode === 'dark' ? "border-white/10 bg-black/20" : "border-black/5 bg-gray-50"
                    )}>
                      {(sermonNotes.length > 0 || fullSermonTranscriptRef.current) && (
                        <button
                          onClick={() => {
                            setSermonNotes([]);
                            fullSermonTranscriptRef.current = '';
                            setSermonContent(null);
                          }}
                          className="w-full py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                        >
                          Clear Session
                        </button>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Weekly Growth Report Modal */}
            <AnimatePresence>
              {showWeeklyReflection && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <motion.div
                    className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
                    onClick={() => setShowWeeklyReflection(false)}
                  />
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-[32px] border border-amber-200/20 shadow-2xl flex flex-col bg-[#fdf8f0]"
                    id="weekly-reflection-print"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-amber-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-800">Weekly Growth Report</h2>
                          <p className="text-xs text-amber-700 font-medium uppercase tracking-widest">Your Spiritual Journal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isReflectionLoading && weeklyReflectionData && (
                          <button
                            onClick={() => window.print()}
                            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors flex items-center gap-2"
                          >
                            <FileText size={16} /> Print / Save PDF
                          </button>
                        )}
                        <button
                          onClick={() => setShowWeeklyReflection(false)}
                          className="p-2.5 rounded-full hover:bg-amber-100 transition-colors text-gray-400"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto">
                      {isReflectionLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-6">
                          <div className="w-16 h-16 rounded-full bg-amber-100 animate-pulse flex items-center justify-center">
                            <Sparkles size={28} className="text-amber-600" />
                          </div>
                          <p className="text-gray-500 font-serif italic text-xl">Your spiritual mentor is writing…</p>
                          <p className="text-gray-400 text-sm text-center max-w-xs">Gemini is reading your highlights, notes, and reflections to craft your Weekly Growth Report.</p>
                        </div>
                      ) : weeklyReflectionData ? (
                        <div className="p-8 md:p-12 space-y-10">
                          {/* Cover */}
                          <div className="text-center space-y-3 py-6 border-b border-amber-100">
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">Week of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <h1 className="text-3xl md:text-4xl font-serif text-gray-800 leading-tight">{weeklyReflectionData.title}</h1>
                            <span className="inline-block px-4 py-1.5 bg-amber-100 rounded-full text-amber-800 text-sm font-bold">
                              Theme: {weeklyReflectionData.theme}
                            </span>
                          </div>

                          {/* Narrative */}
                          <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">This Week's Journey</h3>
                            <div className="text-gray-700 font-serif text-lg leading-8 whitespace-pre-wrap">
                              {weeklyReflectionData.narrative}
                            </div>
                          </div>

                          {/* Key Verse */}
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Verse of the Week</p>
                            <blockquote className="text-gray-800 font-serif text-xl italic leading-8">
                              "{weeklyReflectionData.keyVerseText}"
                            </blockquote>
                            <p className="text-amber-700 font-bold text-sm">— {weeklyReflectionData.keyVerse}</p>
                          </div>

                          {/* Action Items */}
                          <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Growth Steps for Next Week</h3>
                            <ul className="space-y-3">
                              {weeklyReflectionData.actionItems.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                                  <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">{idx + 1}</div>
                                  <p className="text-gray-700 text-sm leading-relaxed">{item}</p>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Prayer */}
                          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">A Prayer for This Week</p>
                            <p className="text-gray-700 font-serif italic leading-8">{weeklyReflectionData.prayerPrompt}</p>
                          </div>

                          {/* Footer */}
                          <div className="text-center py-4 border-t border-amber-100">
                            <p className="text-xs text-gray-400 font-serif italic">Generated by Lumina Bible · Your personal spiritual companion</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                          <p className="text-gray-500 font-serif italic text-xl">Unable to generate report.</p>
                          <p className="text-gray-400 text-sm">Please check your API connection and try again.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Verse Archeology (Deep Dive) Modal */}
            <AnimatePresence>
              {showDeepDive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <motion.div
                    initial={{ black: 20 }}
                    animate={{ backdropFilter: "blur(20px)" }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                    onClick={() => setShowDeepDive(false)}
                  />

                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className={cn(
                      "relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[32px] border shadow-2xl flex flex-col",
                      readingMode === 'dark' ? "bg-[#1a1a1a] border-white/10" : "bg-white border-black/5"
                    )}
                  >
                    {/* Header */}
                    <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <Compass size={24} className={isDeepDiveLoading ? "animate-spin" : ""} />
                        </div>
                        <div>
                          <h2 className={cn("text-2xl font-serif italic", readingMode === 'dark' ? "text-white" : "text-black")}>Verse Archeology</h2>
                          <p className="text-sm text-gray-500">Uncovering original depth & context</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeepDive(false)}
                        className="p-3 rounded-full hover:bg-white/10 transition-colors text-gray-400"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
                      {isDeepDiveLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                          <Sparkles size={48} className="text-cyan-400 mb-6" />
                          <p className={cn(
                            "text-xl font-serif italic",
                            readingMode === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>Consulting the ancient scrolls...</p>
                        </div>
                      ) : deepDiveData ? (
                        <>
                          {/* Original Language Section */}
                          <section>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400 mb-6 flex items-center gap-2">
                              Linguistic Nuances
                              <div className="h-px flex-1 bg-cyan-400/20" />
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {deepDiveData.originalLanguage.map((word, idx) => (
                                <motion.div
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  key={idx}
                                  className={cn(
                                    "p-5 rounded-2xl border transition-all group",
                                    readingMode === 'dark' 
                                      ? "bg-white/5 border-white/5 hover:border-cyan-400/30" 
                                      : "bg-gray-50 border-black/5 hover:border-cyan-500/30"
                                  )}
                                >
                                  <div className="flex items-end justify-between mb-3">
                                    <span className={cn(
                                      "text-3xl font-serif transition-colors leading-none",
                                      readingMode === 'dark' ? "text-white group-hover:text-cyan-400" : "text-gray-900 group-hover:text-cyan-600"
                                    )}>
                                      {word.original}
                                    </span>
                                    <span className={cn(
                                      "text-xs font-mono uppercase tracking-widest",
                                      readingMode === 'dark' ? "text-cyan-400/60" : "text-cyan-600/60"
                                    )}>
                                      {word.pronunciation}
                                    </span>
                                  </div>
                                  <h4 className={cn(
                                    "font-black text-sm mb-1",
                                    readingMode === 'dark' ? "text-white/90" : "text-gray-800"
                                  )}>{word.transliteration} — {word.meaning}</h4>
                                  <p className={cn(
                                    "text-xs leading-relaxed italic",
                                    readingMode === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>"{word.nuance}"</p>
                                </motion.div>
                              ))}
                            </div>
                          </section>

                          {/* Historical Context Section */}
                          <section>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-6 flex items-center gap-2">
                              Historical Context
                              <div className="h-px flex-1 bg-orange-400/20" />
                            </h3>
                            <div className={cn(
                              "p-8 rounded-[32px] border italic text-xl font-serif leading-relaxed relative overflow-hidden",
                              readingMode === 'dark' ? "bg-orange-400/5 border-orange-400/10 text-gray-300" : "bg-orange-50 border-orange-500/10 text-gray-700"
                            )}>
                              <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-500">
                                <Search size={120} />
                              </div>
                              <span className="relative z-10">"{deepDiveData.historicalContext}"</span>
                            </div>
                          </section>

                          {/* Cross-Pollination Section */}
                          <section>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 flex items-center gap-2">
                              Cross-Pollination
                              <div className="h-px flex-1 bg-emerald-400/20" />
                            </h3>
                            <div className="space-y-4">
                              {deepDiveData.crossPollination.map((conn, idx) => (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.5 + (idx * 0.1) }}
                                  key={idx}
                                  onClick={() => {
                                    navigateToVerse(conn.reference);
                                    setShowDeepDive(false);
                                  }}
                                  className={cn(
                                    "flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer group",
                                    readingMode === 'dark' 
                                      ? "bg-white/5 border-white/5 hover:bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] hover:border-emerald-400/30" 
                                      : "bg-gray-50 border-black/5 hover:bg-emerald-50 hover:border-emerald-500/30"
                                  )}
                                >
                                  <div className={cn(
                                    "px-3 py-1.5 rounded-lg font-black text-xs whitespace-nowrap group-hover:scale-105 transition-transform",
                                    readingMode === 'dark' ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                  )}>
                                    {conn.reference}
                                  </div>
                                  <p className={cn(
                                    "text-sm leading-relaxed italic",
                                    readingMode === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    {conn.description}
                                  </p>
                                  <ArrowRight size={16} className={cn(
                                    "ml-auto transition-colors",
                                    readingMode === 'dark' ? "text-gray-600 group-hover:text-emerald-400" : "text-gray-400 group-hover:text-emerald-600"
                                  )} />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                          <HelpCircle size={48} className="text-gray-600" />
                          <p className="text-gray-400">Archeological data unavailable for this selection.</p>
                        </div>
                      )}
                    </div>
                  </motion.div >
                </motion.div >
              )
              }
            </AnimatePresence >
          </div >
        )}
      </AnimatePresence >
    </div >
  );
}
