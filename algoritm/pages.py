"""Ommaviy sahifalarni serverda HTML ko‘rinishida tayyorlash."""
import base64
import datetime as dt
import hashlib
import html
import json
import re

from .assets import asset_url

DEFAULT_SETTINGS = {
    "center_name": "Algoritm o‘quv markazi",
    "hero_title": "Dasturlash, matematika va dizaynni amaliyotda o‘rganing",
    "hero_text": "Algoritm o‘quv markazida tajribali ustozlar bilan kichik guruhlarda o‘qing: har darsda yangi bilim va real loyihalar ustida amaliyot.",
    "about_title": "Algoritm haqida",
    "about_text": "Algoritm — zamonaviy kasblar va fanlarni amaliyot orqali o‘rgatadigan o‘quv markazi. Biz o‘quvchilarga mustahkam bilim, aniq reja va natijaga yetguncha qo‘llab-quvvatlashni taklif qilamiz.",
    "stat_students": "600+",
    "stat_teachers": "5",
    "stat_success": "96%",
    "phone": "",
    "email": "",
    "address": "",
    "working_hours": "Dushanba–Shanba, 09:00–19:00",
    "telegram": "",
    "instagram": "",
    "map_url": "",
}

FALLBACK_KEYS = {"center_name", "hero_title", "hero_text", "about_title", "about_text"}

THEME_SCRIPT = (
    "(function(){try{var t=localStorage.getItem('alg-theme');"
    "if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}"
    "document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}"
    "var d=document.documentElement;d.classList.add('js');"
    "setTimeout(function(){if(!window.__alg)d.classList.remove('js')},2500)})();"
)
THEME_SCRIPT_HASH = "sha256-" + base64.b64encode(hashlib.sha256(THEME_SCRIPT.encode()).digest()).decode()


def e(value) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def money(value) -> str:
    try:
        n = int(round(float(value or 0)))
    except (TypeError, ValueError):
        n = 0
    return f"{n:,}".replace(",", " ")


def paragraphs(text: str | None) -> str:
    parts = [p.strip() for p in re.split(r"\n\s*\n|\r\n\r\n", text or "") if p.strip()]
    return "".join("<p>" + e(p).replace("\n", "<br>") + "</p>" for p in parts)


def tel_href(phone: str) -> str:
    return "tel:" + re.sub(r"[^+0-9]", "", phone or "")


