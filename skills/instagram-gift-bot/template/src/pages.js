// Public pages: /gift, /privacy, /delete-data. Brand: black / gold / white, Cairo + Montserrat.


function layout(title, content) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Montserrat:wght@600;800&display=swap" rel="stylesheet">
<style>
  :root { --bg:#0b0b0b; --card:#151515; --gold:#d4af37; --text:#ffffff; --muted:#a3a3a3; --line:#2a2a2a; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--text);
         font-family:'Cairo', sans-serif; display:flex; align-items:center; justify-content:center; padding:24px 16px; }
  main { width:100%; max-width:560px; background:var(--card); border:1px solid var(--line);
         border-top:4px solid var(--gold); border-radius:20px; padding:36px 28px; }
  h1 { font-size:28px; font-weight:900; line-height:1.4; margin:0 0 12px; }
  h2 { font-size:19px; color:var(--gold); margin:28px 0 8px; }
  p, li { font-size:16px; line-height:1.9; color:#e5e5e5; }
  .sub { color:var(--muted); font-size:18px; margin-bottom:28px; }
  .btn { display:block; text-align:center; background:var(--gold); color:#0b0b0b; text-decoration:none;
         font-weight:900; font-size:19px; padding:16px; border-radius:14px; }
  .btn:active { transform:scale(.98); }
  .btn + .btn { margin-top:12px; }
  .btn.ghost { background:transparent; color:var(--gold); border:2px solid var(--gold); }
  footer { margin-top:32px; padding-top:18px; border-top:1px solid var(--line); text-align:center;
           font-family:'Montserrat', sans-serif; font-weight:600; }
  footer a { color:var(--gold); text-decoration:none; }
  code { background:#000; color:var(--gold); padding:2px 8px; border-radius:6px; }
</style>
</head>
<body><main>${content}
<footer><a href="https://www.instagram.com/YOUR_ACCOUNT/">@YOUR_ACCOUNT</a></footer>
</main></body></html>`;
}

// The gift itself goes by DM after the follow check; this page only explains how.
export function giftPage(env) {
  return layout('الهدايا', `
<h1>الهدايا متاع @${env.IG_USERNAME} 🎁</h1>
<p class="sub">اكتب الكلمة اللي في الريل في كومنتار تحت الريل، ويجيك الرابط في الـ DM 📩</p>
<a class="btn" href="https://www.instagram.com/${env.IG_USERNAME}/" target="_blank" rel="noopener">اعمل Follow 👤</a>`);
}

export function privacyPage(env) {
  return layout('Privacy Policy', `
<h1>سياسة الخصوصية</h1>
<p class="sub">Privacy Policy · @${env.IG_USERNAME}</p>

<h2>شكون إحنا</h2>
<p>هذا بوت خاص بحساب الإنستغرام @${env.IG_USERNAME}. يبعث هدية (رابط) للناس اللي يكتبو كلمة معيّنة في كومنتار تحت الريلز.</p>

<h2>شنوة البيانات اللي نسجلوها</h2>
<ul>
  <li>الـ ID متاع الحساب في الإنستغرام واسم الحساب (username)</li>
  <li>نص الكومنتار اللي كتبتو، ووقتو</li>
  <li>إذا كنت تتابع الحساب ولا لا (من Meta، وقت تضغط على الزر)</li>
  <li>إذا خذيت الهدية ووقتاش</li>
</ul>

<h2>علاش</h2>
<p>باش نبعثولك الهدية، ما نبعثوهاش مرتين، ونعاودو نبعثوها كان ما وصلتكش. ما نبيعو حتى معلومة، ما نشاركوها مع حد، وما نستعملوهاش للإشهار.</p>

<h2>وين تتخزن</h2>
<p>في قاعدة بيانات Cloudflare D1 الخاصة بالبوت. البيانات اللي ما تستحقش (الكومنتارات العادية) تتمسح وحدها بعد 24 ساعة، والسجلات التقنية بعد 90 يوم.</p>

<h2>كيفاش تمسح البيانات متاعك</h2>
<p>ابعث DM لـ @${env.IG_USERNAME} فيه <code>امسح بياناتي</code> ولا <code>delete my data</code>، والبوت يمسح كل شي وحدو. التفاصيل في <a href="/delete-data" style="color:var(--gold)">/delete-data</a>.</p>

<h2>English summary</h2>
<p>This bot stores your Instagram-scoped ID, username, the comment you wrote, whether you follow @${env.IG_USERNAME} (checked through Meta's API when you tap the button) and whether you received the gift. It is used only to deliver the gift. Nothing is sold or shared. To delete your data, send "delete my data" in a DM to @${env.IG_USERNAME}.</p>`);
}

export function deleteDataPage(env, code) {
  const status = code
    ? `<p class="sub">طلب المسح رقم <code>${String(code).replace(/[^a-z0-9-]/gi, '')}</code> تسجّل ✅</p>`
    : '';
  return layout('Delete my data', `
<h1>مسح البيانات</h1>
${status}
<p>باش تمسح كل البيانات اللي البوت سجلها عليك:</p>
<ul>
  <li>ابعث DM لـ <a href="https://www.instagram.com/${env.IG_USERNAME}/" style="color:var(--gold)">@${env.IG_USERNAME}</a></li>
  <li>اكتب: <code>امسح بياناتي</code> ولا <code>delete my data</code></li>
  <li>البوت يمسح كل شي وحدو، ويجاوبك "تمسحت البيانات متاعك ✅"</li>
</ul>
<h2>English</h2>
<p>Send a DM to @${env.IG_USERNAME} with the words "delete my data". The bot deletes everything it stored about you and confirms.</p>`);
}

export function setupResultPage(ok, detail, subscribed) {
  const sub = ok
    ? `<p>${subscribed ? '✅ الـ webhook متاع الـ Page تفعّل' : '⚠️ الـ webhook متاع الـ Page ما تفعّلش، قول لـ Claude'}</p>`
    : '';
  return layout('Setup', `
<h1>${ok ? '✅ البوت مربوط' : '❌ ما تربطش'}</h1>
<p class="sub">${detail}</p>
${sub}
<p>تنجم تسكّر الصفحة هاذي وترجع لـ Claude.</p>`);
}

export function notFound() {
  return layout('404', `<h1>الصفحة هاذي ما فماش</h1><a class="btn" href="/gift">الهدية 🎁</a>`);
}
