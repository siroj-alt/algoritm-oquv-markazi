"""Algoritm o‘quv markazi — veb-ilova (Starlette, Vercel Python runtime)."""
import base64
import re
import time

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from starlette.routing import Route

from urllib.parse import quote

from . import db, pages, test_import
from .assets import load as load_asset

ADMIN_COOKIE = "alg_admin"
MAX_BODY = 4_400_000  # Vercel funksiyalari 4.5 MB dan katta so‘rovni qabul qilmaydi
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
ENTITIES = {"courses", "groups", "students", "payments", "payment_requests", "attendance",
            "tests", "questions", "test_results", "admins", "settings"}

CSP = "; ".join([
    "default-src 'self'",
    f"script-src 'self' '{pages.THEME_SCRIPT_HASH}'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
])
SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"x-frame-options", b"DENY"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"content-security-policy", CSP.encode()),
]
PUBLIC_CACHE = "public, max-age=0, s-maxage=30, stale-while-revalidate=300"


class SecurityHeaders:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                existing = {k.lower() for k, _ in headers}
                headers.extend(h for h in SECURITY_HEADERS if h[0] not in existing)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# ---------------------------------------------------------------- helpers

def err(status: int, message: str) -> JSONResponse:
    return JSONResponse({"detail": message}, status_code=status, headers={"Cache-Control": "no-store"})


def ok(data=None) -> JSONResponse:
    return JSONResponse(data if data is not None else {"ok": True}, headers={"Cache-Control": "no-store"})


def base_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    return f"https://{host}" if host else ""


async def read_json(request: Request) -> dict:
    if request.headers.get("x-requested-with") != "fetch":
        raise db.DBError(403, "So‘rov rad etildi")
    try:
        size = int(request.headers.get("content-length") or 0)
    except ValueError:
        size = 0
    if size > MAX_BODY:
        raise db.DBError(413, "Yuborilgan fayl juda katta. 3 MB dan kichik fayl tanlang")
    try:
        data = await request.json()
    except Exception:
        raise db.DBError(400, "So‘rov formati noto‘g‘ri")
    if not isinstance(data, dict):
        raise db.DBError(400, "So‘rov formati noto‘g‘ri")
    return data


def api(handler):
    async def wrapped(request: Request):
        try:
            return await handler(request)
        except db.DBError as exc:
            return err(exc.status, exc.message)
    return wrapped


def to_int(value, message="Ma’lumot noto‘g‘ri"):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        raise db.DBError(400, message)


_site_cache = {"t": 0.0, "data": None}


async def site_data(fresh: bool = False):
    """(ma’lumot, ogohlantirish). Baza ishlamasa ham sahifa ochiladi."""
    now = time.monotonic()
    if not fresh and _site_cache["data"] is not None and now - _site_cache["t"] < 20:
        return _site_cache["data"], ""
    try:
        raw = await db.rpc("site_data") or {}
        settings = dict(pages.DEFAULT_SETTINGS)
        for key, value in (raw.get("settings") or {}).items():
            value = "" if value is None else str(value)
            # Asosiy matnlar bo‘sh qolsa standart matn ko‘rsatiladi, qolganlari bo‘sh bo‘lsa yashiriladi
            if value.strip() or key not in pages.FALLBACK_KEYS:
                settings[key] = value.strip()
        data = {"settings": settings, "courses": raw.get("courses") or [], "tests": raw.get("tests") or []}
        _site_cache.update(t=now, data=data)
        return data, ""
    except db.DBError as exc:
        if _site_cache["data"] is not None:
            return _site_cache["data"], ""
        print(f"[site] site_data xatosi: {exc.message}")
        return ({"settings": dict(pages.DEFAULT_SETTINGS), "courses": [], "tests": []},
                "Ma’lumotlarni yuklashda vaqtinchalik muammo bo‘ldi. Sahifani birozdan keyin yangilang.")


