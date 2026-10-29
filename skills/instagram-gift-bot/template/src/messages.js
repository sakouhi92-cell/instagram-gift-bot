// All the bot's words. Each list = variants, one is picked at random.

// One entry per comment keyword. `words` are already-cleaned spellings (see text.js).
export const GIFTS = {
  // FILLED BY THE SKILL: one entry per keyword. Example:
  guide: {
    words: ['guide', 'gide', 'guid', 'gaid', 'gid', 'قايد', 'غايد'],
    name: 'الـ Guide المجاني 📘',
    url: 'https://example.com/your-gift',
  },
};

export const GIFT_SUBTITLE = 'يعطيك الصحة على الـ Follow 💛';

export const FOLLOW_BUTTON = 'تابعتك ✅';
export const OPEN_BUTTON = '👈 اضغط هنا';
export const FOLLOWED_PAYLOAD = 'FOLLOWED'; // sent as FOLLOWED:<gift id>

// Under the comment
export const COMMENT_REPLIES = [
  'بعثتلك ميساج 📩',
];

// Cards: [title, subtitle]. {gift} = gift name. Instagram allows 80 characters per line.
export const ASK_FOLLOW = [
  ['باش تاخو {gift}', 'اعمل Follow لـ @YOUR_ACCOUNT وبعد اضغط على الزر 👇'],
  ['{gift} حاضر ليك 🎁', 'اعمل Follow لـ @YOUR_ACCOUNT ومبعد اضغط على الزر 👇'],
];

export const STILL_NOT_FOLLOWING = [
  ['مازلت ما عملتش Follow 😐', 'اعمل Follow لـ @YOUR_ACCOUNT وبعد اضغط على الزر 👇'],
  ['ما لقيتكش في المتابعين 🤔', 'ثبّت الـ Follow لـ @YOUR_ACCOUNT وعاود اضغط على الزر 👇'],
];

export const GIFT = [
  ['{gift} هنا 🎁', GIFT_SUBTITLE],
  ['هاو {gift}', 'يعيشك على المتابعة 🔥'],
];

export const GIFT_AGAIN = [
  ['خذيتها قبل 😉', 'هاي مرة أخرى'],
  ['الهدية عندك من قبل 🙌', 'هاو الرابط من جديد'],
];

export const GIFT_RESEND = [
  ['سامحني 🙏 هاي من جديد', 'كان ما تحلّتش، جرّب من Chrome ولا Safari'],
];

// Meta did not answer the follow check: never say "not following" in that case.
export const CHECK_FAILED = [
  ['سامحني، صار مشكل صغير 🙏', 'عاود اضغط على الزر بعد دقيقة 👇'],
];

export const DATA_DELETED = 'تمسحت البيانات متاعك ✅';