def telegram_href(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    if v.startswith("http"):
        return v
    return "https://t.me/" + v.lstrip("@")


def instagram_href(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    if v.startswith("http"):
        return v
    return "https://instagram.com/" + v.lstrip("@")


def safe_url(value: str) -> str:
    v = (value or "").strip()
    if v.startswith("/media/") or v.startswith("https://"):
        return v
    return ""


# ---------------------------------------------------------------- icons

_ICONS = {
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "moon": '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    "phone": '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    "send": '<path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z"/><path d="M10 13l4-4"/>',
    "camera": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
    "map": '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    "download": '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "list": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
}


def icon(name: str, cls: str = "ico") -> str:
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_ICONS[name]}</svg>')


_A_SHAPES = ('<polygon points="190,52 252,52 386,352 324,352"/>'
             '<polygon points="156,184 218,184 146,352 84,352"/>')


def a_mark(cls: str = "mark") -> str:
    """Logotipdagi «A» belgisi (tekis SVG)."""
    return f'<svg class="{cls}" viewBox="0 0 420 420" aria-hidden="true">{_A_SHAPES}</svg>'


def hero_scene(tags: list[str]) -> str:
    """Bosh sahifadagi 3D sahna: qatlamli (ekstruziya qilingan) «A», orbitalar va kurs teglari."""
    depth = 14
    layers = "".join(
        f'<svg class="a-layer{" a-front" if i == 0 else ""}" style="--i:{i}" viewBox="0 0 420 420" aria-hidden="true">{_A_SHAPES}</svg>'
        for i in range(depth - 1, -1, -1))
    tag_html = "".join(f'<span class="mark-tag t{i + 1}">{e(t)}</span>' for i, t in enumerate(tags[:4]))
    return f"""<div class="scene" data-scene aria-hidden="true">
  <div class="scene-rig">
    <div class="scene-float">
      <div class="scene-floor"></div>
      <div class="orbit orbit-a"><span class="ring"></span><span class="orb"></span></div>
      <div class="orbit orbit-b"><span class="ring"></span><span class="orb orb-sm"></span></div>
      <div class="a3d">{layers}</div>
      {tag_html}
    </div>
  </div>
</div>"""


# ---------------------------------------------------------------- layout

NAV = [
    ("/courses", "Kurslar", "courses"),
    ("/tests", "Onlayn testlar", "tests"),
    ("/payment", "To‘lov", "payment"),
    ("/#contact", "Aloqa", "contact"),
]


def layout(*, title: str, description: str, body: str, settings: dict, active: str = "",
           path: str = "/", base_url: str = "", notice: str = "", extra_head: str = "") -> str:
    s = settings
    name = s.get("center_name") or DEFAULT_SETTINGS["center_name"]
    full_title = f"{title} — {name}" if title else name
    nav = "".join(
        f'<a href="{href}" class="nav-link{" is-active" if key == active else ""}">{e(label)}</a>'
        for href, label, key in NAV)
    canonical = (base_url.rstrip("/") + path) if base_url else path
    notice_html = f'<div class="site-notice" role="status">{e(notice)}</div>' if notice else ""
    year = dt.date.today().year
    phone = s.get("phone") or ""
    contact_bits = []
    if phone:
        contact_bits.append(f'<a href="{e(tel_href(phone))}">{icon("phone")}{e(phone)}</a>')
    if s.get("telegram"):
        contact_bits.append(f'<a href="{e(telegram_href(s["telegram"]))}" rel="noopener" target="_blank">{icon("send")}Telegram</a>')
    if s.get("instagram"):
        contact_bits.append(f'<a href="{e(instagram_href(s["instagram"]))}" rel="noopener" target="_blank">{icon("camera")}Instagram</a>')
    return f"""<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{e(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{e((base_url.rstrip('/') if base_url else '') + '/static/logo.jpeg')}">
<meta property="og:locale" content="uz_UZ">
<meta name="theme-color" content="#E1251B">
<link rel="icon" href="/static/logo.jpeg" type="image/jpeg">
<link rel="apple-touch-icon" href="/static/logo.jpeg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap">
<link rel="stylesheet" href="{asset_url('app.css')}">
<script>{THEME_SCRIPT}</script>
{extra_head}
</head>
<body>
<a class="skip-link" href="#main">Asosiy qismga o‘tish</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="{e(name)} — bosh sahifa">
      <img src="/static/logo.jpeg" alt="" width="40" height="40">
      <span class="brand-text"><b>Algoritm</b><small>o‘quv markazi</small></span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Asosiy menyu">{nav}
      <a href="/register" class="btn btn-primary nav-cta">Kursga yozilish</a>
    </nav>
    <div class="header-tools">
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Yorug‘ yoki qorong‘i rejim">{icon("moon", "ico ico-moon")}{icon("sun", "ico ico-sun")}</button>
      <a href="/register" class="btn btn-primary header-cta">Kursga yozilish</a>
      <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-controls="main-nav" aria-expanded="false" aria-label="Menyuni ochish">{icon("menu", "ico ico-open")}{icon("close", "ico ico-close")}</button>
    </div>
  </div>
</header>
{notice_html}
<main id="main">
{body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/"><img src="/static/logo.jpeg" alt="" width="40" height="40"><span class="brand-text"><b>Algoritm</b><small>o‘quv markazi</small></span></a>
      <p>{e(s.get("address") or "")}</p>
    </div>
    <nav class="footer-links" aria-label="Sayt bo‘limlari">
      <a href="/courses">Kurslar</a><a href="/register">Kursga yozilish</a><a href="/tests">Onlayn testlar</a><a href="/payment">To‘lov</a>
    </nav>
    <div class="footer-contact">{''.join(contact_bits)}</div>
  </div>
  <div class="wrap footer-bottom">© {year} {e(name)}</div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<script src="{asset_url('site.js')}" defer></script>
</body>
</html>"""


# ---------------------------------------------------------------- pieces

def course_options(courses: list, selected=None) -> str:
    out = ['<option value="">Kursni tanlang</option>']
    for c in courses:
        sel = " selected" if selected is not None and str(c.get("id")) == str(selected) else ""
        out.append(f'<option value="{e(c.get("id"))}" data-price="{e(int(float(c.get("price") or 0)))}"{sel}>{e(c.get("name"))}</option>')
    return "".join(out)


def course_media(c: dict, cls: str = "course-media") -> str:
    img = safe_url(c.get("image_url"))
    if img:
        return f'<div class="{cls}"><img src="{e(img)}" alt="{e(c.get("name"))}" loading="lazy"></div>'
    letter = (c.get("name") or "A").strip()[:1].upper()
    return f'<div class="{cls} course-media-empty" aria-hidden="true"><span>{e(letter)}</span></div>'


def course_card(c: dict) -> str:
    meta = []
    if c.get("duration"):
        meta.append(f'<span>{icon("calendar")}{e(c["duration"])}</span>')
    if c.get("teacher_name"):
        meta.append(f'<span>{icon("user")}{e(c["teacher_name"])}</span>')
    desc = (c.get("description") or "").strip()
    first = desc.split("\n")[0][:170]
    price = float(c.get("price") or 0)
    price_html = f'<b>{money(price)}</b> so‘m' if price > 0 else 'Narxini menejerdan bilib oling'
    return f"""<article class="course-card" data-tilt>
  <a class="course-link" href="/courses/{e(c.get('id'))}">
    {course_media(c)}
    <div class="course-body">
      <h3>{e(c.get("name"))}</h3>
      {f'<p>{e(first)}</p>' if first else ''}
      {f'<div class="course-meta">{"".join(meta)}</div>' if meta else ''}
      <div class="course-price">{price_html}</div>
    </div>
  </a>
</article>"""


def registration_form(courses: list, selected=None, title: str = "Kursga yozilish", compact: bool = False) -> str:
    if not courses:
        return ('<div class="form-card"><h2>Kursga yozilish</h2><p class="muted">Hozircha qabul ochiq kurslar yo‘q. '
                'Yangi kurslar haqida bilish uchun biz bilan bog‘laning.</p></div>')
    return f"""<form class="form-card js-form" data-endpoint="/api/register" data-success="Arizangiz qabul qilindi. Menejerimiz tez orada qo‘ng‘iroq qiladi." novalidate>
  <h2>{e(title)}</h2>
  {'' if compact else '<p class="muted">Ma’lumotlaringizni qoldiring — menejerimiz qo‘ng‘iroq qilib, guruh va dars vaqtini kelishib oladi.</p>'}
  <label class="field"><span>Ism va familiya</span><input name="full_name" required minlength="3" maxlength="120" autocomplete="name" placeholder="Masalan, Aziza Karimova"></label>
  <label class="field"><span>Telefon raqami</span><input name="phone" type="tel" required inputmode="tel" autocomplete="tel" data-phone placeholder="+998 90 123 45 67"></label>
  <label class="field"><span>Kurs</span><select name="course_id" required>{course_options(courses, selected)}</select></label>
  <label class="field"><span>Izoh <em>(ixtiyoriy)</em></span><textarea name="note" rows="2" maxlength="1000" placeholder="Qulay vaqt yoki savollaringiz"></textarea></label>
  <button class="btn btn-primary btn-block" type="submit">Ariza yuborish</button>
  <p class="form-status" aria-live="polite"></p>
</form>"""


def contact_list(s: dict) -> str:
    items = []
    if s.get("phone"):
        items.append(f'<li>{icon("phone")}<div><small>Telefon</small><a href="{e(tel_href(s["phone"]))}">{e(s["phone"])}</a></div></li>')
    if s.get("address"):
        addr = e(s["address"])
        if safe_url(s.get("map_url")):
            addr += f' <a class="inline-link" href="{e(s["map_url"])}" target="_blank" rel="noopener">Xaritada ko‘rish</a>'
        items.append(f'<li>{icon("pin")}<div><small>Manzil</small><span>{addr}</span></div></li>')
    if s.get("working_hours"):
        items.append(f'<li>{icon("clock")}<div><small>Ish vaqti</small><span>{e(s["working_hours"])}</span></div></li>')
    if s.get("email"):
        items.append(f'<li>{icon("mail")}<div><small>Email</small><a href="mailto:{e(s["email"])}">{e(s["email"])}</a></div></li>')
    if s.get("telegram"):
        items.append(f'<li>{icon("send")}<div><small>Telegram</small><a href="{e(telegram_href(s["telegram"]))}" target="_blank" rel="noopener">{e(s["telegram"])}</a></div></li>')
    if s.get("instagram"):
        items.append(f'<li>{icon("camera")}<div><small>Instagram</small><a href="{e(instagram_href(s["instagram"]))}" target="_blank" rel="noopener">{e(s["instagram"])}</a></div></li>')
    if not items:
        return ""
    return '<ul class="contact-list">' + "".join(items) + "</ul>"


# ---------------------------------------------------------------- pages

def home(data: dict, **kw) -> str:
    s = data["settings"]
    courses = data["courses"]
    tests = data["tests"]
    facts = []
    if s.get("stat_students"):
        facts.append(f'<li><b>{e(s["stat_students"])}</b><span>o‘quvchi</span></li>')
    if courses:
        facts.append(f'<li><b>{len(courses)}</b><span>yo‘nalish</span></li>')
    if s.get("stat_teachers"):
        facts.append(f'<li><b>{e(s["stat_teachers"])}</b><span>ustoz</span></li>')
    if s.get("stat_success"):
        facts.append(f'<li><b>{e(s["stat_success"])}</b><span>bitiruvchilar natijasi</span></li>')
    tags = [c.get("name") or "" for c in courses[:4]]
    course_cards = "".join(course_card(c) for c in courses[:6])
    if not course_cards:
        course_cards = '<p class="empty">Kurslar tez orada e’lon qilinadi. Hozircha telefon orqali ma’lumot oling.</p>'
    more = (f'<a class="section-link" href="/courses">Barcha {len(courses)} ta kurs</a>' if len(courses) > 6 else "")
    tests_html = ""
    if tests:
        rows = "".join(
            f'<a class="test-row" href="/tests/{e(t["id"])}"><span class="test-title">{e(t["title"])}</span>'
            f'<span class="test-count">{test_label(t)}</span></a>' for t in tests[:4])
        tests_html = f"""<section class="section tests-band">
  <div class="wrap tests-grid">
    <div>
      <h2>Bilimingizni tekshirib ko‘ring</h2>
      <p class="muted">Onlayn testni ishlang va natijani darhol bilib oling. Ro‘yxatdan o‘tish shart emas.</p>
    </div>
    <div class="test-rows" data-reveal-group>{rows}</div>
  </div>
</section>"""
    body = f"""<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1>{e(s.get("hero_title"))}</h1>
      <p class="lead">{e(s.get("hero_text"))}</p>
      <div class="actions">
        <a class="btn btn-primary btn-lg" href="/register">Kursga yozilish</a>
        <a class="btn btn-ghost btn-lg" href="/courses">Kurslarni ko‘rish</a>
      </div>
      {f'<ul class="facts">{"".join(facts)}</ul>' if facts else ''}
    </div>
    <div class="hero-art">{hero_scene(tags)}</div>
  </div>
</section>

<section class="section" id="courses">
  <div class="wrap">
    <div class="section-head"><h2>Kurslar</h2>{more}</div>
    <div class="course-grid" data-reveal-group>{course_cards}</div>
  </div>
</section>

<section class="section steps-section">
  <div class="wrap">
    <h2>O‘qishni qanday boshlaysiz</h2>
    <ol class="steps" data-reveal-group>
      <li><b>Ariza qoldiring</b><p>Saytdagi formani to‘ldiring yoki bizga qo‘ng‘iroq qiling.</p></li>
      <li><b>Menejer bilan gaplashing</b><p>Darajangiz va qulay vaqtingizga qarab guruh tanlaymiz.</p></li>
      <li><b>Darslarni boshlang</b><p>Guruhga qo‘shiling, to‘lovni kartaga o‘tkazib chekni saytga yuklang.</p></li>
    </ol>
  </div>
</section>

{tests_html}

<section class="section" id="contact">
  <div class="wrap about-grid">
    <div class="about-copy">
      <h2>{e(s.get("about_title"))}</h2>
      {paragraphs(s.get("about_text"))}
      {contact_list(s)}
    </div>
    {registration_form(courses)}
  </div>
</section>"""
    return layout(title="", description=s.get("hero_text") or "", body=body, settings=s, active="", path="/", **kw)


def courses_page(data: dict, **kw) -> str:
    s = data["settings"]
    courses = data["courses"]
    cards = "".join(course_card(c) for c in courses) or '<p class="empty">Hozircha faol kurslar yo‘q.</p>'
    body = f"""<section class="page-head"><div class="wrap">
  <h1>Kurslar</h1>
  <p class="lead">O‘zingizga mos yo‘nalishni tanlang. Har bir kurs sahifasida dastur, ustoz va narx haqida ma’lumot bor.</p>
  {'<label class="search-field">' + icon("list") + '<input type="search" data-filter=".course-card" placeholder="Kurs yoki ustoz nomi bo‘yicha qidirish" aria-label="Kurslarni qidirish"></label>' if len(courses) > 4 else ''}
</div></section>
<section class="section section-tight"><div class="wrap"><div class="course-grid" data-reveal-group>{cards}</div>
<p class="empty filter-empty" hidden>Bu so‘rov bo‘yicha kurs topilmadi.</p></div></section>"""
    return layout(title="Kurslar", description="Algoritm o‘quv markazidagi barcha kurslar: narxlar, ustozlar va dars jadvali.",
                  body=body, settings=s, active="courses", path="/courses", **kw)


def course_page(data: dict, course: dict, **kw) -> str:
    s = data["settings"]
    price = float(course.get("price") or 0)
    facts = [("Narxi", (money(price) + " so‘m") if price > 0 else "Menejerdan bilib oling")]
    if course.get("duration"):
        facts.append(("Davomiyligi", course["duration"]))
    if course.get("schedule"):
        facts.append(("Dars vaqti", course["schedule"]))
    facts_html = "".join(f"<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>" for k, v in facts)
    teacher = ""
    if course.get("teacher_name") or course.get("teacher_bio"):
        photo = safe_url(course.get("teacher_image_url"))
        photo_html = (f'<img src="{e(photo)}" alt="{e(course.get("teacher_name"))}" loading="lazy">' if photo
                      else f'<span class="teacher-initial">{icon("user")}</span>')
        teacher = f"""<section class="teacher">
  {photo_html}
  <div><small>Ustoz</small><h3>{e(course.get("teacher_name") or "")}</h3>{paragraphs(course.get("teacher_bio"))}</div>
</section>"""
    desc = paragraphs(course.get("description")) or '<p class="muted">Kurs dasturi haqida batafsil ma’lumotni menejerimizdan olishingiz mumkin.</p>'
    body = f"""<section class="page-head page-head-course"><div class="wrap">
  <a class="back-link" href="/courses">{icon("back")}Barcha kurslar</a>
  <h1>{e(course.get("name"))}</h1>
</div></section>
<section class="section section-tight"><div class="wrap course-detail">
  <div class="course-main">
    {course_media(course, "course-hero-media") if safe_url(course.get("image_url")) else ""}
    <dl class="course-facts">{facts_html}</dl>
    <div class="prose">{desc}</div>
    {teacher}
  </div>
  <aside class="course-aside">{registration_form(data["courses"], course.get("id"), "Shu kursga yozilish", compact=True)}</aside>
</div></section>"""
    description = (course.get("description") or s.get("hero_text") or "")[:160]
    return layout(title=course.get("name") or "Kurs", description=description, body=body, settings=s,
                  active="courses", path=f"/courses/{course.get('id')}", **kw)


def register_page(data: dict, selected=None, **kw) -> str:
    s = data["settings"]
    body = f"""<section class="page-head"><div class="wrap"><h1>Kursga yozilish</h1></div></section>
<section class="section section-tight"><div class="wrap split">
  {registration_form(data["courses"], selected, "Ariza")}
  <div class="side-note">
    <h2>Ariza yuborgandan keyin</h2>
    <ol class="steps steps-vertical">
      <li><b>Qo‘ng‘iroq</b><p>Menejer siz bilan bog‘lanib, darajangiz va maqsadingizni aniqlaydi.</p></li>
      <li><b>Guruh</b><p>Qulay vaqtdagi guruhni tanlaysiz va birinchi dars sanasini kelishasiz.</p></li>
      <li><b>To‘lov</b><p>Kurs to‘lovini kartaga o‘tkazib, chekni <a class="inline-link" href="/payment">to‘lov sahifasida</a> yuborasiz.</p></li>
    </ol>
    {contact_list(s)}
  </div>
</div></section>"""
    return layout(title="Kursga yozilish", description="Algoritm o‘quv markazi kurslariga onlayn ariza qoldiring.",
                  body=body, settings=s, active="", path="/register", **kw)


def payment_page(data: dict, **kw) -> str:
    s = data["settings"]
    cards = []
    for n in (1, 2, 3):
        number = (s.get(f"card_number_{n}") or "").strip()
        if not number:
            continue
        holder = s.get(f"card_holder_{n}") or ""
        digits = re.sub(r"\D", "", number)
        brand = "Humo" if digits.startswith("9860") else "Uzcard" if digits.startswith("8600") or digits.startswith("5614") else "Karta"
        cards.append(f"""<div class="pay-card" data-tilt>
  <div class="pay-card-top"><span class="pay-chip" aria-hidden="true"></span><span class="pay-brand">{brand}</span></div>
  <span class="pay-number">{e(number)}</span>
  <div class="pay-card-bottom"><small>{e(holder)}</small>
  <button class="btn btn-sm pay-copy" type="button" data-copy="{e(digits)}">{icon("copy")}Nusxalash</button></div>
</div>""")
    cards_html = "".join(cards) or '<p class="muted">Karta raqami hali kiritilmagan. To‘lov rekvizitlarini menejerdan so‘rang.</p>'
    month = dt.date.today().strftime("%Y-%m")
    courses = data["courses"]
    body = f"""<section class="page-head"><div class="wrap">
  <h1>Kurs to‘lovi</h1>
  <p class="lead">To‘lovni quyidagi kartaga o‘tkazing va chekni yuboring. Administrator tushumni tekshirib tasdiqlaydi.</p>
</div></section>
<section class="section section-tight"><div class="wrap split">
  <div class="side-note">
    <h2>Qabul qiluvchi karta</h2>
    <div class="pay-cards">{cards_html}</div>
    <ol class="steps steps-vertical">
      <li><b>Pul o‘tkazing</b><p>Click, Payme yoki bank ilovasi orqali kurs summasini yuqoridagi kartaga o‘tkazing.</p></li>
      <li><b>Chekni saqlang</b><p>Ilovadagi chekning skrinshotini yoki PDF faylini oling.</p></li>
      <li><b>Chekni yuboring</b><p>Formani to‘ldirib chekni yuklang. Tasdiqlangach, menejer siz bilan bog‘lanadi.</p></li>
    </ol>
  </div>
  <form class="form-card js-form" data-endpoint="/api/payment-requests" data-file="receipt" data-success="Chek yuborildi. Administrator tekshirgach to‘lovingiz tasdiqlanadi." novalidate>
    <h2>Chekni yuborish</h2>
    <label class="field"><span>Ism va familiya</span><input name="full_name" required minlength="3" maxlength="120" autocomplete="name"></label>
    <label class="field"><span>Telefon raqami</span><input name="phone" type="tel" required inputmode="tel" autocomplete="tel" data-phone placeholder="+998 90 123 45 67"></label>
    <label class="field"><span>Kurs</span><select name="course_id" required data-price-target="amount">{course_options(courses)}</select></label>
    <div class="field-row">
      <label class="field"><span>Summa (so‘m)</span><input name="amount" type="number" required min="1000" step="1" inputmode="numeric"></label>
      <label class="field"><span>Qaysi oy uchun</span><input name="target_month" type="month" value="{month}" required></label>
    </div>
    <label class="field"><span>Karta oxirgi 4 raqami <em>(ixtiyoriy)</em></span><input name="payer_card_last4" inputmode="numeric" maxlength="4" pattern="[0-9]{{4}}" placeholder="1234"></label>
    <label class="field file-field"><span>To‘lov cheki</span>
      <input name="receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf">
      <span class="file-drop"><span class="btn btn-ghost btn-sm">{icon("upload")}Fayl tanlash</span><small data-file-label>Chek rasmi yoki PDF, 3 MB gacha</small></span>
    </label>
    <button class="btn btn-primary btn-block" type="submit">Chekni yuborish</button>
    <p class="form-status" aria-live="polite"></p>
  </form>
</div></section>"""
    return layout(title="Kurs to‘lovi", description="Algoritm o‘quv markazi kurs to‘lovini kartaga o‘tkazish va chekni yuborish.",
                  body=body, settings=s, active="payment", path="/payment", **kw)


def tests_page(data: dict, **kw) -> str:
    s = data["settings"]
    tests = data["tests"]
    if tests:
        rows = "".join(
            f'<a class="test-card" href="/tests/{e(t["id"])}"><h3>{e(t["title"])}</h3>'
            f'{"<p>" + e(t["description"]) + "</p>" if t.get("description") else ""}'
            f'<span class="test-count">{test_label(t)}</span></a>' for t in tests)
    else:
        rows = '<p class="empty">Hozircha faol testlar yo‘q. Tez orada yangi testlar qo‘shiladi.</p>'
    body = f"""<section class="page-head"><div class="wrap">
  <h1>Onlayn testlar</h1>
  <p class="lead">Testni tanlang, savollarga javob bering va natijangizni shu zahoti ko‘ring.</p>
</div></section>
<section class="section section-tight"><div class="wrap"><div class="test-grid" data-reveal-group>{rows}</div></div></section>"""
    return layout(title="Onlayn testlar", description="Algoritm o‘quv markazining bepul onlayn testlari.",
                  body=body, settings=s, active="tests", path="/tests", **kw)


def test_page(data: dict, test: dict, **kw) -> str:
    s = data["settings"]
    qs = test.get("questions") or []
    q_html = []
    for i, q in enumerate(qs, 1):
        opts = "".join(
            f'<label class="option"><input type="radio" name="q_{e(q["id"])}" value="{k.upper()}" required>'
            f'<span class="option-key">{k.upper()}</span><span>{e(q.get(k))}</span></label>'
            for k in ("a", "b", "c", "d") if (q.get(k) or "").strip())
        q_html.append(f'<fieldset class="question"><legend><span class="q-num">{i}</span>{e(q.get("text"))}</legend>{opts}</fieldset>')
    body = f"""<section class="page-head"><div class="wrap narrow">
  <a class="back-link" href="/tests">{icon("back")}Barcha testlar</a>
  <h1>{e(test.get("title"))}</h1>
  {f'<p class="lead">{e(test["description"])}</p>' if test.get("description") else ''}
  <p class="muted">{len(qs)} ta savol. Barcha savollarga javob bering.</p>
  {test_file_block(test)}
</div></section>
<section class="section section-tight"><div class="wrap narrow">
  <form class="js-test" data-test-id="{e(test.get('id'))}" novalidate>
    <div class="form-card test-person">
      <label class="field"><span>Ism va familiya</span><input name="full_name" required minlength="3" maxlength="120" autocomplete="name"></label>
      <label class="field"><span>Telefon raqami</span><input name="phone" type="tel" required inputmode="tel" autocomplete="tel" data-phone placeholder="+998 90 123 45 67"></label>
    </div>
    {''.join(q_html)}
    <div class="test-submit">
      <span class="test-progress" data-progress>0 / {len(qs)} javob berildi</span>
      <button class="btn btn-primary btn-lg" type="submit">Testni yakunlash</button>
    </div>
    <p class="form-status" aria-live="polite"></p>
  </form>
  <div class="test-result" hidden></div>
</div></section>"""
    return layout(title=test.get("title") or "Test", description=(test.get("description") or "Onlayn test")[:160],
                  body=body, settings=s, active="tests", path=f"/tests/{test.get('id')}", **kw)


def test_label(t: dict) -> str:
    if t.get("file_only"):
        return f"{file_kind(t.get('file_mime'))} fayl"
    label = f"{e(t.get('questions'))} ta savol"
    return label + (", fayl bilan" if t.get("file_mime") else "")


def file_kind(mime: str) -> str:
    return {"application/pdf": "PDF", "text/plain": "Matn"}.get(mime or "", "Word")


def test_file_block(test: dict) -> str:
    f = test.get("file")
    if not f:
        return ""
    name = e(f.get("name") or "Test fayli")
    if f.get("visibility") == "always":
        return (f'<a class="file-chip" href="/tests/{e(test.get("id"))}/file">{icon("file")}'
                f'<span><b>{name}</b><small>{file_kind(f.get("mime"))} faylini ko‘rish</small></span></a>')
    return (f'<div class="file-chip is-locked">{icon("lock")}<span><b>{name}</b>'
            f'<small>Test fayli testni yakunlaganingizdan keyin ochiladi</small></span></div>')


def test_file_page(data: dict, tid, item: dict, paragraphs: list, query: str, test: dict | None = None, **kw) -> str:
    """Test faylini o‘qish sahifasi. `test` berilsa — faqat fayldan iborat testning o‘z sahifasi."""
    s = data["settings"]
    name = item.get("name") or "Test fayli"
    is_pdf = item.get("mime") == "application/pdf"
    body_text = "".join(f"<p>{e(p)}</p>" for p in paragraphs[:3000]) or \
        '<p class="muted">Fayl matnini ko‘rsatib bo‘lmadi. Faylni yuklab olib oching.</p>'
    base = f"/tests/{e(tid)}/file{query}"
    pdf_btn = (f'<a class="btn btn-primary" href="{base}raw=1" target="_blank" rel="noopener">'
               f'{icon("file")}PDF ko‘rinishida ochish</a>') if is_pdf else ""
    actions = f"""<div class="actions">{pdf_btn}
    <a class="btn btn-ghost" href="{base}raw=1&amp;download=1">{icon("download")}Faylni yuklab olish</a>
  </div>"""
    if test:
        head = f"""<a class="back-link" href="/tests">{icon("back")}Barcha testlar</a>
  <h1>{e(test.get("title"))}</h1>
  {f'<p class="lead">{e(test["description"])}</p>' if test.get("description") else ''}
  <p class="file-meta">{icon("file")}<span>{e(name)}</span></p>
  {actions}"""
        title, desc, path = test.get("title") or name, (test.get("description") or name)[:160], f"/tests/{tid}"
    else:
        head = f"""<a class="back-link" href="/tests/{e(tid)}">{icon("back")}{e(item.get("title") or "Testga qaytish")}</a>
  <h1 class="file-title">{e(name)}</h1>
  {actions}"""
        title, desc, path = name, f"{name} — test fayli", f"/tests/{tid}/file"
    body = f"""<section class="page-head"><div class="wrap narrow">
  {head}
</div></section>
<section class="section section-tight"><div class="wrap narrow"><article class="doc-view">{body_text}</article></div></section>"""
    return layout(title=title, description=desc, body=body, settings=s, active="tests", path=path, **kw)


def test_file_locked(data: dict, tid, message: str, **kw) -> str:
    body = f"""<section class="page-head page-404"><div class="wrap narrow">
  <h1>Fayl hozircha yopiq</h1>
  <p class="lead">{e(message)}. Testni ishlab bo‘lgach, natija sahifasida fayl havolasi paydo bo‘ladi.</p>
  <div class="actions"><a class="btn btn-primary" href="/tests/{e(tid)}">Testni boshlash</a></div>
</div></section>"""
    return layout(title="Fayl yopiq", description="Test fayli", body=body, settings=data["settings"], active="tests", **kw)


def not_found(data: dict, **kw) -> str:
    body = """<section class="page-head page-404"><div class="wrap narrow">
  <h1>Sahifa topilmadi</h1>
  <p class="lead">Bu manzilda sahifa yo‘q yoki u o‘chirilgan. Bosh sahifadan kerakli bo‘limni tanlang.</p>
  <div class="actions"><a class="btn btn-primary" href="/">Bosh sahifa</a><a class="btn btn-ghost" href="/courses">Kurslar</a></div>
</div></section>"""
    return layout(title="Sahifa topilmadi", description="Sahifa topilmadi", body=body, settings=data["settings"], **kw)


def json_script(obj) -> str:
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")
