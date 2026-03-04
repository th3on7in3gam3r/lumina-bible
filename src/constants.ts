export interface BibleBook {
  name: string;
  chapters: number;
  category: string;
  testament: 'OT' | 'NT';
  apiId: string;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament
  { name: "Genesis", chapters: 50, category: "Torah", testament: 'OT', apiId: 'GEN' },
  { name: "Exodus", chapters: 40, category: "Torah", testament: 'OT', apiId: 'EXO' },
  { name: "Leviticus", chapters: 27, category: "Torah", testament: 'OT', apiId: 'LEV' },
  { name: "Numbers", chapters: 36, category: "Torah", testament: 'OT', apiId: 'NUM' },
  { name: "Deuteronomy", chapters: 34, category: "Torah", testament: 'OT', apiId: 'DEU' },
  { name: "Joshua", chapters: 24, category: "History", testament: 'OT', apiId: 'JOS' },
  { name: "Judges", chapters: 21, category: "History", testament: 'OT', apiId: 'JDG' },
  { name: "Ruth", chapters: 4, category: "History", testament: 'OT', apiId: 'RUT' },
  { name: "1 Samuel", chapters: 31, category: "History", testament: 'OT', apiId: '1SA' },
  { name: "2 Samuel", chapters: 24, category: "History", testament: 'OT', apiId: '2SA' },
  { name: "1 Kings", chapters: 22, category: "History", testament: 'OT', apiId: '1KI' },
  { name: "2 Kings", chapters: 25, category: "History", testament: 'OT', apiId: '2KI' },
  { name: "1 Chronicles", chapters: 29, category: "History", testament: 'OT', apiId: '1CH' },
  { name: "2 Chronicles", chapters: 36, category: "History", testament: 'OT', apiId: '2CH' },
  { name: "Ezra", chapters: 10, category: "History", testament: 'OT', apiId: 'EZR' },
  { name: "Nehemiah", chapters: 13, category: "History", testament: 'OT', apiId: 'NEH' },
  { name: "Esther", chapters: 10, category: "History", testament: 'OT', apiId: 'EST' },
  { name: "Job", chapters: 42, category: "Poetry", testament: 'OT', apiId: 'JOB' },
  { name: "Psalms", chapters: 150, category: "Poetry", testament: 'OT', apiId: 'PSA' },
  { name: "Proverbs", chapters: 31, category: "Poetry", testament: 'OT', apiId: 'PRO' },
  { name: "Ecclesiastes", chapters: 12, category: "Poetry", testament: 'OT', apiId: 'ECC' },
  { name: "Song of Solomon", chapters: 8, category: "Poetry", testament: 'OT', apiId: 'SNG' },
  { name: "Isaiah", chapters: 66, category: "Prophets", testament: 'OT', apiId: 'ISA' },
  { name: "Jeremiah", chapters: 52, category: "Prophets", testament: 'OT', apiId: 'JER' },
  { name: "Lamentations", chapters: 5, category: "Prophets", testament: 'OT', apiId: 'LAM' },
  { name: "Ezekiel", chapters: 48, category: "Prophets", testament: 'OT', apiId: 'EZK' },
  { name: "Daniel", chapters: 12, category: "Prophets", testament: 'OT', apiId: 'DAN' },
  { name: "Hosea", chapters: 14, category: "Prophets", testament: 'OT', apiId: 'HOS' },
  { name: "Joel", chapters: 3, category: "Prophets", testament: 'OT', apiId: 'JOL' },
  { name: "Amos", chapters: 9, category: "Prophets", testament: 'OT', apiId: 'AMO' },
  { name: "Obadiah", chapters: 1, category: "Prophets", testament: 'OT', apiId: 'OBA' },
  { name: "Jonah", chapters: 4, category: "Prophets", testament: 'OT', apiId: 'JON' },
  { name: "Micah", chapters: 7, category: "Prophets", testament: 'OT', apiId: 'MIC' },
  { name: "Nahum", chapters: 3, category: "Prophets", testament: 'OT', apiId: 'NAM' },
  { name: "Habakkuk", chapters: 3, category: "Prophets", testament: 'OT', apiId: 'HAB' },
  { name: "Zephaniah", chapters: 3, category: "Prophets", testament: 'OT', apiId: 'ZEP' },
  { name: "Haggai", chapters: 2, category: "Prophets", testament: 'OT', apiId: 'HAG' },
  { name: "Zechariah", chapters: 14, category: "Prophets", testament: 'OT', apiId: 'ZEC' },
  { name: "Malachi", chapters: 4, category: "Prophets", testament: 'OT', apiId: 'MAL' },

  // New Testament
  { name: "Matthew", chapters: 28, category: "Gospels", testament: 'NT', apiId: 'MAT' },
  { name: "Mark", chapters: 16, category: "Gospels", testament: 'NT', apiId: 'MRK' },
  { name: "Luke", chapters: 24, category: "Gospels", testament: 'NT', apiId: 'LUK' },
  { name: "John", chapters: 21, category: "Gospels", testament: 'NT', apiId: 'JHN' },
  { name: "Acts", chapters: 28, category: "History", testament: 'NT', apiId: 'ACT' },
  { name: "Romans", chapters: 16, category: "Pauline Epistles", testament: 'NT', apiId: 'ROM' },
  { name: "1 Corinthians", chapters: 16, category: "Pauline Epistles", testament: 'NT', apiId: '1CO' },
  { name: "2 Corinthians", chapters: 13, category: "Pauline Epistles", testament: 'NT', apiId: '2CO' },
  { name: "Galatians", chapters: 6, category: "Pauline Epistles", testament: 'NT', apiId: 'GAL' },
  { name: "Ephesians", chapters: 6, category: "Pauline Epistles", testament: 'NT', apiId: 'EPH' },
  { name: "Philippians", chapters: 4, category: "Pauline Epistles", testament: 'NT', apiId: 'PHP' },
  { name: "Colossians", chapters: 4, category: "Pauline Epistles", testament: 'NT', apiId: 'COL' },
  { name: "1 Thessalonians", chapters: 5, category: "Pauline Epistles", testament: 'NT', apiId: '1TH' },
  { name: "2 Thessalonians", chapters: 3, category: "Pauline Epistles", testament: 'NT', apiId: '2TH' },
  { name: "1 Timothy", chapters: 6, category: "Pauline Epistles", testament: 'NT', apiId: '1TI' },
  { name: "2 Timothy", chapters: 4, category: "Pauline Epistles", testament: 'NT', apiId: '2TI' },
  { name: "Titus", chapters: 3, category: "Pauline Epistles", testament: 'NT', apiId: 'TIT' },
  { name: "Philemon", chapters: 1, category: "Pauline Epistles", testament: 'NT', apiId: 'PHM' },
  { name: "Hebrews", chapters: 13, category: "General Epistles", testament: 'NT', apiId: 'HEB' },
  { name: "James", chapters: 5, category: "General Epistles", testament: 'NT', apiId: 'JAS' },
  { name: "1 Peter", chapters: 5, category: "General Epistles", testament: 'NT', apiId: '1PE' },
  { name: "2 Peter", chapters: 3, category: "General Epistles", testament: 'NT', apiId: '2PE' },
  { name: "1 John", chapters: 5, category: "General Epistles", testament: 'NT', apiId: '1JN' },
  { name: "2 John", chapters: 1, category: "General Epistles", testament: 'NT', apiId: '2JN' },
  { name: "3 John", chapters: 1, category: "General Epistles", testament: 'NT', apiId: '3JN' },
  { name: "Jude", chapters: 1, category: "General Epistles", testament: 'NT', apiId: 'JUD' },
  { name: "Revelation", chapters: 22, category: "Prophecy", testament: 'NT', apiId: 'REV' },
];

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  books: string[]; // Books included in the plan
}

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'gospels-30',
    title: 'The Gospels in 30 Days',
    description: 'A deep dive into the life and teachings of Jesus through Matthew, Mark, Luke, and John.',
    durationDays: 30,
    books: ['Matthew', 'Mark', 'Luke', 'John']
  },
  {
    id: 'wisdom-15',
    title: 'Wisdom Literature',
    description: 'Explore the practical wisdom of Proverbs and the poetic beauty of Ecclesiastes.',
    durationDays: 15,
    books: ['Proverbs', 'Ecclesiastes']
  },
  {
    id: 'nt-90',
    title: 'New Testament in 90 Days',
    description: 'Read through the entire New Testament in three months.',
    durationDays: 90,
    books: BIBLE_BOOKS.filter(b => b.testament === 'NT').map(b => b.name)
  },
  {
    id: 'bible-365',
    title: 'The Whole Bible in a Year',
    description: 'A comprehensive journey from Genesis to Revelation.',
    durationDays: 365,
    books: BIBLE_BOOKS.map(b => b.name)
  }
];

export const DAILY_VERSES = [
  { reference: "John 3:16", text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { reference: "Psalm 23:1", text: "The Lord is my shepherd; I shall not want." },
  { reference: "Romans 8:28", text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { reference: "Jeremiah 29:11", text: "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end." },
  { reference: "Matthew 6:33", text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." },
  { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths." },
  { reference: "Isaiah 40:31", text: "But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { reference: "Joshua 1:9", text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest." },
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." }
];
