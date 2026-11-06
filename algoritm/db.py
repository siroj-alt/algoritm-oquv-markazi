"""Supabase PostgREST RPC mijoz.

Sayt bazaga faqat `public` sxemadagi RPC funksiyalar orqali murojaat qiladi
(qarang: supabase/schema.sql). Shu sababli serverda faqat publishable/anon
kalit kerak bo‘ladi.
"""
import asyncio
import os

try:  # Vercel'da `httpx`, lokal test muhitida `httpx2`
    import httpx
except ImportError:  # pragma: no cover
    import httpx2 as httpx  # type: ignore


def _env_pair():
    """URL va kalitni bitta manbadan oladi (aralashib ketmasligi uchun)."""
    url = (os.getenv("ALGORITM_SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.getenv("ALGORITM_SUPABASE_KEY") or "").strip()
    if url and key:
        return url, key
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or "").strip()
    return url, key


URL, KEY = _env_pair()


class DBError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


_client = None
_client_loop = None


def _get_client():
    """Har bir event loop uchun bitta ulanishlar havzasi."""
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    if _client is None or _client_loop is not loop or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5, keepalive_expiry=30.0),
        )
        _client_loop = loop
    return _client


_PG_MESSAGES = {
    "22P02": "Maydonlardan biri noto‘g‘ri formatda kiritilgan",
    "22007": "Sana noto‘g‘ri formatda kiritilgan",
    "22008": "Sana noto‘g‘ri kiritilgan",
    "22003": "Raqam juda katta",
    "23505": "Bunday yozuv allaqachon mavjud",
    "23503": "Bog‘liq ma’lumot topilmadi",
    "23514": "Kiritilgan qiymat talabga mos emas",
    "23502": "Majburiy maydon to‘ldirilmagan",
    "57014": "So‘rov juda uzoq davom etdi. Qayta urinib ko‘ring",
}


_CONSTRAINT_MESSAGES = {
    "online_tests_time_admin_check": "«Admin belgilaydi» rejimi uchun vaqtni (daqiqada) kiriting",
    "online_tests_time_limit_check": "Test vaqti 1 daqiqadan 600 daqiqagacha bo‘lishi kerak",
    "test_questions_correct_present": "To‘g‘ri javob sifatida bo‘sh variant tanlangan",
    "test_questions_options_order": "D variantdan oldin C variantni to‘ldiring",
    "courses_price_check": "Narx manfiy bo‘lishi mumkin emas",
    "courses_name_check": "Kurs nomini kiriting (2–120 belgi)",
    "students_phone_check": "Telefon raqami noto‘g‘ri",
    "payments_amount_check": "To‘lov summasi 0 dan katta bo‘lishi kerak",
}


def configured() -> bool:
    return bool(URL and KEY)


async def rpc(fn: str, params: dict | None = None):
    if not configured():
        raise DBError(503, "Ma’lumotlar bazasi ulanmagan. Administrator sozlamalarni tekshirishi kerak.")
    headers = {
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    last_exc = None
    response = None
    for attempt in range(3):
        try:
            response = await _get_client().post(f"{URL}/rest/v1/rpc/{fn}", json=params or {}, headers=headers)
            if response.status_code in (502, 503, 504) and attempt < 2:
                await asyncio.sleep(0.3 * (attempt + 1))
                continue
            break
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout, httpx.RemoteProtocolError) as exc:
            last_exc = exc
            await asyncio.sleep(0.3 * (attempt + 1))
        except httpx.ReadTimeout as exc:
            last_exc = exc
            break
    if response is None:
        print(f"[db] {fn}: ulanish xatosi: {type(last_exc).__name__}: {last_exc}")
        raise DBError(503, "Ma’lumotlar bazasiga ulanib bo‘lmadi. Bir necha daqiqadan keyin qayta urinib ko‘ring.")

    if response.status_code < 400:
        if not response.content:
            return None
        return response.json()

    try:
        body = response.json()
    except ValueError:
        body = {}
    code = str(body.get("code") or "")
    message = body.get("message") or ""
    status = response.status_code
    if code.startswith("PT") and code[2:].isdigit():
        # Funksiyalarimiz tomonidan atayin berilgan, foydalanuvchiga ko‘rsatiladigan xato
        return_status = int(code[2:])
        for constraint, friendly in _CONSTRAINT_MESSAGES.items():
            if f"({constraint})" in message:
                message = friendly
                break
        raise DBError(return_status if 400 <= return_status < 600 else 400, message)
    if code == "P0001" and message:
        raise DBError(400, message)
    if code in _PG_MESSAGES:
        raise DBError(400, _PG_MESSAGES[code])
    print(f"[db] {fn}: HTTP {status} code={code} message={message[:300]}")
    if code in ("PGRST202", "PGRST106", "42883"):
        raise DBError(503, "Ma’lumotlar bazasi sxemasi o‘rnatilmagan.")
    if status in (401, 403):
        raise DBError(503, "Ma’lumotlar bazasi kaliti noto‘g‘ri sozlangan.")
    raise DBError(500 if status >= 500 else 400, "Ma’lumotlar bazasida kutilmagan xatolik yuz berdi.")
