// Cleaning and matching of what people write.

import { GIFTS } from './messages.js';

// "I didn't get it" phrases (already cleaned, spaces removed).
export const NOT_RECEIVED = [
  'ماجاتنيش', 'ماجاتش', 'ماوصلنيش', 'ماوصلتنيش', 'ماوصلتش',
  'وينها', 'وينالهديه', 'وينالرابط', 'الرابطمايحلش', 'الرابطمايخدمش',
  'majatnich', 'majatch', 'mawsalnich', 'mawsaltnich', 'winha', 'winelhdiya',
  'pasrecu', 'japasrecu', 'rienrecu', 'lienmarchepas',
  'didntget', 'notreceived', 'linknotworking',
];

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // tashkeel + tatweel

// Lowercase, remove accents/tashkeel/emoji/punctuation, unify Arabic letters,
// collapse repeated letters ("claaaude" -> "claude"). Returns a list of words.
export function words(text) {
  let t = (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  t = t.replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
  t = t.replace(/[^\p{L}\p{N}]+/gu, ' ');     // emoji, punctuation, # @ . -> space
  t = t.replace(/(\p{L})\1+/gu, '$1');         // repeated letters
  return t.split(' ').filter(Boolean);
}

export function squash(text) {
  return words(text).join('');
}

// Levenshtein distance, with letter swaps ("cluade") counted as 1.
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Which gift does the comment ask for? Returns a gift id from GIFTS, or null.
// Checks the whole comment squashed, each word, and two words joined;
// words of 5+ letters also accept one small typo.
// learned = { word: giftId } from D1.
export function findGift(text, learned = {}) {
  const table = { ...learned };
  for (const [id, g] of Object.entries(GIFTS)) for (const w of g.words) table[w] = id;
  const w = words(text);
  const candidates = [w.join(''), ...w, ...w.slice(1).map((x, i) => w[i] + x)];
  for (const c of candidates) if (table[c]) return table[c];
  for (const c of candidates) {
    if (c.length < 5) continue;
    for (const [word, id] of Object.entries(table)) {
      if (word.length >= 5 && distance(c, word) <= 1) return id;
    }
  }
  return null;
}

export function isNotReceived(text) {
  const s = squash(text);
  return NOT_RECEIVED.some((p) => s.includes(p));
}

// The word to remember for learning: the whole comment, cleaned, if it is short.
export function learnableWord(text) {
  const s = squash(text);
  return s.length >= 2 && s.length <= 8 ? s : null;
}

// "Delete my data" request in a DM (needed for the privacy policy).
const DELETE_PHRASES = ['امسحبياناتي', 'فسخبياناتي', 'deletemydata', 'supprimermesdonnees'];
export function isDeleteRequest(text) {
  const s = squash(text);
  return DELETE_PHRASES.some((p) => s.includes(p));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