def html_page(content: str, notice: str = "", status: int = 200) -> HTMLResponse:
    cache = "no-store" if notice or status != 200 else PUBLIC_CACHE
    return HTMLResponse(content, status_code=status, headers={"Cache-Control": cache})


# ---------------------------------------------------------------- public pages

async def home(request: Request):
    data, notice = await site_data()
    return html_page(pages.home(data, notice=notice, base_url=base_url(request)), notice)


async def courses(request: Request):
    data, notice = await site_data()
    return html_page(pages.courses_page(data, notice=notice, base_url=base_url(request)), notice)


async def course_detail(request: Request):
    data, notice = await site_data()
    cid = request.path_params["cid"]
    course = next((c for c in data["courses"] if int(c.get("id") or 0) == cid), None)
    if not course:
        return html_page(pages.not_found(data, notice=notice), notice, 404)
    return html_page(pages.course_page(data, course, notice=notice, base_url=base_url(request)), notice)


async def register_page(request: Request):
    data, notice = await site_data()
    selected = request.query_params.get("course")
    return html_page(pages.register_page(data, selected, notice=notice, base_url=base_url(request)), notice)


async def payment_page(request: Request):
    data, notice = await site_data()
    return html_page(pages.payment_page(data, notice=notice, base_url=base_url(request)), notice)


async def tests_page(request: Request):
    data, notice = await site_data()
    return html_page(pages.tests_page(data, notice=notice, base_url=base_url(request)), notice)


async def test_detail(request: Request):
    data, notice = await site_data()
    try:
        test = await db.rpc("get_test", {"p_test_id": request.path_params["tid"]})
    except db.DBError as exc:
        if exc.status == 404:
            return html_page(pages.not_found(data, notice=notice), notice, 404)
        return html_page(pages.not_found(data, notice=exc.message), exc.message, 503)
    if not test.get("questions"):
        return html_page(pages.not_found(data, notice=notice), notice, 404)
    resp = html_page(pages.test_page(data, test, notice=notice, base_url=base_url(request)), notice)
    return resp


async def legacy_redirect(request: Request):
    target = {"/index.php": "/", "/payment.php": "/payment", "/tests.php": "/tests", "/admin/login.php": "/admin"}
    return RedirectResponse(target.get(request.url.path, "/"), status_code=301)


