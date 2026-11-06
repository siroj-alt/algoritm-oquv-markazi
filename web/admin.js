/* Algoritm o‘quv markazi — admin panel */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var root = document.documentElement;
  var state = { me: null, counts: {}, lookups: {}, rows: [], view: null };

  /* ================================================= helpers */
  function h(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(v) {
    var n = Math.round(Number(v) || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so‘m";
  }
  var tz = "Asia/Tashkent";
  function fmtDate(v) {
    if (!v) return "—";
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { var p = s.split("-"); return p[2] + "." + p[1] + "." + p[0]; }
    var d = new Date(s);
    if (isNaN(d)) return s;
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    var m = {}; parts.forEach(function (x) { m[x.type] = x.value; });
    return m.day + "." + m.month + "." + m.year + " " + m.hour + ":" + m.minute;
  }
  function fmtMonth(v) {
    if (!v) return "—";
    var months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
    var p = String(v).split("-");
    return (months[Number(p[1]) - 1] || p[1]) + " " + p[0];
  }
  function today() {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return parts;
  }
  var toastTimer;
  function toast(text, isError) {
    var el = document.getElementById("toast");
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4000);
  }
  async function api(method, url, body) {
    var opts = { method: method, credentials: "same-origin", headers: { "X-Requested-With": "fetch" } };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    var res;
    try { res = await fetch(url, opts); } catch (e) { throw new Error("Internet aloqasini tekshiring"); }
    if (res.status === 401 && url !== "/api/admin/login") { renderLogin("Sessiya tugadi. Qaytadan kiring."); throw new Error("Qaytadan kiring"); }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.detail) || "So‘rov bajarilmadi");
    return data;
  }
  function icon(name) {
    var paths = {
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
      back: '<path d="M15 5l-7 7 7 7"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
      file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'
    };
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + "</svg>";
  }
  function badge(value, labels) {
    var label = (labels && labels[value]) || value || "—";
    return '<span class="badge badge-' + h(value) + '">' + h(label) + "</span>";
  }
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /* ================================================= labels */
  var STUDENT_STATUS = { "new": "Yangi ariza", contacted: "Bog‘lanildi", enrolled: "O‘qiydi", rejected: "Rad etildi" };
  var REQUEST_STATUS = { pending: "Tekshirilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };
  var METHODS = { cash: "Naqd", card: "Karta", transfer: "O‘tkazma", other: "Boshqa" };
  var ATTEND = { present: "Keldi", absent: "Kelmadi", late: "Kechikdi", excused: "Sababli" };
  var FILE_VIS = { hidden: "o‘quvchilarga ko‘rinmaydi", after: "testdan keyin ochiladi", always: "doim ochiq" };

  /* ================================================= lookups */
  async function lookup(name) {
    if (state.lookups[name]) return state.lookups[name];
    state.lookups[name] = await api("GET", "/api/admin/list/" + name);
    return state.lookups[name];
  }
  function dropLookup(entity) { delete state.lookups[entity]; }
  function opts(rows, labelFn) {
    return rows.map(function (r) { return { value: r.id, label: labelFn(r) }; });
  }
  async function courseOptions() { return opts(await lookup("courses"), function (r) { return r.name + (r.is_active ? "" : " (faol emas)"); }); }
  async function groupOptions() { return opts(await lookup("groups"), function (r) { return r.name + (r.course_name ? " — " + r.course_name : ""); }); }
  async function studentOptions() { return opts(await lookup("students"), function (r) { return r.full_name + " · " + r.phone; }); }
  async function testOptions() { return opts(await lookup("tests"), function (r) { return r.title; }); }
  function enumOptions(map) { return Object.keys(map).map(function (k) { return { value: k, label: map[k] }; }); }

  /* ================================================= entities */
  var ENT = {
    students: {
      title: "Arizalar va o‘quvchilar", add: "O‘quvchi qo‘shish", one: "o‘quvchi",
      statusFilter: STUDENT_STATUS,
      columns: [
        { label: "O‘quvchi", render: function (r) { return '<div class="cell-main">' + h(r.full_name) + '</div><div class="cell-sub"><a href="tel:' + h(r.phone) + '">' + h(r.phone) + "</a></div>"; } },
        { label: "Kurs / guruh", render: function (r) { return h(r.course_name || "—") + '<div class="cell-sub">' + h(r.group_name || "Guruhsiz") + "</div>"; } },
        { label: "Holat", render: function (r) {
            return '<select class="inline-status" data-id="' + r.id + '" aria-label="Holat">' + Object.keys(STUDENT_STATUS).map(function (k) {
              return '<option value="' + k + '"' + (r.status === k ? " selected" : "") + ">" + STUDENT_STATUS[k] + "</option>"; }).join("") + "</select>"; } },
        { label: "Izoh", render: function (r) { return '<div class="cell-sub">' + h(r.note || "") + "</div>"; } },
        { label: "Sana", render: function (r) { return '<span class="cell-sub">' + fmtDate(r.created_at) + "</span>"; } }
      ],
      fields: [
        { name: "full_name", label: "Ism va familiya", type: "text", required: true, span: 2 },
        { name: "phone", label: "Telefon", type: "tel", required: true },
        { name: "status", label: "Holat", type: "select", options: function () { return enumOptions(STUDENT_STATUS); }, required: true, def: "new" },
        { name: "course_id", label: "Kurs", type: "select", options: courseOptions, empty: "Tanlanmagan" },
        { name: "group_id", label: "Guruh", type: "select", options: groupOptions, empty: "Guruhsiz" },
        { name: "note", label: "Izoh", type: "textarea", span: 2 }
      ]
    },
    payment_requests: {
      title: "To‘lov cheklari", one: "to‘lov arizasi", noAdd: true, noEdit: true,
      statusFilter: REQUEST_STATUS,
      columns: [
        { label: "To‘lovchi", render: function (r) { return '<div class="cell-main">' + h(r.full_name) + '</div><div class="cell-sub">' + h(r.phone) + (r.payer_card_last4 ? " · karta *" + h(r.payer_card_last4) : "") + "</div>"; } },
        { label: "Kurs / oy", render: function (r) { return h(r.course_name || "—") + '<div class="cell-sub">' + fmtMonth(r.target_month) + "</div>"; } },
        { label: "Summa", cls: "num", render: function (r) { return money(r.amount); } },
        { label: "Holat", render: function (r) { return badge(r.status, REQUEST_STATUS) + (r.admin_note ? '<div class="cell-sub">' + h(r.admin_note) + "</div>" : ""); } },
        { label: "Yuborilgan", render: function (r) { return '<span class="cell-sub">' + fmtDate(r.created_at) + "</span>"; } }
      ],
      actions: function (r) {
        var out = r.receipt_id ? '<button class="btn btn-ghost btn-sm" data-act="receipt" data-id="' + r.id + '">Chek</button>' : "";
        if (r.status === "pending") {
          out += '<button class="btn btn-ok btn-sm" data-act="approve" data-id="' + r.id + '">Tasdiqlash</button>';
          out += '<button class="btn btn-danger btn-sm" data-act="reject" data-id="' + r.id + '">Rad etish</button>';
        }
        return out;
      }
    },
    payments: {
      title: "To‘lovlar", add: "To‘lov kiritish", one: "to‘lov",
      columns: [
        { label: "O‘quvchi", render: function (r) { return '<div class="cell-main">' + h(r.student_name || "—") + '</div><div class="cell-sub">' + h(r.student_phone || "") + "</div>"; } },
        { label: "Summa", cls: "num", render: function (r) { return money(r.amount); } },
        { label: "Usul", render: function (r) { return h(METHODS[r.method] || r.method); } },
        { label: "Sana / oy", render: function (r) { return fmtDate(r.paid_on) + '<div class="cell-sub">' + (r.for_month ? fmtMonth(r.for_month) + " uchun" : "") + "</div>"; } },
        { label: "Izoh", render: function (r) { return '<div class="cell-sub">' + h(r.note || "") + "</div>"; } }
      ],
      fields: [
        { name: "student_id", label: "O‘quvchi", type: "select", options: studentOptions, required: true, span: 2 },
        { name: "amount", label: "Summa (so‘m)", type: "number", required: true, min: 1 },
        { name: "method", label: "To‘lov usuli", type: "select", options: function () { return enumOptions(METHODS); }, required: true, def: "cash" },
        { name: "paid_on", label: "To‘lov sanasi", type: "date", required: true, def: today },
        { name: "for_month", label: "Qaysi oy uchun", type: "month", def: function () { return today().slice(0, 7); } },
        { name: "note", label: "Izoh", type: "textarea", span: 2 }
      ],
      summary: function (rows) {
        var month = today().slice(0, 7);
        var sum = rows.filter(function (r) { return String(r.paid_on).slice(0, 7) === month; }).reduce(function (a, r) { return a + Number(r.amount || 0); }, 0);
        return "Shu oy tushumi: <b>" + money(sum) + "</b>";
      }
    },
    courses: {
      title: "Kurslar", add: "Yangi kurs", one: "kurs",
      columns: [
        { label: "Kurs", render: function (r) { return '<div class="cell-main">' + h(r.name) + '</div><div class="cell-sub">' + h([r.duration, r.schedule].filter(Boolean).join(" · ")) + "</div>"; } },
        { label: "Narx", cls: "num", render: function (r) { return money(r.price); } },
        { label: "Ustoz", render: function (r) { return h(r.teacher_name || "—"); } },
        { label: "O‘quvchilar", cls: "num", render: function (r) { return h(r.students_count); } },
        { label: "Saytda", render: function (r) { return r.is_active ? badge("ok", { ok: "Ko‘rinadi" }) : badge("off", { off: "Yashirin" }); } }
      ],
      fields: [
        { name: "name", label: "Kurs nomi", type: "text", required: true, span: 2, max: 120 },
        { name: "price", label: "Narxi (so‘m)", type: "number", required: true, min: 0, def: 0 },
        { name: "duration", label: "Davomiyligi", type: "text", placeholder: "Masalan, 4 oy", max: 80 },
        { name: "schedule", label: "Dars vaqti", type: "text", placeholder: "Masalan, Du–Cho–Ju, 14:00", span: 2, max: 160 },
        { name: "description", label: "Kurs haqida", type: "textarea", rows: 6, span: 2, help: "Bo‘sh qator bilan xatboshilarga ajrating. Birinchi qator kurs kartasida ko‘rinadi." },
        { name: "image_url", label: "Kurs rasmi", type: "image", span: 2 },
        { name: "teacher_name", label: "Ustoz ismi", type: "text", max: 120 },
        { name: "sort_order", label: "Tartib raqami", type: "number", def: 0, help: "Kichik raqam oldinda turadi" },
        { name: "teacher_bio", label: "Ustoz haqida", type: "textarea", span: 2 },
        { name: "teacher_image_url", label: "Ustoz rasmi", type: "image", span: 2 },
        { name: "is_active", label: "Saytda ko‘rsatish", type: "bool", def: true, span: 2 }
      ],
      onChange: function () { dropLookup("courses"); }
    },
    groups: {
      title: "Guruhlar", add: "Yangi guruh", one: "guruh",
      columns: [
        { label: "Guruh", render: function (r) { return '<div class="cell-main">' + h(r.name) + '</div><div class="cell-sub">' + h(r.course_name || "") + "</div>"; } },
        { label: "Ustoz", render: function (r) { return h(r.teacher_name || "—"); } },
        { label: "Jadval", render: function (r) { return h(r.schedule || "—") + '<div class="cell-sub">' + (r.start_date ? "Boshlanish: " + fmtDate(r.start_date) : "") + "</div>"; } },
        { label: "O‘quvchilar", cls: "num", render: function (r) { return h(r.students_count); } },
        { label: "Holat", render: function (r) { return r.is_active ? badge("ok", { ok: "Faol" }) : badge("off", { off: "Yopilgan" }); } }
      ],
      fields: [
        { name: "name", label: "Guruh nomi", type: "text", required: true, placeholder: "Masalan, Python-1" },
        { name: "course_id", label: "Kurs", type: "select", options: courseOptions, required: true },
        { name: "teacher_name", label: "Ustoz", type: "text" },
        { name: "start_date", label: "Boshlanish sanasi", type: "date" },
        { name: "schedule", label: "Dars jadvali", type: "text", span: 2, placeholder: "Masalan, Se–Pa–Sha, 16:00–18:00" },
        { name: "is_active", label: "Faol guruh", type: "bool", def: true, span: 2 }
      ],
      onChange: function () { dropLookup("groups"); }
    },
    attendance: {
      title: "Davomat", add: "Davomat kiritish", one: "davomat yozuvi",
      columns: [
        { label: "Sana", render: function (r) { return fmtDate(r.lesson_date); } },
        { label: "O‘quvchi", render: function (r) { return '<div class="cell-main">' + h(r.student_name || "—") + "</div>"; } },
        { label: "Guruh", render: function (r) { return h(r.group_name || "—"); } },
        { label: "Holat", render: function (r) { return badge(r.status, ATTEND); } },
        { label: "Izoh", render: function (r) { return '<div class="cell-sub">' + h(r.note || "") + "</div>"; } }
      ],
      fields: [
        { name: "student_id", label: "O‘quvchi", type: "select", options: studentOptions, required: true, span: 2 },
        { name: "group_id", label: "Guruh", type: "select", options: groupOptions, empty: "Tanlanmagan" },
        { name: "lesson_date", label: "Dars sanasi", type: "date", required: true, def: today },
        { name: "status", label: "Holat", type: "select", options: function () { return enumOptions(ATTEND); }, required: true, def: "present" },
        { name: "note", label: "Izoh", type: "text" }
      ]
    },
    tests: {
      title: "Onlayn testlar", add: "Yangi test", one: "test",
      columns: [
        { label: "Test", render: function (r) { return '<div class="cell-main">' + h(r.title) + '</div><div class="cell-sub">' + h(r.description || "") + (r.file_name ? "<br>Fayl: " + h(r.file_name) + " (" + h(FILE_VIS[r.file_visibility] || "") + ")" : "") + "</div>"; } },
        { label: "Savollar", cls: "num", render: function (r) { return h(r.questions_count); } },
        { label: "Ishlaganlar", cls: "num", render: function (r) { return h(r.results_count); } },
        { label: "Saytda", render: function (r) { return r.is_active ? (Number(r.questions_count) ? badge("ok", { ok: "Ko‘rinadi" }) : badge("pending", { pending: "Savol qo‘shing" })) : badge("off", { off: "Yashirin" }); } }
      ],
      actions: function (r) { return '<button class="btn btn-ghost btn-sm" data-act="questions" data-id="' + r.id + '">Savollar</button>'; },
      fields: [
        { name: "title", label: "Test nomi", type: "text", required: true, span: 2 },
        { name: "description", label: "Qisqa tavsif", type: "textarea", span: 2 },
        { name: "is_active", label: "Saytda ko‘rsatish", type: "bool", def: true, span: 2 }
      ],
      onChange: function () { dropLookup("tests"); }
    },
    questions: {
      title: "Savollar", add: "Savol qo‘shish", one: "savol",
      fields: [
        { name: "question_text", label: "Savol", type: "textarea", required: true, span: 2 },
        { name: "option_a", label: "A javob", type: "text", required: true },
        { name: "option_b", label: "B javob", type: "text", required: true },
        { name: "option_c", label: "C javob", type: "text" },
        { name: "option_d", label: "D javob", type: "text" },
        { name: "correct_option", label: "To‘g‘ri javob", type: "select", required: true, options: function () { return ["A", "B", "C", "D"].map(function (x) { return { value: x, label: x }; }); } },
        { name: "sort_order", label: "Tartib raqami", type: "number", def: 0 }
      ]
    },
    test_results: {
      title: "Test natijalari", one: "natija", noAdd: true, noEdit: true,
      columns: [
        { label: "Ishtirokchi", render: function (r) { return '<div class="cell-main">' + h(r.full_name) + '</div><div class="cell-sub">' + h(r.phone) + "</div>"; } },
        { label: "Test", render: function (r) { return h(r.test_title || "—"); } },
        { label: "Natija", cls: "num", render: function (r) { return "<b>" + Math.round(r.percentage) + "%</b>" + '<div class="cell-sub">' + r.correct_answers + " / " + r.total_questions + "</div>"; } },
        { label: "Sana", render: function (r) { return '<span class="cell-sub">' + fmtDate(r.created_at) + "</span>"; } }
      ]
    }
  };

  var NAV = [
    { id: "dashboard", label: "Bosh panel" },
    { group: "O‘quvchilar" },
    { id: "students", label: "Arizalar va o‘quvchilar", count: "new_applications" },
    { id: "groups", label: "Guruhlar" },
    { id: "attendance", label: "Davomat" },
    { group: "Moliya" },
    { id: "payment_requests", label: "To‘lov cheklari", count: "pending_payments" },
    { id: "payments", label: "To‘lovlar" },
    { group: "Sayt" },
    { id: "courses", label: "Kurslar" },
    { id: "tests", label: "Onlayn testlar" },
    { id: "test_results", label: "Test natijalari" },
    { id: "settings", label: "Sayt sozlamalari" },
    { id: "admins", label: "Adminlar va parol" }
  ];

  /* ================================================= login */
  function renderLogin(message) {
    state.me = null;
    document.body.classList.remove("admin-open");
    app.innerHTML = '<div class="admin-login"><form class="form-card" id="loginForm" novalidate>' +
      '<a class="brand" href="/"><img src="/static/logo.jpeg" alt="" width="40" height="40"><span class="brand-text"><b>Algoritm</b><small>Boshqaruv paneli</small></span></a>' +
      "<h2>Admin paneliga kirish</h2>" +
      '<label class="field"><span>Login</span><input name="username" required autocomplete="username" autocapitalize="off" spellcheck="false"></label>' +
      '<label class="field"><span>Parol</span><input name="password" type="password" required autocomplete="current-password"></label>' +
      '<button class="btn btn-primary btn-block" type="submit">Kirish</button>' +
      '<p class="form-status" aria-live="polite"></p></form></div>';
    var form = document.getElementById("loginForm");
    var status = form.querySelector(".form-status");
    if (message) { status.textContent = message; status.className = "form-status is-error"; }
    form.elements.username.focus();
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!form.elements.username.value.trim() || !form.elements.password.value) {
        status.textContent = "Login va parolni kiriting"; status.className = "form-status is-error"; return;
      }
      var btn = form.querySelector("button");
      btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
      try {
        var r = await api("POST", "/api/admin/login", { username: form.elements.username.value, password: form.elements.password.value });
        state.me = r.admin;
        renderShell();
      } catch (err) {
        status.textContent = err.message; status.className = "form-status is-error";
        btn.disabled = false; btn.textContent = "Kirish";
        form.elements.password.select();
      }
    });
  }

  /* ================================================= shell */
  function renderShell() {
    app.innerHTML = '<div class="admin-mobile-bar"><button class="icon-btn" type="button" data-open-nav aria-label="Menyu">' + icon("menu") + '</button><b class="mobile-title"></b><button class="icon-btn" type="button" data-theme aria-label="Rejim">' + icon("moon") + "</button></div>" +
      '<div class="admin-shell"><aside class="admin-side">' +
      '<a class="brand" href="/" target="_blank" rel="noopener"><img src="/static/logo.jpeg" alt="" width="40" height="40"><span class="brand-text"><b>Algoritm</b><small>Saytni ochish</small></span></a>' +
      '<nav class="admin-nav" aria-label="Admin bo‘limlari"></nav>' +
      '<div class="admin-side-foot"><span class="who"></span><button class="btn btn-ghost btn-sm" type="button" data-theme>Yorug‘ / qorong‘i rejim</button><button class="btn btn-ghost btn-sm" type="button" data-logout>Chiqish</button></div>' +
      '</aside><main class="admin-main" id="view"></main></div>';
    app.querySelector(".who").textContent = (state.me && (state.me.full_name || state.me.username)) || "";
    drawNav();
    app.querySelectorAll("[data-theme]").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        try { localStorage.setItem("alg-theme", next); } catch (e) {}
      });
    });
    app.querySelector("[data-open-nav]").addEventListener("click", function () { toggleNav(true); });
    app.querySelector("[data-logout]").addEventListener("click", async function () {
      try { await api("POST", "/api/admin/logout", {}); } catch (e) {}
      location.hash = "";
      renderLogin();
    });
    route();
    refreshCounts();
  }
  function toggleNav(open) {
    document.body.classList.toggle("admin-open", open);
    var scrim = document.querySelector(".admin-scrim");
    if (open && !scrim) {
      scrim = document.createElement("div");
      scrim.className = "admin-scrim";
      scrim.addEventListener("click", function () { toggleNav(false); });
      document.body.appendChild(scrim);
    } else if (!open && scrim) scrim.remove();
  }
  function drawNav() {
    var nav = app.querySelector(".admin-nav");
    if (!nav) return;
    var current = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "dashboard";
    if (current === "questions") current = "tests";
    nav.innerHTML = NAV.map(function (n) {
      if (n.group) return '<div class="admin-nav-group">' + h(n.group) + "</div>";
      var c = n.count && state.counts[n.count] ? '<span class="count">' + state.counts[n.count] + "</span>" : "";
      return '<button type="button" data-nav="' + n.id + '" class="' + (n.id === current ? "is-active" : "") + '"><span>' + h(n.label) + "</span>" + c + "</button>";
    }).join("");
    nav.querySelectorAll("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () { location.hash = "#/" + b.getAttribute("data-nav"); toggleNav(false); });
    });
  }
  async function refreshCounts() {
    try {
      var d = await api("GET", "/api/admin/dashboard");
      state.counts = { new_applications: d.new_applications, pending_payments: d.pending_payments };
      drawNav();
      return d;
    } catch (e) { return null; }
  }
  function setTitle(title, actions) {
    var view = document.getElementById("view");
    document.title = title + " — Algoritm admin";
    var mt = app.querySelector(".mobile-title");
    if (mt) mt.textContent = title;
    view.innerHTML = '<div class="admin-top"><h1>' + h(title) + '</h1><div class="admin-top-actions">' + (actions || "") + '</div></div><div id="viewBody"><div class="loading">Yuklanmoqda…</div></div>';
    return document.getElementById("viewBody");
  }

  function route() {
    if (!state.me) return;
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var section = parts[0] || "dashboard";
    drawNav();
    window.scrollTo(0, 0);
    if (section === "dashboard") return viewDashboard();
    if (section === "settings") return viewSettings();
    if (section === "admins") return viewAdmins();
    if (section === "questions" && parts[1]) return viewQuestions(Number(parts[1]));
    if (ENT[section]) return viewList(section);
    location.hash = "#/dashboard";
  }
  window.addEventListener("hashchange", route);

  /* ================================================= dashboard */
  async function viewDashboard() {
    var body = setTitle("Bosh panel", '<a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener">Saytni ochish</a>');
    var d = await refreshCounts();
    if (!d) { body.innerHTML = '<div class="table-empty">Ma’lumotlarni yuklab bo‘lmadi. Sahifani yangilang.</div>'; return; }
    var stat = function (label, value, go, alert) {
      return '<button type="button" class="stat' + (alert ? " is-alert" : "") + '" data-go="' + go + '"><small>' + h(label) + "</small><b>" + h(value) + "</b></button>";
    };
    body.innerHTML = '<div class="stat-grid">' +
      stat("Yangi arizalar", d.new_applications, "students", d.new_applications > 0) +
      stat("Tekshiriladigan cheklar", d.pending_payments, "payment_requests", d.pending_payments > 0) +
      stat("O‘qiyotganlar", d.enrolled, "students") +
      stat("Shu oy tushumi", money(d.month_income), "payments") +
      stat("Faol kurslar", d.active_courses, "courses") +
      stat("Faol guruhlar", d.active_groups, "groups") +
      stat("Test ishlaganlar (30 kun)", d.tests_taken, "test_results") +
      "</div>" +
      '<div class="dash-grid">' +
      '<section class="panel"><div class="panel-head"><h2>So‘nggi arizalar</h2><button class="link-btn" data-go="students">Barchasi</button></div>' +
      (d.recent_applications.length ? d.recent_applications.map(function (r) {
        return '<div class="list-row"><div><b>' + h(r.full_name) + "</b><small>" + h(r.course_name || "Kurs tanlanmagan") + " · " + h(r.phone) + "</small></div><div>" + badge(r.status, STUDENT_STATUS) + "<small>" + fmtDate(r.created_at) + "</small></div></div>";
      }).join("") : '<div class="table-empty">Hozircha arizalar yo‘q</div>') + "</section>" +
      '<section class="panel"><div class="panel-head"><h2>Tekshiriladigan cheklar</h2><button class="link-btn" data-go="payment_requests">Barchasi</button></div>' +
      (d.recent_requests.length ? d.recent_requests.map(function (r) {
        return '<div class="list-row"><div><b>' + h(r.full_name) + "</b><small>" + h(r.course_name || "") + " · " + h(r.phone) + "</small></div><div><b>" + money(r.amount) + "</b><small>" + fmtDate(r.created_at) + "</small></div></div>";
      }).join("") : '<div class="table-empty">Yangi cheklar yo‘q</div>') + "</section></div>";
    body.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/" + b.getAttribute("data-go"); }); });
  }

  /* ================================================= generic list */
  async function viewList(entity, extra) {
    var cfg = ENT[entity];
    var addBtn = cfg.noAdd ? "" : '<button class="btn btn-primary" type="button" data-add>' + icon("plus") + h(cfg.add) + "</button>";
    var body = setTitle(cfg.title, addBtn);
    var add = document.querySelector("[data-add]");
    if (add) add.addEventListener("click", function () { openForm(entity, null); });
    var rows;
    try { rows = await api("GET", "/api/admin/list/" + entity); }
    catch (e) { body.innerHTML = '<div class="table-empty">' + h(e.message) + "</div>"; return; }
    state.rows = rows;
    state.view = entity;
    if (entity === "students") state.lookups.students = rows;
    var filterSel = cfg.statusFilter ? '<select data-status-filter aria-label="Holat bo‘yicha"><option value="">Barcha holatlar</option>' +
      Object.keys(cfg.statusFilter).map(function (k) { return '<option value="' + k + '">' + h(cfg.statusFilter[k]) + "</option>"; }).join("") + "</select>" : "";
    body.innerHTML = '<div class="toolbar"><input type="search" data-search placeholder="Qidirish…" aria-label="Qidirish">' + filterSel +
      (cfg.summary ? '<span class="muted" style="align-self:center">' + cfg.summary(rows) + "</span>" : "") + "</div>" +
      '<div class="table-wrap"><table class="table"><thead><tr>' + cfg.columns.map(function (c) { return "<th>" + h(c.label) + "</th>"; }).join("") +
      '<th></th></tr></thead><tbody></tbody></table></div>';
    var tbody = body.querySelector("tbody");
    var search = body.querySelector("[data-search]");
    var statusSel = body.querySelector("[data-status-filter]");
    function draw() {
      var q = search.value.trim().toLowerCase();
      var st = statusSel ? statusSel.value : "";
      var list = rows.filter(function (r) {
        if (st && r.status !== st) return false;
        if (!q) return true;
        return JSON.stringify(r).toLowerCase().indexOf(q) !== -1;
      });
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="' + (cfg.columns.length + 1) + '"><div class="table-empty">' + (rows.length ? "Hech narsa topilmadi" : "Hozircha yozuvlar yo‘q") + "</div></td></tr>";
        return;
      }
      tbody.innerHTML = list.slice(0, 500).map(function (r) {
        var acts = (cfg.actions ? cfg.actions(r) : "") +
          (cfg.noEdit ? "" : '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + r.id + '">Tahrirlash</button>') +
          '<button class="btn btn-danger btn-sm" data-act="delete" data-id="' + r.id + '" aria-label="O‘chirish">O‘chirish</button>';
        return "<tr>" + cfg.columns.map(function (c) { return '<td class="' + (c.cls || "") + '" data-label="' + h(c.label) + '">' + c.render(r) + "</td>"; }).join("") + '<td class="row-actions">' + acts + "</td></tr>";
      }).join("");
    }
    search.addEventListener("input", draw);
    if (statusSel) statusSel.addEventListener("change", draw);
    draw();
    tbody.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var id = Number(b.getAttribute("data-id"));
      var row = rows.find(function (r) { return r.id === id; });
      var act = b.getAttribute("data-act");
      if (act === "edit") openForm(entity, row);
      else if (act === "delete") confirmDelete(entity, row);
      else if (act === "questions") location.hash = "#/questions/" + id;
      else if (act === "receipt") showReceipt(row);
      else if (act === "approve") reviewPayment(row, "approved");
      else if (act === "reject") reviewPayment(row, "rejected");
    });
    tbody.addEventListener("change", async function (e) {
      var sel = e.target.closest(".inline-status");
      if (!sel) return;
      sel.disabled = true;
      try {
        await api("POST", "/api/admin/save/students", { id: Number(sel.getAttribute("data-id")), data: { status: sel.value } });
        var row = rows.find(function (r) { return r.id === Number(sel.getAttribute("data-id")); });
        if (row) row.status = sel.value;
        toast("Holat saqlandi: " + STUDENT_STATUS[sel.value]);
        refreshCounts();
      } catch (err) { toast(err.message, true); }
      sel.disabled = false;
    });
  }

  /* ================================================= modal + forms */
  function modal(title, inner, opts) {
    closeModal();
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = '<div class="modal-box' + (opts && opts.wide ? " is-wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + h(title) + '"><div class="modal-head"><h2>' + h(title) + '</h2><button class="icon-btn" type="button" data-close aria-label="Yopish">' + icon("close") + "</button></div>" + inner + "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap || e.target.closest("[data-close]")) closeModal(); });
    document.addEventListener("keydown", escClose);
    var first = wrap.querySelector("input:not([type=hidden]),select,textarea");
    if (first) setTimeout(function () { first.focus(); }, 30);
    return wrap;
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    var m = document.querySelector(".modal");
    if (m) {
      m.querySelectorAll("[data-blob]").forEach(function (x) { URL.revokeObjectURL(x.getAttribute("data-blob")); });
      m.remove();
    }
    document.removeEventListener("keydown", escClose);
  }

  async function fieldHtml(f, value) {
    var v = value === undefined || value === null ? (typeof f.def === "function" ? f.def() : f.def) : value;
    if (v === undefined || v === null) v = "";
    var cls = "field" + (f.span === 2 ? " span-2" : "");
    var req = f.required ? " required" : "";
    var help = f.help ? '<small class="muted">' + h(f.help) + "</small>" : "";
    var label = '<span>' + h(f.label) + (f.required ? "" : ' <em>(ixtiyoriy)</em>') + "</span>";
    if (f.type === "bool") {
      return '<label class="check-field span-2"><input type="checkbox" name="' + f.name + '"' + (v === true || v === "true" ? " checked" : "") + "> " + h(f.label) + "</label>";
    }
    if (f.type === "textarea") {
      return '<label class="' + cls + '">' + label + '<textarea name="' + f.name + '" rows="' + (f.rows || 3) + '"' + req + ">" + h(v) + "</textarea>" + help + "</label>";
    }
    if (f.type === "select") {
      var options = await f.options();
      var empty = f.required ? '<option value="">Tanlang</option>' : '<option value="">' + h(f.empty || "Tanlanmagan") + "</option>";
      return '<label class="' + cls + '">' + label + '<select name="' + f.name + '"' + req + ">" + empty + options.map(function (o) {
        return '<option value="' + h(o.value) + '"' + (String(o.value) === String(v) ? " selected" : "") + ">" + h(o.label) + "</option>";
      }).join("") + "</select>" + help + "</label>";
    }
    if (f.type === "image") {
      var preview = v ? '<img src="' + h(v) + '" alt="">' : '<span class="ph">Rasm yo‘q</span>';
      return '<div class="' + cls + '">' + label + '<div class="image-field" data-image="' + f.name + '">' + preview +
        '<div class="image-actions"><label class="btn btn-ghost btn-sm file-pick">Rasm tanlash<input type="file" accept="image/jpeg,image/png,image/webp" data-image-input="' + f.name + '"></label><input type="hidden" name="' + f.name + '" value="' + h(v) + '">' +
        (v ? '<button class="link-btn" type="button" data-image-clear="' + f.name + '">Rasmni olib tashlash</button>' : "") + "</div></div>" + help + "</div>";
    }
    var type = { tel: "tel", number: "number", date: "date", month: "month" }[f.type] || "text";
    if (f.type === "month" && v) v = String(v).slice(0, 7);
    if (f.type === "date" && v) v = String(v).slice(0, 10);
    return '<label class="' + cls + '">' + label + '<input name="' + f.name + '" type="' + type + '" value="' + h(v) + '"' + req +
      (f.min !== undefined ? ' min="' + f.min + '"' : "") + (f.max ? ' maxlength="' + f.max + '"' : "") + (f.placeholder ? ' placeholder="' + h(f.placeholder) + '"' : "") +
      (type === "number" ? ' step="1" inputmode="numeric"' : "") + ">" + help + "</label>";
  }

  async function openForm(entity, row, extraData) {
    var cfg = ENT[entity];
    var htmlFields = [];
    for (var i = 0; i < cfg.fields.length; i++) htmlFields.push(await fieldHtml(cfg.fields[i], row ? row[cfg.fields[i].name] : undefined));
    var m = modal((row ? "Tahrirlash: " : "Yangi ") + cfg.one, '<form novalidate><div class="modal-body"><div class="form-grid">' + htmlFields.join("") +
      '</div><p class="form-status" aria-live="polite"></p></div><div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="submit">Saqlash</button></div></form>');
    var form = m.querySelector("form");
    var status = form.querySelector(".form-status");
    form.querySelectorAll("[data-image-input]").forEach(function (input) {
      input.addEventListener("change", async function () {
        var file = input.files[0];
        if (!file) return;
        var name = input.getAttribute("data-image-input");
        var box = form.querySelector('[data-image="' + name + '"]');
        status.textContent = "Rasm yuklanmoqda…"; status.className = "form-status";
        try {
          if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) throw new Error("JPG, PNG yoki WEBP rasm tanlang");
          var blob = await compressImage(file, 1600, 0.85);
          var up = await api("POST", "/api/admin/upload", { mime: blob.type || "image/jpeg", data: await toBase64(blob) });
          form.elements[name].value = up.url;
          var old = box.querySelector("img,.ph");
          var img = document.createElement("img");
          img.src = up.url; img.alt = "";
          old.replaceWith(img);
          status.textContent = "Rasm yuklandi. Saqlashni unutmang."; status.className = "form-status is-ok";
        } catch (err) { status.textContent = err.message; status.className = "form-status is-error"; input.value = ""; }
      });
    });
    form.querySelectorAll("[data-image-clear]").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-image-clear");
        form.elements[name].value = "";
        var img = form.querySelector('[data-image="' + name + '"] img');
        if (img) { var ph = document.createElement("span"); ph.className = "ph"; ph.textContent = "Rasm yo‘q"; img.replaceWith(ph); }
        b.remove();
      });
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var data = Object.assign({}, extraData || {});
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = form.elements[f.name];
        if (!el) return;
        if (f.type === "bool") { data[f.name] = el.checked; return; }
        var val = el.value.trim();
        if (f.required && val === "" && !bad) bad = el;
        if (!el.checkValidity() && !bad) bad = el;
        if (f.type === "number") data[f.name] = val === "" ? null : Number(val);
        else if (f.type === "select" && /_id$/.test(f.name)) data[f.name] = val === "" ? null : Number(val);
        else data[f.name] = val === "" ? null : val;
      });
      if (!bad && entity === "questions") {
        if (!data.option_c && data.option_d) { status.textContent = "D variantdan oldin C variantni to‘ldiring"; status.className = "form-status is-error"; return; }
        var key = { C: data.option_c, D: data.option_d }[data.correct_option];
        if ((data.correct_option === "C" || data.correct_option === "D") && !key) { status.textContent = "To‘g‘ri javob sifatida bo‘sh variant tanlangan"; status.className = "form-status is-error"; return; }
      }
      if (bad) {
        var fl = cfg.fields.find(function (f) { return f.name === bad.name; });
        status.textContent = "To‘ldiring: " + (fl ? fl.label : bad.name); status.className = "form-status is-error";
        bad.focus(); return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api("POST", "/api/admin/save/" + entity, { id: row ? row.id : null, data: data });
        closeModal();
        toast(row ? "O‘zgarishlar saqlandi" : "Qo‘shildi");
        if (cfg.onChange) cfg.onChange();
        if (entity === "students") dropLookup("students");
        if (entity === "questions") viewQuestions(extraData.test_id); else viewList(entity);
        refreshCounts();
      } catch (err) { status.textContent = err.message; status.className = "form-status is-error"; btn.disabled = false; }
    });
  }

  function confirmDelete(entity, row, after) {
    var cfg = ENT[entity];
    var m = modal("O‘chirishni tasdiqlang", '<div class="modal-body"><p>Ushbu ' + h(cfg.one) + " butunlay o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi.</p></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="button" data-yes>O‘chirish</button></div>');
    m.querySelector("[data-yes]").addEventListener("click", async function (e) {
      e.target.disabled = true;
      try {
        await api("POST", "/api/admin/delete/" + entity + "/" + row.id, {});
        closeModal();
        toast("O‘chirildi");
        if (cfg.onChange) cfg.onChange();
        if (entity === "students") dropLookup("students");
        if (after) after(); else viewList(entity);
        refreshCounts();
      } catch (err) { closeModal(); toast(err.message, true); }
    });
  }

  /* ================================================= payments review */
  async function showReceipt(row) {
    var m = modal("Chek: " + row.full_name, '<div class="modal-body"><div class="loading">Chek yuklanmoqda…</div></div>', { wide: true });
    try {
      var res = await fetch("/api/admin/receipt/" + row.id, { credentials: "same-origin" });
      if (!res.ok) { var d = {}; try { d = await res.json(); } catch (e) {} throw new Error(d.detail || "Chekni ochib bo‘lmadi"); }
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var body = m.querySelector(".modal-body");
      body.setAttribute("data-blob", url);
      body.innerHTML = (blob.type === "application/pdf" ? '<iframe class="receipt-frame" title="Chek" src="' + url + '"></iframe>' : '<img class="receipt-view" src="' + url + '" alt="To‘lov cheki">') +
        '<p class="muted" style="margin-top:12px">' + h(row.phone) + " · " + money(row.amount) + " · " + fmtMonth(row.target_month) + ' · <a class="inline-link" href="' + url + '" download="chek-' + row.id + '">Yuklab olish</a></p>';
    } catch (err) { m.querySelector(".modal-body").innerHTML = '<p class="form-status is-error">' + h(err.message) + "</p>"; }
  }
  function reviewPayment(row, status) {
    var approve = status === "approved";
    var m = modal(approve ? "To‘lovni tasdiqlash" : "To‘lovni rad etish",
      '<div class="modal-body"><p><b>' + h(row.full_name) + "</b> · " + h(row.phone) + "<br>" + money(row.amount) + " · " + h(row.course_name || "") + " · " + fmtMonth(row.target_month) + "</p>" +
      (approve ? '<p class="muted">Tasdiqlansa, to‘lov «To‘lovlar» bo‘limiga yoziladi. Shu telefon raqamli o‘quvchi bo‘lmasa, u avtomatik yaratiladi.</p>' : "") +
      '<label class="field"><span>Izoh <em>(ixtiyoriy)</em></span><input name="note" maxlength="500" placeholder="' + (approve ? "Masalan, tushum tekshirildi" : "Masalan, summa mos kelmadi") + '"></label></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn ' + (approve ? "btn-ok" : "btn-primary") + '" type="button" data-yes>' + (approve ? "Tasdiqlash" : "Rad etish") + "</button></div>");
    m.querySelector("[data-yes]").addEventListener("click", async function (e) {
      e.target.disabled = true;
      try {
        await api("POST", "/api/admin/review/" + row.id, { status: status, note: m.querySelector("[name=note]").value });
        closeModal();
        toast(approve ? "To‘lov tasdiqlandi" : "To‘lov rad etildi");
        dropLookup("students");
        viewList("payment_requests");
        refreshCounts();
      } catch (err) { e.target.disabled = false; toast(err.message, true); }
    });
  }

  /* ================================================= questions */
  async function viewQuestions(testId) {
    dropLookup("tests");
    var tests = await lookup("tests");
    var test = tests.find(function (t) { return t.id === testId; });
    var body = setTitle(test ? "Savollar: " + test.title : "Savollar",
      '<button class="btn btn-ghost" type="button" data-back>' + icon("back") + 'Testlar</button>' +
      '<button class="btn btn-ghost" type="button" data-import>' + icon("upload") + 'Fayldan yuklash</button>' +
      '<button class="btn btn-primary" type="button" data-add>' + icon("plus") + "Savol qo‘shish</button>");
    document.querySelector("[data-back]").addEventListener("click", function () { location.hash = "#/tests"; });
    document.querySelector("[data-add]").addEventListener("click", function () { openForm("questions", null, { test_id: testId }); });
    var rows;
    try { rows = await api("GET", "/api/admin/list/questions?test_id=" + testId); }
    catch (e) { body.innerHTML = '<div class="table-empty">' + h(e.message) + "</div>"; return; }
    document.querySelector("[data-import]").addEventListener("click", function () { openImport(test, rows.length); });

    var filePanel = '<section class="panel file-panel"><div class="file-panel-main">' + icon("file") + "<div>" +
      (test && test.file_name
        ? "<b>" + h(test.file_name) + '</b><label class="file-vis">O‘quvchilarga: <select data-vis>' +
          Object.keys(FILE_VIS).map(function (k) { return '<option value="' + k + '"' + (test.file_visibility === k ? " selected" : "") + ">" + h(FILE_VIS[k]) + "</option>"; }).join("") +
          "</select></label>"
        : "<b>Test fayli biriktirilmagan</b><small>Fayl biriktirsangiz, o‘quvchilar uni test sahifasida ko‘ra oladi.</small>") +
      '</div></div><div class="file-panel-actions">' +
      (test && test.file_name
        ? '<button class="btn btn-ghost btn-sm" type="button" data-file-open>Ochish</button><button class="btn btn-ghost btn-sm" type="button" data-file-replace>Almashtirish</button><button class="btn btn-danger btn-sm" type="button" data-file-remove>O‘chirish</button>'
        : '<button class="btn btn-ghost btn-sm" type="button" data-file-replace>Fayl biriktirish</button>') +
      "</div></section>";

    var list = rows.length ? '<div class="panel">' + rows.map(function (q, i) {
      return '<div class="q-item"><div><b>' + (i + 1) + ". " + h(q.question_text) + '</b><ol type="A">' + ["a", "b", "c", "d"].filter(function (k) { return q["option_" + k]; }).map(function (k) {
        return '<li class="' + (q.correct_option === k.toUpperCase() ? "is-correct" : "") + '">' + h(q["option_" + k]) + "</li>";
      }).join("") + '</ol></div><div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit="' + q.id + '">Tahrirlash</button> <button class="btn btn-danger btn-sm" data-del="' + q.id + '">O‘chirish</button></div></div>';
    }).join("") + "</div>"
      : '<div class="panel"><div class="table-empty">Bu testda hali savol yo‘q. «Fayldan yuklash» orqali Word, PDF yoki matn fayldan savollarni qo‘shing yoki «Savol qo‘shish» tugmasini bosing.</div></div>';
    body.innerHTML = filePanel + list;

    var vis = body.querySelector("[data-vis]");
    if (vis) vis.addEventListener("change", async function () {
      try { await api("POST", "/api/admin/save/tests", { id: testId, data: { file_visibility: vis.value } }); toast("Saqlandi: fayl " + FILE_VIS[vis.value]); dropLookup("tests"); }
      catch (err) { toast(err.message, true); }
    });
    var openBtn = body.querySelector("[data-file-open]");
    if (openBtn) openBtn.addEventListener("click", function () { showTestFile(test); });
    body.querySelector("[data-file-replace]").addEventListener("click", function () { openAttach(test); });
    var rm = body.querySelector("[data-file-remove]");
    if (rm) rm.addEventListener("click", function () {
      var m = modal("Faylni o‘chirish", '<div class="modal-body"><p>«' + h(test.file_name) + '» testdan olib tashlanadi. Savollar o‘chirilmaydi.</p></div><div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="button" data-yes>O‘chirish</button></div>');
      m.querySelector("[data-yes]").addEventListener("click", async function () {
        try { await api("POST", "/api/admin/tests/" + testId + "/file/remove", {}); closeModal(); toast("Fayl o‘chirildi"); viewQuestions(testId); }
        catch (err) { closeModal(); toast(err.message, true); }
      });
    });
    body.addEventListener("click", function (e) {
      var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) { var q = rows.find(function (r) { return r.id === Number(ed.getAttribute("data-edit")); }); openForm("questions", q, { test_id: testId }); }
      if (del) { var q2 = rows.find(function (r) { return r.id === Number(del.getAttribute("data-del")); }); confirmDelete("questions", q2, function () { viewQuestions(testId); }); }
    });
  }

  var DOC_ACCEPT = ".docx,.pdf,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  async function readDoc(file) {
    if (!file) throw new Error("Faylni tanlang");
    if (/\.doc$/i.test(file.name)) throw new Error("Eski .doc formati o‘qilmaydi. Word'da «Saqlash → .docx» qilib qayta yuklang");
    if (!/\.(docx|pdf|txt)$/i.test(file.name)) throw new Error("Faqat Word (.docx), PDF yoki .txt fayl yuklang");
    if (file.size > 3 * 1024 * 1024) throw new Error("Fayl hajmi 3 MB dan oshmasin");
    return { name: file.name, mime: file.type || "", data: await toBase64(file) };
  }
  function visSelect(selected) {
    return '<select name="visibility">' + Object.keys(FILE_VIS).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? " selected" : "") + ">" + h(FILE_VIS[k].charAt(0).toUpperCase() + FILE_VIS[k].slice(1)) + "</option>";
    }).join("") + "</select>";
  }

  function openImport(test, existing) {
    var m = modal("Fayldan savollarni yuklash", '<div class="modal-body imp">' +
      '<label class="field"><span>Test fayli (Word .docx, PDF yoki .txt, 3 MB gacha)</span><input type="file" name="file" accept="' + DOC_ACCEPT + '"></label>' +
      '<details class="imp-help"><summary>Fayl qanday yozilishi kerak?</summary><pre>1. Savol matni?\nA) birinchi variant\nB) ikkinchi variant\nC) uchinchi variant\nD) to‘rtinchi variant\nJavob: B</pre>' +
      '<p class="muted">Variantlar bir qatorda ham bo‘lishi mumkin: «A) 3  B) 4  C) 5  D) 6». To‘g‘ri javobni «Javob: B» qatori, variant oldidagi * yoki + belgisi, Word yoki PDF’da qalin (bold) yozuv, yoki fayl oxiridagi «Javoblar: 1-B, 2-A, …» kaliti bilan belgilang. Javob topilmagan savollar uchun keyingi qadamda o‘zingiz tanlaysiz.</p></details>' +
      '<label class="check-field"><input type="checkbox" name="attach" checked> Faylni testga biriktirish (o‘quvchilar ko‘rishi uchun)</label>' +
      '<p class="form-status" aria-live="polite"></p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="button" data-read>Faylni o‘qish</button></div>', { wide: true });
    var status = m.querySelector(".form-status");
    m.querySelector("[data-read]").addEventListener("click", async function (e) {
      var btn = e.target;
      btn.disabled = true; btn.textContent = "O‘qilmoqda…";
      status.textContent = ""; status.className = "form-status";
      try {
        var doc = await readDoc(m.querySelector("[name=file]").files[0]);
        var res = await api("POST", "/api/admin/tests/" + test.id + "/parse", doc);
        showImportPreview(test, existing, doc, res, m.querySelector("[name=attach]").checked);
      } catch (err) {
        status.textContent = err.message; status.className = "form-status is-error";
        btn.disabled = false; btn.textContent = "Faylni o‘qish";
      }
    });
  }

  function showImportPreview(test, existing, doc, res, attach) {
    var qs = res.questions;
    var defVis = res.with_answers > 0 ? "after" : "always";
    var items = qs.map(function (q, i) {
      var opts = ["A", "B", "C", "D"].filter(function (l) { return q["option_" + l.toLowerCase()]; });
      return '<div class="imp-q' + (q.correct_option ? "" : " is-missing") + '" data-i="' + i + '">' +
        '<label class="imp-q-head"><input type="checkbox" data-take checked><b>' + (i + 1) + ". " + h(q.question_text) + "</b></label>" +
        '<div class="imp-opts">' + opts.map(function (l) {
          return '<label class="imp-opt"><input type="radio" name="c' + i + '" value="' + l + '"' + (q.correct_option === l ? " checked" : "") + '><span class="option-key">' + l + "</span><span>" + h(q["option_" + l.toLowerCase()]) + "</span></label>";
        }).join("") + "</div>" +
        (q.correct_option ? '<small class="muted">To‘g‘ri javob: ' + q.correct_option + " (" + h(q.source || "") + ")</small>" : '<small class="imp-miss">To‘g‘ri javobni belgilang</small>') +
        "</div>";
    }).join("");
    var m = modal("Topilgan savollar: " + qs.length + " ta", '<div class="modal-body imp">' +
      '<p class="imp-summary"><b>' + qs.length + " ta savol</b> topildi, " + res.with_answers + " tasida to‘g‘ri javob aniqlandi." + (qs.length - res.with_answers ? " Qolganlari uchun javobni belgilang." : "") + "</p>" +
      (res.warnings.length ? '<details class="imp-warn"' + (res.warnings.length < 6 ? " open" : "") + "><summary>" + res.warnings.length + " ta eslatma</summary><ul>" + res.warnings.map(function (w) { return "<li>" + h(w) + "</li>"; }).join("") + "</ul></details>" : "") +
      '<div class="imp-list">' + items + "</div>" +
      '<div class="imp-settings">' +
      (existing ? '<label class="check-field"><input type="checkbox" name="replace"> Testdagi mavjud ' + existing + " ta savolni o‘chirib, yangilari bilan almashtirish</label>" : "") +
      (attach ? '<label class="field"><span>«' + h(doc.name) + '» fayli o‘quvchilarga</span>' + visSelect(defVis) +
        (res.with_answers > 0 ? '<small class="muted">Faylda to‘g‘ri javoblar bor, shuning uchun uni testdan keyin ochish tavsiya etiladi.</small>' : "") + "</label>" : "") +
      '</div><p class="form-status" aria-live="polite"></p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="button" data-save>Savollarni qo‘shish</button></div>', { wide: true });
    var status = m.querySelector(".form-status");
    var saveBtn = m.querySelector("[data-save]");
    function refresh() {
      var n = m.querySelectorAll(".imp-q [data-take]:checked").length;
      saveBtn.textContent = n ? n + " ta savolni qo‘shish" : "Savol tanlanmagan";
      saveBtn.disabled = !n;
      m.querySelectorAll(".imp-q").forEach(function (card) {
        var picked = card.querySelector("input[type=radio]:checked");
        card.classList.toggle("is-missing", !picked && card.querySelector("[data-take]").checked);
        card.classList.toggle("is-off", !card.querySelector("[data-take]").checked);
        var miss = card.querySelector(".imp-miss, .imp-picked");
        if (miss) {
          miss.textContent = picked ? "Tanlandi: " + picked.value : "To‘g‘ri javobni belgilang";
          miss.className = picked ? "imp-picked" : "imp-miss";
        }
      });
    }
    m.addEventListener("change", refresh);
    refresh();
    saveBtn.addEventListener("click", async function () {
      var chosen = [], missing = null;
      m.querySelectorAll(".imp-q").forEach(function (card) {
        if (!card.querySelector("[data-take]").checked) return;
        var i = Number(card.getAttribute("data-i"));
        var picked = card.querySelector("input[type=radio]:checked");
        if (!picked && !missing) missing = card;
        var q = Object.assign({}, qs[i], { correct_option: picked ? picked.value : null });
        chosen.push(q);
      });
      if (missing) { status.textContent = "Belgilanmagan savollar bor — to‘g‘ri javobni tanlang yoki savolni ro‘yxatdan olib tashlang"; status.className = "form-status is-error"; missing.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      saveBtn.disabled = true; saveBtn.textContent = "Saqlanmoqda…";
      try {
        var r = await api("POST", "/api/admin/tests/" + test.id + "/import", { questions: chosen, replace: !!(m.querySelector("[name=replace]") || {}).checked });
        if (attach) {
          await api("POST", "/api/admin/tests/" + test.id + "/file", Object.assign({}, doc, { visibility: m.querySelector("[name=visibility]").value }));
        }
        closeModal();
        toast(r.added + " ta savol qo‘shildi" + (attach ? ", fayl biriktirildi" : ""));
        dropLookup("tests");
        viewQuestions(test.id);
      } catch (err) {
        status.textContent = err.message; status.className = "form-status is-error";
        saveBtn.disabled = false; refresh();
      }
    });
  }

  function openAttach(test) {
    var m = modal(test.file_name ? "Faylni almashtirish" : "Fayl biriktirish", '<div class="modal-body">' +
      '<label class="field"><span>Fayl (Word .docx, PDF yoki .txt, 3 MB gacha)</span><input type="file" name="file" accept="' + DOC_ACCEPT + '"></label>' +
      '<label class="field"><span>O‘quvchilarga</span>' + visSelect(test.file_visibility || "after") + "</label>" +
      '<p class="muted">Savollar o‘zgarmaydi. Fayldan savol qo‘shish uchun «Fayldan yuklash» tugmasidan foydalaning.</p>' +
      '<p class="form-status" aria-live="polite"></p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Bekor qilish</button><button class="btn btn-primary" type="button" data-save>Saqlash</button></div>');
    m.querySelector("[data-save]").addEventListener("click", async function (e) {
      var st = m.querySelector(".form-status");
      e.target.disabled = true;
      try {
        var doc = await readDoc(m.querySelector("[name=file]").files[0]);
        await api("POST", "/api/admin/tests/" + test.id + "/file", Object.assign(doc, { visibility: m.querySelector("[name=visibility]").value }));
        closeModal(); toast("Fayl saqlandi"); dropLookup("tests"); viewQuestions(test.id);
      } catch (err) { st.textContent = err.message; st.className = "form-status is-error"; e.target.disabled = false; }
    });
  }

  async function showTestFile(test) {
    try {
      var res = await fetch("/api/admin/tests/" + test.id + "/file", { credentials: "same-origin" });
      if (!res.ok) { var d = {}; try { d = await res.json(); } catch (e) {} throw new Error(d.detail || "Faylni ochib bo‘lmadi"); }
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var isPdf = blob.type === "application/pdf";
      var m = modal(test.file_name, '<div class="modal-body" data-blob="' + url + '">' +
        (isPdf ? '<iframe class="receipt-frame" title="Test fayli" src="' + url + '"></iframe>' : '<p class="muted">Word va matn fayllarini brauzerda oldindan ko‘rib bo‘lmaydi — yuklab oling. O‘quvchilar uni saytda matn ko‘rinishida o‘qiydi.</p>') +
        '<p style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="' + url + '" download="' + h(test.file_name) + '">Yuklab olish</a> ' +
        (test.file_visibility === "always" ? '<a class="btn btn-ghost btn-sm" href="/tests/' + test.id + '/file" target="_blank" rel="noopener">O‘quvchi ko‘rinishi</a>' : "") + "</p></div>", { wide: true });
    } catch (err) { toast(err.message, true); }
  }

  /* ================================================= settings */
  var SETTINGS = [
    { title: "Bosh sahifa", help: "Saytning birinchi ekranidagi matnlar va raqamlar. Raqam bo‘sh qoldirilsa, u ko‘rsatilmaydi.", fields: [
      ["center_name", "Markaz nomi"], ["hero_title", "Asosiy sarlavha"], ["hero_text", "Sarlavha ostidagi matn", "textarea"],
      ["stat_students", "O‘quvchilar soni (masalan, 600+)"], ["stat_teachers", "Ustozlar soni"], ["stat_success", "Natija ko‘rsatkichi (masalan, 96%)"]] },
    { title: "Markaz haqida", fields: [["about_title", "Sarlavha"], ["about_text", "Matn", "textarea"]] },
    { title: "Aloqa", help: "Bo‘sh qoldirilgan aloqa ma’lumotlari saytda ko‘rsatilmaydi.", fields: [
      ["phone", "Telefon"], ["email", "Email"], ["address", "Manzil"], ["map_url", "Xarita havolasi (https://…)"],
      ["working_hours", "Ish vaqti"], ["telegram", "Telegram (@username yoki havola)"], ["instagram", "Instagram (@username yoki havola)"]] },
    { title: "To‘lov kartalari", help: "To‘lov sahifasida ko‘rinadi. Faqat karta raqami va egasining ismini kiriting.", fields: [
      ["card_number_1", "1-karta raqami"], ["card_holder_1", "1-karta egasi"], ["card_number_2", "2-karta raqami"], ["card_holder_2", "2-karta egasi"],
      ["card_number_3", "3-karta raqami"], ["card_holder_3", "3-karta egasi"]] }
  ];
  async function viewSettings() {
    var body = setTitle("Sayt sozlamalari");
    var s;
    try { s = await api("GET", "/api/admin/list/settings"); }
    catch (e) { body.innerHTML = '<div class="table-empty">' + h(e.message) + "</div>"; return; }
    body.innerHTML = '<form class="panel" novalidate>' + SETTINGS.map(function (sec) {
      return '<section class="settings-section"><h2>' + h(sec.title) + "</h2>" + (sec.help ? '<p class="muted">' + h(sec.help) + "</p>" : "") + '<div class="form-grid">' +
        sec.fields.map(function (f) {
          var v = s[f[0]] || "";
          return f[2] === "textarea"
            ? '<label class="field span-2"><span>' + h(f[1]) + '</span><textarea name="' + f[0] + '" rows="4" maxlength="4000">' + h(v) + "</textarea></label>"
            : '<label class="field"><span>' + h(f[1]) + '</span><input name="' + f[0] + '" value="' + h(v) + '" maxlength="400"></label>';
        }).join("") + "</div></section>";
    }).join("") + '<div class="modal-foot"><p class="form-status" aria-live="polite" style="margin:0 auto 0 0"></p><button class="btn btn-primary" type="submit">Sozlamalarni saqlash</button></div></form>';
    var form = body.querySelector("form");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name) data[el.name] = el.value.trim(); });
      var mapUrl = data.map_url;
      var st = form.querySelector(".form-status");
      if (mapUrl && mapUrl.indexOf("https://") !== 0) { st.textContent = "Xarita havolasi https:// bilan boshlanishi kerak"; st.className = "form-status is-error"; return; }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api("POST", "/api/admin/settings", { settings: data });
        st.textContent = "Saqlandi. Saytda bir daqiqa ichida yangilanadi."; st.className = "form-status is-ok";
        toast("Sozlamalar saqlandi");
      } catch (err) { st.textContent = err.message; st.className = "form-status is-error"; }
      btn.disabled = false;
    });
  }

  /* ================================================= admins */
  async function viewAdmins() {
    var body = setTitle("Adminlar va parol");
    var rows;
    try { rows = await api("GET", "/api/admin/list/admins"); }
    catch (e) { body.innerHTML = '<div class="table-empty">' + h(e.message) + "</div>"; return; }
    body.innerHTML = '<div class="dash-grid">' +
      '<section class="panel"><div class="panel-head"><h2>Parolni o‘zgartirish</h2></div><form class="modal-body" data-pass novalidate>' +
      '<label class="field"><span>Joriy parol</span><input type="password" name="old" required autocomplete="current-password"></label>' +
      '<label class="field"><span>Yangi parol (kamida 10 belgi)</span><input type="password" name="new" required minlength="10" autocomplete="new-password"></label>' +
      '<label class="field"><span>Yangi parolni takrorlang</span><input type="password" name="new2" required minlength="10" autocomplete="new-password"></label>' +
      '<button class="btn btn-primary" type="submit" style="margin-top:16px">Parolni saqlash</button><p class="form-status"></p></form></section>' +
      '<section class="panel"><div class="panel-head"><h2>Yangi admin qo‘shish</h2></div><form class="modal-body" data-new novalidate>' +
      '<label class="field"><span>Ism</span><input name="full_name" maxlength="120"></label>' +
      '<label class="field"><span>Login (lotin harflari)</span><input name="username" required autocapitalize="off" spellcheck="false" pattern="[a-zA-Z0-9_.\\-]{3,40}"></label>' +
      '<label class="field"><span>Parol (kamida 10 belgi)</span><input type="password" name="password" required minlength="10" autocomplete="new-password"></label>' +
      '<button class="btn btn-primary" type="submit" style="margin-top:16px">Admin qo‘shish</button><p class="form-status"></p></form></section></div>' +
      '<h2 style="margin:28px 0 12px;font-size:19px">Adminlar</h2><div class="table-wrap"><table class="table"><thead><tr><th>Login</th><th>Ism</th><th>Oxirgi kirish</th><th>Holat</th><th></th></tr></thead><tbody>' +
      rows.map(function (a) {
        var self = state.me && a.id === state.me.id;
        return "<tr><td class=\"cell-main\">" + h(a.username) + (self ? ' <span class="badge">Siz</span>' : "") + "</td><td>" + h(a.full_name || "—") + '</td><td class="cell-sub">' + fmtDate(a.last_login_at) + "</td><td>" +
          (a.is_active ? badge("ok", { ok: "Faol" }) : badge("off", { off: "O‘chirilgan" })) + '</td><td class="row-actions">' +
          (self ? "" : '<button class="btn btn-ghost btn-sm" data-toggle="' + a.id + '" data-active="' + (a.is_active ? "0" : "1") + '">' + (a.is_active ? "Bloklash" : "Faollashtirish") + "</button>") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    var pass = body.querySelector("[data-pass]");
    pass.addEventListener("submit", async function (e) {
      e.preventDefault();
      var st = pass.querySelector(".form-status");
      if (pass.elements["new"].value.length < 10) { st.textContent = "Yangi parol kamida 10 ta belgidan iborat bo‘lsin"; st.className = "form-status is-error"; return; }
      if (pass.elements["new"].value !== pass.elements.new2.value) { st.textContent = "Yangi parollar bir xil emas"; st.className = "form-status is-error"; return; }
      try {
        await api("POST", "/api/admin/password", { old: pass.elements.old.value, "new": pass.elements["new"].value });
        pass.reset(); st.textContent = "Parol o‘zgartirildi. Boshqa qurilmalardagi sessiyalar yopildi."; st.className = "form-status is-ok";
      } catch (err) { st.textContent = err.message; st.className = "form-status is-error"; }
    });
    var nf = body.querySelector("[data-new]");
    nf.addEventListener("submit", async function (e) {
      e.preventDefault();
      var st = nf.querySelector(".form-status");
      try {
        await api("POST", "/api/admin/admins", { username: nf.elements.username.value, password: nf.elements.password.value, full_name: nf.elements.full_name.value });
        toast("Admin qo‘shildi"); viewAdmins();
      } catch (err) { st.textContent = err.message; st.className = "form-status is-error"; }
    });
    body.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.addEventListener("click", async function () {
        try {
          await api("POST", "/api/admin/admins/" + b.getAttribute("data-toggle") + "/active", { active: b.getAttribute("data-active") === "1" });
          viewAdmins();
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  /* ================================================= boot */
  (async function boot() {
    try {
      var res = await fetch("/api/admin/me", { credentials: "same-origin", headers: { "X-Requested-With": "fetch" } });
      if (res.ok) { state.me = await res.json(); renderShell(); }
      else renderLogin();
    } catch (e) { renderLogin("Internet aloqasini tekshiring"); }
  })();
})();
