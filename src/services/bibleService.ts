interface Verse {
    book_id: string;
    book_name: string;
    chapter: number;
    verse: number;
    text: string;
}

const API_KEY = (import.meta as any).env?.VITE_API_BIBLE_KEY || 'I8LpaQ_H2CEc1BTNLIXj8';
const BASE_URL = 'https://rest.api.bible/v1/bibles';

// Map our translation IDs to API.Bible IDs
export const TRANSLATION_MAP: Record<string, string> = {
    'web': '9879dbb7cfe39e4d-04', // World English Bible
    'webbe': '72f9a686022e461f-01', // WEB British Edition
    'asv': '06125adad2d5898a-01', // American Standard Version
    'kjv': 'de4e12af7f28f599-02', // King James Version
    'fbv': '65eec8e0b60e656b-01', // Free Bible Version
    'lsv': '01b29f4b342acc35-01', // Literal Standard Version
};

export async function fetchChapterVerses(
    bookApiId: string,
    chapter: number,
    translationId: string,
    bookName: string
): Promise<Verse[]> {
    const actualTranslationId = TRANSLATION_MAP[translationId] || TRANSLATION_MAP['kjv'];
    // API.Bible chapter format: BIBLEID/chapters/BOOKID.CHAPTERID
    const chapterId = `${bookApiId}.${chapter}`;
    const url = `${BASE_URL}/${actualTranslationId}/chapters/${chapterId}?include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`;

    try {
        const response = await fetch(url, {
            headers: {
                'api-key': API_KEY,
                'accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Chapter not found in this translation.');
            }
            throw new Error(`Bible API Error: ${response.status}`);
        }

        const data = await response.json();

        // API.Bible provides verses in an array when content-type=json is requested
        // Each object has { id, orgId, bibleId, bookId, chapterId, reference, text }

        if (data.data && data.data.content) {
            if (typeof data.data.content === 'string') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.data.content, 'text/html');

                const finalVerses: Verse[] = [];
                let currentVerseNum = 1;
                let currentVerseText = '';

                // Recursive function to walk the DOM and extract text, separating by verse tags
                const walkDOM = (node: Node) => {
                    if (node.nodeType === 1) { // Element node
                        const el = node as HTMLElement;
                        if (el.classList.contains('v')) {
                            // We hit a new verse number
                            if (currentVerseText.trim()) {
                                // Save the previous verse
                                finalVerses.push({
                                    book_id: bookApiId,
                                    book_name: bookName,
                                    chapter: chapter,
                                    verse: currentVerseNum,
                                    text: currentVerseText.trim().replace(/\s+/g, ' ')
                                });
                            }
                            // Update current verse number and reset text
                            currentVerseNum = parseInt(el.getAttribute('data-number') || el.textContent || '1', 10);
                            currentVerseText = '';
                            return; // Do not extract text content from inside the verse number span itself
                        }
                    } else if (node.nodeType === 3) { // Text node
                        currentVerseText += node.textContent || '';
                    }

                    // Traverse children
                    node.childNodes.forEach(child => walkDOM(child));
                };

                doc.body.childNodes.forEach(child => walkDOM(child));

                // Don't forget the last verse in the chapter
                if (currentVerseText.trim()) {
                    finalVerses.push({
                        book_id: bookApiId,
                        book_name: bookName,
                        chapter: chapter,
                        verse: currentVerseNum,
                        text: currentVerseText.trim().replace(/\s+/g, ' ')
                    });
                }

                // API.Bible sometimes repeats verse tags for formatting, consolidate them if they share numbers
                const consolidated: Verse[] = [];
                finalVerses.forEach(v => {
                    const existing = consolidated.find(c => c.verse === v.verse);
                    if (existing) {
                        existing.text += ' ' + v.text;
                    } else {
                        consolidated.push(v);
                    }
                });

                return consolidated.length > 0 ? consolidated : [{
                    book_id: bookApiId,
                    book_name: bookName,
                    chapter: chapter,
                    verse: 1,
                    text: doc.body.textContent || 'Could not parse verses.'
                }];
            }
        }

        return [];
    } catch (error) {
        console.error('Failed to fetch from API.Bible:', error);
        throw error;
    }
}
