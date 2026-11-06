"""Test faylidan (Word .docx, PDF, .txt) savollarni ajratib olish.

Qo‘llab-quvvatlanadigan yozilish usullari:
  * «1. Savol matni» / «1) …» / «Savol 1: …» yoki Word'ning avtomatik raqamlanishi
  * Variantlar alohida qatorda («A) …», «B. …», «(C) …») yoki bitta qatorda
    («A) 3  B) 4  C) 5  D) 6»), lotin yoki kirill harflari (А Б В Г)
  * To‘g‘ri javob: «Javob: B» qatori, variant oldida/oxirida * yoki + belgisi,
    Word'da qalin (bold) yoki marker bilan ajratilgan variant, yoki fayl
    oxiridagi «Javoblar: 1-B, 2-A, …» kaliti
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MIME = "application/pdf"
TXT_MIME = "text/plain"
MAX_QUESTIONS = 300


class ImportErrorUz(Exception):
    """Foydalanuvchiga ko‘rsatiladigan xato."""


@dataclass
class Line:
    text: str
    marked: bool = False      # Word'da qalin yoki marker bilan ajratilgan
    num: str | None = None    # Word avtomatik raqami: "q" (savol) yoki "A".."E"


@dataclass
class Question:
    no: int
    text: str = ""
    options: dict = field(default_factory=dict)   # "A" -> matn
    marked: set = field(default_factory=set)       # qalin/marker bilan belgilangan variantlar
    starred: set = field(default_factory=set)      # * yoki + bilan belgilangan variantlar
    answer: str | None = None                      # «Javob: B» qatoridan
    last: str | None = None                        # oxirgi to‘ldirilayotgan qism


def detect_mime(name: str, mime: str) -> str:
    n = (name or "").lower()
    if n.endswith(".docx"):
        return DOCX_MIME
    if n.endswith(".pdf"):
        return PDF_MIME
    if n.endswith(".txt"):
        return TXT_MIME
    if n.endswith(".doc"):
        raise ImportErrorUz("Eski .doc formati o‘qilmaydi. Faylni Word'da «Saqlash → .docx» qilib qayta yuklang.")
    if mime in (DOCX_MIME, PDF_MIME, TXT_MIME):
        return mime
    raise ImportErrorUz("Faqat Word (.docx), PDF yoki .txt fayl yuklang.")


# ------------------------------------------------------------------ extraction

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _flag(el, tag) -> bool:
    x = el.find(W + tag) if el is not None else None
    if x is None:
        return False
    val = (x.get(W + "val") or "").lower()
    return val not in ("0", "false", "none", "off")


def _numbering(z: zipfile.ZipFile) -> dict:
    """numId -> {ilvl: numFmt}"""
    try:
        root = ET.fromstring(z.read("word/numbering.xml"))
    except KeyError:
        return {}
    abstract = {}
    for an in root.findall(W + "abstractNum"):
        levels = {}
        for lvl in an.findall(W + "lvl"):
            fmt = lvl.find(W + "numFmt")
            levels[lvl.get(W + "ilvl")] = fmt.get(W + "val") if fmt is not None else ""
        abstract[an.get(W + "abstractNumId")] = levels
    result = {}
    for num in root.findall(W + "num"):
        ref = num.find(W + "abstractNumId")
        if ref is not None:
            result[num.get(W + "numId")] = abstract.get(ref.get(W + "val"), {})
    return result


def docx_lines(data: bytes) -> list[Line]:
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        root = ET.fromstring(z.read("word/document.xml"))
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        raise ImportErrorUz("Word faylini o‘qib bo‘lmadi. Fayl buzilgan yoki .docx emas.")
    numbering = _numbering(z)
    counters: dict = {}
    lines: list[Line] = []
    for p in root.iter(W + "p"):
        parts, total, marked_chars = [], 0, 0
        for node in p.iter():
            if node.tag == W + "r":
                rpr = node.find(W + "rPr")
                is_marked = _flag(rpr, "b") or (_flag(rpr, "highlight")) or (
                    rpr is not None and rpr.find(W + "shd") is not None
                    and (rpr.find(W + "shd").get(W + "fill") or "auto").lower() not in ("auto", "ffffff", ""))
                for t in node:
                    if t.tag == W + "t" and t.text:
                        parts.append(t.text)
                        n = len(t.text.strip())
                        total += n
                        if is_marked:
                            marked_chars += n
                    elif t.tag == W + "tab":
                        parts.append(" ")
                    elif t.tag in (W + "br", W + "cr"):
                        parts.append("\n")
        text = "".join(parts)
        if not text.strip():
            continue
        num = None
        ppr = p.find(W + "pPr")
        numpr = ppr.find(W + "numPr") if ppr is not None else None
        if numpr is not None:
            num_id = numpr.find(W + "numId")
            ilvl = numpr.find(W + "ilvl")
            nid = num_id.get(W + "val") if num_id is not None else None
            lvl = ilvl.get(W + "val") if ilvl is not None else "0"
            fmt = numbering.get(nid, {}).get(lvl, "")
            if fmt == "decimal" or fmt.startswith("decimal"):
                num = "q"
                for key in list(counters):
                    if key[0] == nid and key[1] != lvl:
                        counters.pop(key)
            elif fmt in ("upperLetter", "lowerLetter", "russianUpper", "russianLower"):
                key = (nid, lvl)
                counters[key] = counters.get(key, 0) + 1
                idx = counters[key]
                num = "ABCDE"[idx - 1] if idx <= 5 else None
        for i, chunk in enumerate(text.split("\n")):
            if chunk.strip():
                lines.append(Line(chunk, marked=total > 0 and marked_chars >= 0.6 * total,
                                  num=num if i == 0 else None))
        if num == "q":
            # yangi savol — variant hisoblagichlarini nolga qaytarish
            for key in [k for k in counters if k[1] != "0" or k[0] != nid]:
                counters.pop(key, None)
    return lines


def pdf_lines(data: bytes) -> list[Line]:
    try:
        from pypdf import PdfReader
    except ImportError:  # pragma: no cover
        raise ImportErrorUz("PDF o‘qish moduli o‘rnatilmagan.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise ImportErrorUz("PDF parol bilan himoyalangan. Himoyasiz faylni yuklang.")
        lines: list[Line] = []
        for page in reader.pages[:60]:
            chunks: list[tuple[str, bool]] = []

            def visit(text, cm, tm, font_dict, font_size):
                if not text:
                    return
                name = str((font_dict or {}).get("/BaseFont", "")).lower()
                chunks.append((text, any(k in name for k in ("bold", "black", "heavy", "semibold"))))

            try:
                page.extract_text(visitor_text=visit)
            except Exception:
                chunks = [(page.extract_text() or "", False)]
            buf, total, bold = [], 0, 0
            for text, is_bold in chunks + [("\n", False)]:
                pieces = text.split("\n")
                for j, piece in enumerate(pieces):
                    if j > 0:
                        line = "".join(buf)
                        if line.strip():
                            lines.append(Line(line, marked=total > 0 and bold >= 0.6 * total))
                        buf, total, bold = [], 0, 0
                    if piece:
                        buf.append(piece)
                        n = len(piece.strip())
                        total += n
                        if is_bold:
                            bold += n
    except ImportErrorUz:
        raise
    except Exception:
        raise ImportErrorUz("PDF faylini o‘qib bo‘lmadi.")
    if sum(len(ln.text.strip()) for ln in lines) < 10:
        raise ImportErrorUz("PDF ichida matn topilmadi (ehtimol rasm yoki skaner). Word yoki matnli PDF yuklang.")
    return lines


def txt_lines(data: bytes) -> list[Line]:
    for enc in ("utf-8-sig", "cp1251", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    return [Line(t) for t in text.splitlines() if t.strip()]


def extract_lines(data: bytes, mime: str) -> list[Line]:
    if mime == DOCX_MIME:
        return docx_lines(data)
    if mime == PDF_MIME:
        return pdf_lines(data)
    return txt_lines(data)


def plain_text(data: bytes, mime: str) -> list[str]:
    """O‘quvchilarga ko‘rsatish uchun faylning matni (paragraflar)."""
    return [ln.text.strip() for ln in extract_lines(data, mime)]


# ------------------------------------------------------------------ parsing

APOS = "['‘’`ʻʼ]"
LAT = "ABCDE"
CYR_ORDER = {"А": "A", "Б": "B", "В": "C", "Г": "D", "Д": "E"}
CYR_HOMO = {"А": "A", "В": "B", "С": "C"}
LETTER = "[A-Ea-eАБВГДабвгдСс]"

MARK_CHARS = "*+#✓✔√"
OPT_RE = re.compile(rf"^\s*(?P<mark>[{re.escape(MARK_CHARS)}]\s*)?\(?(?P<l>{LETTER})\s*[\)\.\:]\s*(?P<t>.*)$")
TRAIL_MARK_RE = re.compile(r"(\s*\(\s*\+\s*\)|\s*\(\s*to" + APOS + r"?g" + APOS + r"?ri\s*\)|\s+[\*✓✔√]+|\s+\+)\s*$", re.I)
Q_RE = re.compile(r"^\s*(?:savol|вопрос|question)?\s*(?P<n>\d{1,3})\s*(?:[\)\:]|\.(?!\d))\s*(?P<t>\S.*)$", re.I)
Q_WORD_RE = re.compile(r"^\s*(?:savol|вопрос|question)\s*(?P<n>\d{1,3})?\s*[\.\)\:\-–]?\s*(?P<t>\S.*)$", re.I)
ANSWER_RE = re.compile(
    rf"^\s*(?:to{APOS}?g{APOS}?ri\s+javob|javob|answer|правильный\s+ответ|ответ)\s*[:\-–=]?\s*\(?\s*(?P<l>{LETTER})\b",
    re.I)
KEY_HEADER_RE = re.compile(
    rf"^\s*(?:to{APOS}?g{APOS}?ri\s+javoblar|javoblar(?:\s+kaliti)?|kalit(?:lar)?|answers?(?:\s+key)?|ответы|ключ)\s*[:\-–]?\s*(?P<rest>.*)$",
    re.I)
PAIR_RE = re.compile(rf"(\d{{1,3}})\s*[\-–\.\):=]?\s*({LETTER})(?![A-Za-zА-Яа-яЁё])")
INLINE_RE = re.compile(r"(?:(?<=\s)|^)\(?(?:([A-EАБВГД])\s*(?:\)\s*|\.\s+)|([a-eабвгд])\s*\)\s*)")


class Parser:
    def __init__(self, lines: list[Line]):
        self.lines = lines
        self.questions: list[Question] = []
        self.key: dict[int, str] = {}
        self.cur: Question | None = None
        self.in_key = False
        letters = []
        for ln in lines:
            m = OPT_RE.match(ln.text)
            if m:
                letters.append(m.group("l").upper())
        self.cyr_order = any(x in ("Б", "Г") for x in letters)

    def letter(self, ch: str) -> str | None:
        up = ch.upper()
        if up in LAT:
            return up
        table = CYR_ORDER if self.cyr_order else CYR_HOMO
        return table.get(up)

    # -- helpers
    def new_question(self, text: str, no: int | None = None):
        n = no if no is not None else len(self.questions) + 1
        self.cur = Question(no=n, text=text.strip())
        self.cur.last = "q"
        self.questions.append(self.cur)

    def add_option(self, letter: str, text: str, mark: bool = False, marked_line: bool = False):
        q = self.cur
        if q is None:
            return
        text = text.strip()
        t2 = TRAIL_MARK_RE.sub("", text)
        if t2 != text:
            mark, text = True, t2.strip()
        if letter in q.options:  # takrorlangan harf — davomi deb hisoblaymiz
            q.options[letter] += " " + text
            return
        q.options[letter] = text
        q.last = letter
        if mark:
            q.starred.add(letter)
        if marked_line:
            q.marked.add(letter)

    def split_inline(self, text: str, start: str = "A", min_count: int = 2):
        """«… A) 3 B) 4 C) 5» -> (oldingi matn, [(harf, matn), …]) yoki None.
        Variantlar `start` harfidan boshlanib ketma-ket kelishi shart."""
        ms = list(INLINE_RE.finditer(text))
        if not ms:
            return None
        seq = [self.letter(m.group(1) or m.group(2)) for m in ms]
        if start not in seq:
            return None
        first = seq.index(start)
        ms, seq = ms[first:], seq[first:]
        base = LAT.index(start)
        good = 0
        for k, letter in enumerate(seq):
            if base + k < len(LAT) and letter == LAT[base + k]:
                good += 1
            else:
                break
        if good < min_count:
            return None
        ms = ms[:good]
        head = text[:ms[0].start()]
        opts = []
        for k, m in enumerate(ms):
            stop = ms[k + 1].start() if k + 1 < len(ms) else len(text)
            opts.append((LAT[base + k], text[m.end():stop]))
        return head, opts

    def key_pairs(self, text: str) -> list[tuple[int, str]]:
        out = []
        for n, l in PAIR_RE.findall(text):
            le = self.letter(l)
            if le:
                out.append((int(n), le))
        return out

    def is_key_line(self, text: str) -> bool:
        pairs = PAIR_RE.findall(text)
        if len(pairs) < 3:
            return False
        rest = PAIR_RE.sub("", text)
        return len(re.sub(r"[\s,;\.|/]", "", rest)) <= 4

    def option_a_ahead(self, i: int) -> bool:
        """Keyingi 1–3 qatorda A varianti bormi (raqamsiz savolni aniqlash uchun)."""
        for ln in self.lines[i + 1:i + 4]:
            t = ln.text.strip()
            if ln.num == "A":
                return True
            if ln.num == "q":
                return False
            m = OPT_RE.match(t)
            if m and self.letter(m.group("l")) == "A":
                return True
            if Q_RE.match(t):
                return False
        return False

    # -- main loop
    def run(self):
        for i, ln in enumerate(self.lines):
            text = ln.text.replace("\u00a0", " ").replace("\t", " ").strip()
            if not text:
                continue

            hm = KEY_HEADER_RE.match(text)
            if hm and (not hm.group("rest") or self.key_pairs(hm.group("rest")) or len(hm.group("rest")) < 3):
                self.in_key = True
                for n, l in self.key_pairs(hm.group("rest") or ""):
                    self.key[n] = l
                continue
            if self.in_key or self.is_key_line(text):
                pairs = self.key_pairs(text)
                if pairs:
                    self.in_key = True
                    for n, l in pairs:
                        self.key[n] = l
                    continue
                self.in_key = False

            am = ANSWER_RE.match(text)
            if am and self.cur is not None:
                le = self.letter(am.group("l"))
                if le:
                    self.cur.answer = le
                continue

            # Word avtomatik raqamlari
            if ln.num == "q":
                if self.option_a_ahead(i) or self.split_inline(text):
                    self.start_question_text(text, None)
                elif self.cur is not None and not self.cur.options:
                    self.cur.text = (self.cur.text + " " + text).strip()
                continue
            if ln.num and ln.num in LAT and self.cur is not None:
                mark = text[:1] in MARK_CHARS
                self.add_option(ln.num, text.lstrip(MARK_CHARS + " "), mark=mark, marked_line=ln.marked)
                continue

            om = OPT_RE.match(text)
            if om and self.cur is not None:
                le = self.letter(om.group("l"))
                n_opts = len(self.cur.options)
                expected = LAT[n_opts] if n_opts < 5 else None
                if le and (le == expected or (n_opts > 0 and le in LAT and le not in self.cur.options)):
                    inline = self.split_inline(text, start=le)
                    if inline and not inline[0].strip() and len(inline[1]) >= 2:
                        for l2, t2 in inline[1]:
                            self.add_option(l2, t2)
                        if om.group("mark"):
                            self.cur.starred.add(le)
                    else:
                        self.add_option(le, om.group("t"), mark=bool(om.group("mark")), marked_line=ln.marked)
                    continue

            qm = Q_RE.match(text)
            if not qm and re.match(r"^\s*(savol|вопрос|question)\b", text, re.I):
                qm = Q_WORD_RE.match(text)
            if qm:
                no = int(qm.group("n")) if qm.groupdict().get("n") else None
                self.start_question_text(qm.group("t"), no)
                continue

            # Raqamsiz savol: keyingi qatorlarda A varianti boshlansa yoki qatorning o‘zida variantlar bo‘lsa
            starts_new = self.cur is None or (len(self.cur.options) >= 2 and (
                self.option_a_ahead(i) or bool(self.split_inline(text))))
            if starts_new:
                if self.cur is None and not (self.option_a_ahead(i) or self.split_inline(text)):
                    continue  # sarlavha, ko‘rsatma va h.k.
                self.start_question_text(text, None)
                continue

            # Davomi (qatorga sig‘may o‘ralgan matn)
            if not self.cur.options:
                inline = self.split_inline(text)
                if inline:
                    self.cur.text = (self.cur.text + " " + inline[0]).strip()
                    for l2, t2 in inline[1]:
                        self.add_option(l2, t2)
                else:
                    self.cur.text = (self.cur.text + " " + text).strip()
            elif self.cur.last in self.cur.options:
                nxt = LAT[len(self.cur.options)] if len(self.cur.options) < 5 else None
                inline = self.split_inline(text, start=nxt, min_count=1) if nxt else None
                if inline:
                    self.cur.options[self.cur.last] += " " + inline[0]
                    for l2, t2 in inline[1]:
                        self.add_option(l2, t2)
                else:
                    self.cur.options[self.cur.last] += " " + text
        return self

    def start_question_text(self, text: str, no: int | None):
        inline = self.split_inline(text)
        if inline:
            self.new_question(inline[0], no)
            for l2, t2 in inline[1]:
                self.add_option(l2, t2)
        else:
            self.new_question(text, no)


def clean(s: str, limit: int) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s[:limit]


def parse(lines: list[Line]) -> dict:
    p = Parser(lines).run()
    out, warnings = [], []
    numbers_unique = len({q.no for q in p.questions}) == len(p.questions)
    for idx, q in enumerate(p.questions, 1):
        no = q.no if numbers_unique else idx
        opts = {k: clean(v, 500) for k, v in q.options.items() if clean(v, 500)}
        if not clean(q.text, 2000) or len(opts) < 2:
            if clean(q.text, 2000) and len(q.text) > 3:
                warnings.append(f"{no}-savol: variantlar topilmadi, o‘tkazib yuborildi")
            continue
        letters = [l for l in "ABCD" if l in opts]
        if letters != list("ABCD"[:len(letters)]):
            warnings.append(f"{no}-savol: variantlar ketma-ketligi buzilgan (A, B, C, D bo‘lishi kerak)")
            continue
        if "E" in opts:
            warnings.append(f"{no}-savol: E varianti bor — sayt 4 tagacha variantni qo‘llaydi, E olib tashlandi")
        correct, source = None, None
        if q.answer:
            correct, source = q.answer, "javob qatori"
        elif no in p.key:
            correct, source = p.key[no], "javoblar kaliti"
        elif len(q.starred) == 1:
            correct, source = next(iter(q.starred)), "belgi"
        elif len(q.marked) == 1 and len(q.marked) < len(opts):
            correct, source = next(iter(q.marked)), "qalin yozuv"
        if correct and correct not in letters:
            warnings.append(f"{no}-savol: to‘g‘ri javob «{correct}» variantlar orasida yo‘q")
            correct, source = None, None
        if not correct:
            warnings.append(f"{no}-savol: to‘g‘ri javob aniqlanmadi — ro‘yxatda tanlang")
        out.append({
            "no": no,
            "question_text": clean(q.text, 2000),
            "option_a": opts.get("A"), "option_b": opts.get("B"),
            "option_c": opts.get("C"), "option_d": opts.get("D"),
            "correct_option": correct, "source": source,
        })
        if len(out) >= MAX_QUESTIONS:
            warnings.append(f"Faqat dastlabki {MAX_QUESTIONS} ta savol olindi")
            break
    return {"questions": out, "warnings": warnings,
            "with_answers": sum(1 for q in out if q["correct_option"])}


def parse_file(data: bytes, name: str, mime: str) -> dict:
    kind = detect_mime(name, mime)
    lines = extract_lines(data, kind)
    result = parse(lines)
    result["mime"] = kind
    if not result["questions"]:
        raise ImportErrorUz("Fayldan savol topilmadi. Savollar «1. Savol…», variantlar «A) …» ko‘rinishida yozilganini tekshiring.")
    return result