async def admin_shell(request: Request):
    item = load_asset("admin.html")
    if not item:
        return PlainTextResponse("Admin panel topilmadi", status_code=500)
    from .assets import asset_url
    content = item[0].decode().replace("{{ADMIN_CSS}}", asset_url("app.css")).replace(
        "{{ADMIN_JS}}", asset_url("admin.js")).replace("{{THEME_SCRIPT}}", pages.THEME_SCRIPT)
    return HTMLResponse(content, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"})


async def static_file(request: Request):
    item = load_asset(request.path_params["name"])
    if not item:
        return PlainTextResponse("Topilmadi", status_code=404)
    data, ctype, version = item
    immutable = request.query_params.get("v") == version
    cache = "public, max-age=31536000, immutable" if immutable else "public, max-age=3600"
    return Response(data, media_type=ctype, headers={"Cache-Control": cache})


async def favicon(request: Request):
    return RedirectResponse("/static/logo.jpeg", status_code=301)


async def media(request: Request):
    mid = request.path_params["mid"]
    if not UUID_RE.match(mid):
        return PlainTextResponse("Topilmadi", status_code=404)
    try:
        item = await db.rpc("get_public_media", {"p_id": mid})
    except db.DBError as exc:
        return PlainTextResponse(exc.message, status_code=exc.status)
    if not item:
        return PlainTextResponse("Topilmadi", status_code=404)
    return Response(base64.b64decode(item["data"]), media_type=item["mime"],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


async def robots(request: Request):
    return PlainTextResponse(f"User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: {base_url(request)}/sitemap.xml\n")


async def sitemap(request: Request):
    data, _ = await site_data()
    root = base_url(request)
    paths = ["/", "/courses", "/register", "/payment", "/tests"]
    paths += [f"/courses/{c['id']}" for c in data["courses"]]
    paths += [f"/tests/{t['id']}" for t in data["tests"]]
    body = "".join(f"<url><loc>{pages.e(root + p)}</loc></url>" for p in paths)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>',
                    media_type="application/xml", headers={"Cache-Control": PUBLIC_CACHE})


async def not_found_handler(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return err(404, "Topilmadi")
    data, notice = await site_data()
    return html_page(pages.not_found(data, notice=notice), notice, 404)


async def server_error_handler(request: Request, exc):
    print(f"[app] kutilmagan xato {request.url.path}: {type(exc).__name__}: {exc}")
    if request.url.path.startswith("/api/"):
        return err(500, "Serverda kutilmagan xatolik. Qayta urinib ko‘ring.")
    return HTMLResponse("<h1>Serverda xatolik</h1><p>Sahifani birozdan keyin yangilang.</p>", status_code=500,
                        headers={"Cache-Control": "no-store"})


# ---------------------------------------------------------------- public API

@api
async def health(request: Request):
    database = False
    if db.configured():
        try:
            database = bool(await db.rpc("health"))
        except db.DBError:
            database = False
    return JSONResponse({"ok": database, "database": database}, status_code=200 if database else 503,
                        headers={"Cache-Control": "no-store"})


@api
async def api_register(request: Request):
    d = await read_json(request)
    result = await db.rpc("submit_registration", {
        "p_full_name": str(d.get("full_name") or ""),
        "p_phone": str(d.get("phone") or ""),
        "p_course_id": to_int(d.get("course_id"), "Kursni tanlang"),
        "p_note": str(d.get("note") or "")[:1000],
    })
    return ok(result)


@api
async def api_payment_request(request: Request):
    d = await read_json(request)
    try:
        amount = float(str(d.get("amount") or "").replace(" ", ""))
    except ValueError:
        raise db.DBError(400, "To‘lov summasini to‘g‘ri kiriting")
    data = str(d.get("receipt_base64") or "")
    if not data:
        raise db.DBError(400, "To‘lov chekini yuklang")
    result = await db.rpc("submit_payment_request", {
        "p_full_name": str(d.get("full_name") or ""),
        "p_phone": str(d.get("phone") or ""),
        "p_course_id": to_int(d.get("course_id"), "Kursni tanlang"),
        "p_amount": amount,
        "p_card_last4": str(d.get("payer_card_last4") or ""),
        "p_target_month": str(d.get("target_month") or ""),
        "p_receipt_mime": str(d.get("receipt_type") or ""),
        "p_receipt_b64": data,
    })
    return ok(result)


@api
async def api_submit_test(request: Request):
    d = await read_json(request)
    answers = d.get("answers")
    if not isinstance(answers, dict) or not answers:
        raise db.DBError(400, "Savollarga javob bering")
    result = await db.rpc("submit_test", {
        "p_test_id": request.path_params["tid"],
        "p_full_name": str(d.get("full_name") or ""),
        "p_phone": str(d.get("phone") or ""),
        "p_answers": {str(k): str(v)[:1] for k, v in answers.items()},
    })
    return ok(result)


# ---------------------------------------------------------------- admin API

def token_of(request: Request) -> str:
    t = request.cookies.get(ADMIN_COOKIE) or ""
    if not t:
        raise db.DBError(401, "Admin paneliga kiring")
    return t


@api
async def admin_login(request: Request):
    d = await read_json(request)
    result = await db.rpc("admin_login", {"p_username": str(d.get("username") or ""),
                                          "p_password": str(d.get("password") or "")})
    if not result or not result.get("ok"):
        return err(401, (result or {}).get("error") or "Login yoki parol noto‘g‘ri")
    resp = ok({"ok": True, "admin": result.get("admin")})
    resp.set_cookie(ADMIN_COOKIE, result["token"], max_age=12 * 3600, httponly=True, secure=True,
                    samesite="strict", path="/")
    return resp


@api
async def admin_logout(request: Request):
    if request.headers.get("x-requested-with") != "fetch":
        return err(403, "So‘rov rad etildi")
    t = request.cookies.get(ADMIN_COOKIE)
    if t:
        try:
            await db.rpc("admin_logout", {"p_token": t})
        except db.DBError:
            pass
    resp = ok()
    resp.delete_cookie(ADMIN_COOKIE, path="/", secure=True, httponly=True, samesite="strict")
    return resp


@api
async def admin_me(request: Request):
    return ok(await db.rpc("admin_me", {"p_token": token_of(request)}))


@api
async def admin_dashboard(request: Request):
    return ok(await db.rpc("admin_dashboard", {"p_token": token_of(request)}))


@api
async def admin_list(request: Request):
    entity = request.path_params["entity"]
    if entity not in ENTITIES:
        raise db.DBError(404, "Bunday bo‘lim yo‘q")
    flt = {}
    if request.query_params.get("test_id"):
        flt["test_id"] = request.query_params["test_id"]
    return ok(await db.rpc("admin_list", {"p_token": token_of(request), "p_entity": entity, "p_filter": flt}))


def _invalidate():
    _site_cache.update(t=0.0, data=None)


@api
async def admin_save(request: Request):
    d = await read_json(request)
    data = d.get("data")
    if not isinstance(data, dict):
        raise db.DBError(400, "Ma’lumot yuborilmadi")
    rid = d.get("id")
    row = await db.rpc("admin_save", {"p_token": token_of(request), "p_entity": request.path_params["entity"],
                                      "p_id": to_int(rid) if rid not in (None, "") else None, "p_data": data})
    _invalidate()
    return ok(row)


@api
async def admin_delete(request: Request):
    await read_json(request)
    result = await db.rpc("admin_delete", {"p_token": token_of(request), "p_entity": request.path_params["entity"],
                                           "p_id": request.path_params["rid"]})
    _invalidate()
    return ok(result)


@api
async def admin_upload(request: Request):
    d = await read_json(request)
    return ok(await db.rpc("admin_upload_image", {"p_token": token_of(request), "p_mime": str(d.get("mime") or ""),
                                                  "p_b64": str(d.get("data") or "")}))


@api
async def admin_receipt(request: Request):
    item = await db.rpc("admin_get_receipt", {"p_token": token_of(request), "p_request_id": request.path_params["rid"]})
    return Response(base64.b64decode(item["data"]), media_type=item["mime"],
                    headers={"Cache-Control": "private, no-store", "Content-Disposition": "inline"})


@api
async def admin_review(request: Request):
    d = await read_json(request)
    return ok(await db.rpc("admin_review_payment", {
        "p_token": token_of(request), "p_request_id": request.path_params["rid"],
        "p_status": str(d.get("status") or ""), "p_note": str(d.get("note") or "")}))


@api
async def admin_settings(request: Request):
    d = await read_json(request)
    settings = d.get("settings")
    if not isinstance(settings, dict):
        raise db.DBError(400, "Sozlamalar yuborilmadi")
    result = await db.rpc("admin_save_settings", {"p_token": token_of(request),
                                                  "p_settings": {str(k): str(v or "") for k, v in settings.items()}})
    _invalidate()
    return ok(result)


@api
async def admin_password(request: Request):
    d = await read_json(request)
    return ok(await db.rpc("admin_change_password", {"p_token": token_of(request), "p_old": str(d.get("old") or ""),
                                                     "p_new": str(d.get("new") or "")}))


@api
async def admin_create(request: Request):
    d = await read_json(request)
    return ok(await db.rpc("admin_create_admin", {"p_token": token_of(request), "p_username": str(d.get("username") or ""),
                                                  "p_password": str(d.get("password") or ""),
                                                  "p_full_name": str(d.get("full_name") or "")}))


@api
async def admin_set_active(request: Request):
    d = await read_json(request)
    return ok(await db.rpc("admin_set_admin_active", {"p_token": token_of(request), "p_id": request.path_params["rid"],
                                                      "p_active": bool(d.get("active"))}))


# ---------------------------------------------------------------- test fayllari

def decode_upload(d: dict) -> tuple[bytes, str, str]:
    name = str(d.get("name") or "test-fayli")[:200]
    try:
        raw = base64.b64decode(str(d.get("data") or ""), validate=False)
    except Exception:
        raise db.DBError(400, "Fayl buzilgan yoki noto‘g‘ri yuborilgan")
    if not raw:
        raise db.DBError(400, "Fayl tanlanmagan")
    if len(raw) > 3_300_000:
        raise db.DBError(400, "Fayl hajmi 3 MB dan oshmasin")
    try:
        mime = test_import.detect_mime(name, str(d.get("mime") or ""))
    except test_import.ImportErrorUz as exc:
        raise db.DBError(400, str(exc))
    return raw, name, mime


def disposition(kind: str, name: str) -> str:
    safe = re.sub(r'[^A-Za-z0-9._-]+', "_", name) or "fayl"
    return f"{kind}; filename=\"{safe}\"; filename*=UTF-8''{quote(name)}"


@api
async def admin_parse_file(request: Request):
    d = await read_json(request)
    await db.rpc("admin_me", {"p_token": token_of(request)})
    raw, name, mime = decode_upload(d)
    try:
        result = test_import.parse_file(raw, name, mime)
    except test_import.ImportErrorUz as exc:
        raise db.DBError(400, str(exc))
    except Exception as exc:  # noqa: BLE001
        print(f"[import] {name}: {type(exc).__name__}: {exc}")
        raise db.DBError(400, "Faylni o‘qib bo‘lmadi. Boshqa formatda (masalan, .docx) saqlab qayta urinib ko‘ring.")
    return ok(result)


@api
async def admin_import_questions(request: Request):
    d = await read_json(request)
    items = d.get("questions")
    if not isinstance(items, list):
        raise db.DBError(400, "Savollar yuborilmadi")
    keys = ("question_text", "option_a", "option_b", "option_c", "option_d", "correct_option")
    clean = [{k: (str(q.get(k)) if q.get(k) not in (None, "") else None) for k in keys}
             for q in items if isinstance(q, dict)]
    return ok(await db.rpc("admin_import_questions", {
        "p_token": token_of(request), "p_test_id": request.path_params["tid"],
        "p_questions": clean, "p_replace": bool(d.get("replace"))}))


@api
async def admin_attach_file(request: Request):
    d = await read_json(request)
    raw, name, mime = decode_upload(d)
    visibility = str(d.get("visibility") or "after")
    result = await db.rpc("admin_attach_test_file", {
        "p_token": token_of(request), "p_test_id": request.path_params["tid"], "p_name": name,
        "p_mime": mime, "p_b64": base64.b64encode(raw).decode(), "p_visibility": visibility})
    return ok(result)


@api
async def admin_remove_file(request: Request):
    await read_json(request)
    return ok(await db.rpc("admin_remove_test_file", {"p_token": token_of(request),
                                                      "p_test_id": request.path_params["tid"]}))


@api
async def admin_test_file(request: Request):
    item = await db.rpc("admin_get_test_file", {"p_token": token_of(request), "p_test_id": request.path_params["tid"]})
    return Response(base64.b64decode(item["data"]), media_type=item["mime"],
                    headers={"Cache-Control": "private, no-store",
                             "Content-Disposition": disposition("inline", item.get("name") or "fayl")})


async def test_file_page(request: Request):
    tid = request.path_params["tid"]
    token = request.query_params.get("t") or None
    data, notice = await site_data()
    try:
        item = await db.rpc("get_test_file", {"p_test_id": tid, "p_token": token})
    except db.DBError as exc:
        if exc.status == 403:
            return html_page(pages.test_file_locked(data, tid, exc.message, notice=notice), notice, 403)
        if exc.status == 404:
            return html_page(pages.not_found(data, notice=notice), notice, 404)
        return html_page(pages.not_found(data, notice=exc.message), exc.message, 503)
    raw = base64.b64decode(item["data"])
    cache = "private, no-store" if token else PUBLIC_CACHE
    name = item.get("name") or "test-fayli"
    if request.query_params.get("raw"):
        kind = "inline" if item["mime"] == test_import.PDF_MIME and not request.query_params.get("download") else "attachment"
        return Response(raw, media_type=item["mime"],
                        headers={"Cache-Control": cache, "Content-Disposition": disposition(kind, name),
                                 "X-Robots-Tag": "noindex"})
    try:
        paragraphs = test_import.plain_text(raw, item["mime"])
    except Exception:  # noqa: BLE001
        paragraphs = []
    query = f"?t={quote(token)}&" if token else "?"
    resp = html_page(pages.test_file_page(data, tid, item, paragraphs, query, notice=notice), notice)
    resp.headers["Cache-Control"] = "private, no-store" if token or notice else PUBLIC_CACHE
    resp.headers["X-Robots-Tag"] = "noindex"
    return resp


routes = [
    Route("/", home),
    Route("/courses", courses),
    Route("/courses/{cid:int}", course_detail),
    Route("/register", register_page),
    Route("/payment", payment_page),
    Route("/tests", tests_page),
    Route("/tests/{tid:int}", test_detail),
    Route("/tests/{tid:int}/file", test_file_page),
    Route("/index.php", legacy_redirect),
    Route("/payment.php", legacy_redirect),
    Route("/tests.php", legacy_redirect),
    Route("/admin", admin_shell),
    Route("/admin/{rest:path}", admin_shell),
    Route("/static/{name}", static_file),
    Route("/media/{mid}", media),
    Route("/favicon.ico", favicon),
    Route("/robots.txt", robots),
    Route("/sitemap.xml", sitemap),
    Route("/api/health", health),
    Route("/api/register", api_register, methods=["POST"]),
    Route("/api/payment-requests", api_payment_request, methods=["POST"]),
    Route("/api/tests/{tid:int}/submit", api_submit_test, methods=["POST"]),
    Route("/api/admin/login", admin_login, methods=["POST"]),
    Route("/api/admin/logout", admin_logout, methods=["POST"]),
    Route("/api/admin/me", admin_me),
    Route("/api/admin/dashboard", admin_dashboard),
    Route("/api/admin/list/{entity}", admin_list),
    Route("/api/admin/save/{entity}", admin_save, methods=["POST"]),
    Route("/api/admin/delete/{entity}/{rid:int}", admin_delete, methods=["POST"]),
    Route("/api/admin/upload", admin_upload, methods=["POST"]),
    Route("/api/admin/receipt/{rid:int}", admin_receipt),
    Route("/api/admin/review/{rid:int}", admin_review, methods=["POST"]),
    Route("/api/admin/settings", admin_settings, methods=["POST"]),
    Route("/api/admin/password", admin_password, methods=["POST"]),
    Route("/api/admin/admins", admin_create, methods=["POST"]),
    Route("/api/admin/admins/{rid:int}/active", admin_set_active, methods=["POST"]),
    Route("/api/admin/tests/{tid:int}/parse", admin_parse_file, methods=["POST"]),
    Route("/api/admin/tests/{tid:int}/import", admin_import_questions, methods=["POST"]),
    Route("/api/admin/tests/{tid:int}/file", admin_attach_file, methods=["POST"]),
    Route("/api/admin/tests/{tid:int}/file", admin_test_file, methods=["GET"]),
    Route("/api/admin/tests/{tid:int}/file/remove", admin_remove_file, methods=["POST"]),
]

app = Starlette(
    routes=routes,
    middleware=[Middleware(SecurityHeaders)],
    exception_handlers={404: not_found_handler, 500: server_error_handler},
)
