/* Algoritm o‘quv markazi — sayt skripti */
(function () {
  "use strict";
  window.__alg = true;
  var root = document.documentElement;

  /* ---------- toast */
  var toastTimer;
  function toast(text, isError) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4200);
  }

  /* ---------- theme */
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("alg-theme", next); } catch (e) {}
    });
  });

  /* ---------- mobile menu */
  var menuBtn = document.querySelector("[data-menu-toggle]");
  if (menuBtn) {
    var setMenu = function (open) {
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Menyuni yopish" : "Menyuni ochish");
    };
    menuBtn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    document.querySelectorAll(".main-nav a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    window.addEventListener("resize", function () { if (innerWidth > 860) setMenu(false); });
  }

  /* ---------- phone formatting */
  function formatPhone(value) {
    var d = String(value || "").replace(/\D/g, "");
    if (d.length === 9) d = "998" + d;
    if (d.length === 12 && d.indexOf("998") === 0) {
      return "+998 " + d.slice(3, 5) + " " + d.slice(5, 8) + " " + d.slice(8, 10) + " " + d.slice(10, 12);
    }
    return value;
  }
  document.querySelectorAll("[data-phone]").forEach(function (input) {
    input.addEventListener("blur", function () { input.value = formatPhone(input.value); });
  });
  function phoneOk(value) {
    var d = String(value || "").replace(/\D/g, "");
    return d.length === 9 || (d.length >= 10 && d.length <= 15);
  }

  /* ---------- copy */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () { toast("Karta raqami nusxalandi"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { toast("Nusxalab bo‘lmadi. Raqamni qo‘lda yozib oling", true); });
      } else {
        var t = document.createElement("textarea");
        t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        t.remove();
      }
    });
  });

  /* ---------- filter */
  document.querySelectorAll("[data-filter]").forEach(function (input) {
    var selector = input.getAttribute("data-filter");
    var empty = document.querySelector(".filter-empty");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      document.querySelectorAll(selector).forEach(function (el) {
        var match = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
        el.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  });

  /* ---------- course price → amount */
  document.querySelectorAll("select[data-price-target]").forEach(function (select) {
    var form = select.form;
    var target = form && form.elements[select.getAttribute("data-price-target")];
    if (!target) return;
    var auto = true;
    target.addEventListener("input", function () { auto = false; });
    select.addEventListener("change", function () {
      var opt = select.options[select.selectedIndex];
      var price = opt && Number(opt.getAttribute("data-price"));
      if ((auto || !target.value) && price > 0) { target.value = price; auto = true; }
    });
  });

  /* ---------- files */
  var MAX_FILE = 3 * 1024 * 1024;
  function readAsDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error("Faylni o‘qib bo‘lmadi")); };
      r.readAsDataURL(blob);
    });
  }
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1 && file.size < 900 * 1024) { URL.revokeObjectURL(url); resolve(file); return; }
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob && blob.size < file.size ? blob : file); }, "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function encodeFile(file) {
    var allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.indexOf(file.type) === -1) throw new Error("Faqat JPG, PNG, WEBP yoki PDF fayl yuklang");
    var blob = file;
    if (file.type !== "application/pdf") blob = await compressImage(file, 1800, 0.85);
    if (blob.size > MAX_FILE) throw new Error("Fayl hajmi 3 MB dan oshmasin");
    var dataUrl = await readAsDataURL(blob);
    return { type: blob.type || file.type, data: dataUrl.split(",")[1] || "" };
  }
  document.querySelectorAll('.file-field input[type="file"]').forEach(function (input) {
    var label = input.closest(".file-field").querySelector("[data-file-label]");
    var initial = label ? label.textContent : "";
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (label) label.textContent = f ? f.name + " (" + Math.ceil(f.size / 1024) + " KB)" : initial;
    });
  });

  /* ---------- request */
  async function post(url, body) {
    var res;
    try {
      res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("Internetga ulanishni tekshiring va qayta urinib ko‘ring");
    }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.detail || "So‘rov bajarilmadi. Qayta urinib ko‘ring");
    return data;
  }

  function validate(form) {
    var firstBad = null;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "submit") return;
      var bad = !el.checkValidity() || (el.hasAttribute("data-phone") && el.value && !phoneOk(el.value));
      if (el.type === "radio") return;
      el.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !firstBad) firstBad = el;
    });
    return firstBad;
  }
  function fieldMessage(el) {
    if (el.hasAttribute("data-phone")) return "Telefon raqamini to‘liq kiriting, masalan: +998 90 123 45 67";
    if (el.type === "file") return "To‘lov chekini yuklang";
    if (el.tagName === "SELECT") return "Kursni tanlang";
    if (el.name === "full_name") return "Ism va familiyani kiriting";
    if (el.name === "amount") return "To‘lov summasini kiriting";
    if (el.name === "payer_card_last4") return "Karta raqamining oxirgi 4 ta raqamini kiriting";
    return "Maydonlarni to‘ldiring";
  }
  function setStatus(form, text, kind) {
    var s = form.querySelector(".form-status");
    if (!s) return;
    s.textContent = text || "";
    s.className = "form-status" + (kind ? " is-" + kind : "");
  }

  document.querySelectorAll(".js-form").forEach(function (form) {
    form.addEventListener("input", function (e) {
      if (e.target.getAttribute("aria-invalid") === "true" && e.target.checkValidity()) e.target.setAttribute("aria-invalid", "false");
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var bad = validate(form);
      if (bad) { setStatus(form, fieldMessage(bad), "error"); bad.focus(); return; }
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Yuborilmoqda…"; }
      setStatus(form, "");
      try {
        var body = {};
        var fileField = form.getAttribute("data-file");
        Array.prototype.forEach.call(form.elements, function (el) {
          if (el.name && el.type !== "file" && el.type !== "submit") body[el.name] = el.value;
        });
        if (fileField) {
          var f = form.elements[fileField].files[0];
          var enc = await encodeFile(f);
          body.receipt_type = enc.type;
          body.receipt_base64 = enc.data;
        }
        await post(form.getAttribute("data-endpoint"), body);
        var msg = form.getAttribute("data-success") || "Yuborildi";
        form.innerHTML = '<div class="form-done"><div class="done-ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>Rahmat!</h2><p class="muted"></p><a class="btn btn-ghost" href="/">Bosh sahifaga qaytish</a></div>';
        form.querySelector(".form-done p").textContent = msg;
        toast(msg);
      } catch (err) {
        setStatus(form, err.message, "error");
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  });


  /* ---------- 3D: sahna, egilish, paydo bo‘lish */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;

  var scene = document.querySelector("[data-scene]");
  if (scene && !reduce) {
    var rig = scene.querySelector(".scene-rig");
    var area = scene.closest(".hero") || scene;
    if (finePointer) {
      area.addEventListener("pointermove", function (e) {
        var r = scene.getBoundingClientRect();
        var x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
        var y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
        rig.style.setProperty("--ry", (x * 22).toFixed(2) + "deg");
        rig.style.setProperty("--rx", (-y * 14).toFixed(2) + "deg");
      });
      area.addEventListener("pointerleave", function () {
        rig.style.setProperty("--ry", "0deg");
        rig.style.setProperty("--rx", "0deg");
      });
    } else {
      // Sensorli ekranlarda sahifa aylantirilganda sahna sekin buriladi
      var ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var p = Math.min(1, window.scrollY / 600);
          rig.style.setProperty("--ry", (p * 40).toFixed(2) + "deg");
          rig.style.setProperty("--rx", (-p * 10).toFixed(2) + "deg");
          ticking = false;
        });
      }, { passive: true });
    }
  }

  if (finePointer && !reduce) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      var max = el.classList.contains("pay-card") ? 10 : 7;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add("is-tilting");
        el.style.setProperty("--ty", ((x - 0.5) * 2 * max).toFixed(2) + "deg");
        el.style.setProperty("--tx", ((0.5 - y) * 2 * max).toFixed(2) + "deg");
        el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("is-tilting");
        el.style.setProperty("--tx", "0deg");
        el.style.setProperty("--ty", "0deg");
      });
    });
  }

  var groups = document.querySelectorAll("[data-reveal-group]");
  function settle(el, delay) {
    el.classList.add("is-in");
    setTimeout(function () { el.classList.remove("is-in"); el.classList.add("is-done"); }, 1000 + delay);
  }
  if (groups.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      groups.forEach(function (g) { Array.prototype.forEach.call(g.children, function (c) { c.classList.add("is-done"); }); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          var d = Number(en.target.style.getPropertyValue("--d")) || 0;
          settle(en.target, d * 90);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      groups.forEach(function (g) {
        Array.prototype.forEach.call(g.children, function (c, i) {
          c.style.setProperty("--d", String(i % 6));
          io.observe(c);
        });
      });
    }
  }

  function countUp(el, target) {
    if (reduce) { el.textContent = target + "%"; return; }
    var start = performance.now(), dur = 1100;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + "%";
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ---------- tests */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(s);
  }
  function collectAnswers(form) {
    var answers = {}, missing = [];
    form.querySelectorAll(".question").forEach(function (q) {
      var c = q.querySelector("input:checked");
      if (c) answers[c.name.slice(2)] = c.value; else missing.push(q);
    });
    return { answers: answers, missing: missing };
  }
  var FILE_SVG = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';

  /* Test yakunidagi reyting: eng yaxshi ishlaganlar va o‘quvchining o‘rni */
  function leaderboard(lb, r) {
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var wrap = el("section", "lb");
    wrap.setAttribute("aria-label", "Test reytingi");
    var head = el("div", "lb-head");
    head.appendChild(el("h3", null, "Reyting"));
    head.appendChild(el("span", "lb-count", lb.participants + " ta ishtirokchi"));
    wrap.appendChild(head);
    var rank = lb.your_rank;
    if (rank) {
      var you = el("p", "lb-you" + (rank <= 3 ? " is-top" : ""));
      you.appendChild(document.createTextNode(rank === 1 ? "Tabriklaymiz! Sizning o‘rningiz: " : "Sizning o‘rningiz: "));
      you.appendChild(el("b", null, rank + "-o‘rin"));
      wrap.appendChild(you);
      if (!lb.this_attempt_counts) {
        wrap.appendChild(el("p", "lb-note", r.overtime
          ? "Bu urinish vaqt tugagandan keyin yuborilgani uchun reytingga kirmadi — o‘rningiz oldingi eng yaxshi natijangiz bo‘yicha."
          : "Reytingda har bir o‘quvchining eng yaxshi natijasi hisobga olinadi."));
      }
    } else if (r.overtime) {
      wrap.appendChild(el("p", "lb-note", "Javoblar vaqt tugagandan keyin yuborilgani uchun natija reytingga kirmadi."));
    }
    var timed = (lb.top || []).concat(lb.you ? [lb.you] : []).some(function (x) { return x.duration_seconds != null; });
    var list = el("ol", "lb-list");
    function row(x, i) {
      var li = el("li", "lb-row" + (x.is_you ? " is-you" : ""));
      li.style.setProperty("--i", i);
      li.appendChild(el("span", "rank" + (x.rank <= 3 ? " rank-" + x.rank : ""), String(x.rank)));
      var name = el("span", "lb-name");
      name.appendChild(el("span", "lb-n", x.name));
      if (x.is_you) name.appendChild(el("em", "lb-me", "Siz"));
      li.appendChild(name);
      li.appendChild(el("span", "lb-score", Math.round(Number(x.percentage)) + "%"));
      if (timed) li.appendChild(el("span", "lb-time", x.duration_seconds != null ? clock(x.duration_seconds) : "—"));
      li.title = x.correct + " / " + x.total + " to‘g‘ri javob";
      return li;
    }
    (lb.top || []).forEach(function (x, i) { list.appendChild(row(x, i)); });
    if (lb.you) {
      var gap = el("li", "lb-gap", "···"); gap.setAttribute("aria-hidden", "true"); list.appendChild(gap);
      list.appendChild(row(lb.you, (lb.top || []).length + 1));
    }
    if (list.children.length) wrap.appendChild(list);
    return wrap;
  }

  function showResult(form, r) {
    var box = form.parentElement.querySelector(".test-result");
    var tid = form.getAttribute("data-test-id");
    var pct = Math.round(Number(r.percentage));
    var verdict = pct >= 85 ? "Ajoyib natija!" : pct >= 60 ? "Yaxshi natija." : "Mashq qilishda davom eting.";
    box.innerHTML = '<h2></h2><div class="result-score"></div><p class="muted"></p><div class="actions actions-center"><a class="btn btn-primary" href="/register">Kursga yozilish</a><a class="btn btn-ghost" href="/tests">Boshqa testlar</a></div>';
    box.querySelector("h2").textContent = verdict;
    countUp(box.querySelector(".result-score"), pct);
    box.querySelector("p").textContent = r.total + " ta savoldan " + r.correct + " tasiga to‘g‘ri javob berdingiz.";
    if (r.limit_seconds) {
      var t = document.createElement("p");
      t.className = "result-time" + (r.overtime ? " is-over" : "");
      t.textContent = "Sarflangan vaqt: " + clock(r.duration_seconds || 0) + " (ajratilgan vaqt: " + clock(r.limit_seconds) + ")" +
        (r.overtime ? " — javoblar vaqt tugagandan keyin yuborildi" : "");
      box.insertBefore(t, box.querySelector(".actions"));
    }
    if (r.leaderboard) box.insertBefore(leaderboard(r.leaderboard, r), box.querySelector(".actions"));
    if (r.file_token || r.file_open) {
      var a = document.createElement("a");
      a.className = "btn btn-ghost";
      a.href = "/tests/" + tid + "/file" + (r.file_token ? "?t=" + encodeURIComponent(r.file_token) : "");
      a.textContent = "Test faylini ko‘rish";
      box.querySelector(".actions").appendChild(a);
    }
    form.hidden = true; box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function trackProgress(form, total) {
    var progress = form.querySelector("[data-progress]");
    function update() {
      var n = form.querySelectorAll(".question input:checked").length;
      if (progress) progress.textContent = n + " / " + total() + " javob berildi";
    }
    form.addEventListener("change", update);
    return update;
  }

  /* Oddiy (vaqtsiz) test */
  document.querySelectorAll(".js-test:not(.timed-form)").forEach(function (form) {
    trackProgress(form, function () { return form.querySelectorAll(".question").length; });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.elements.full_name, phone = form.elements.phone;
      if (!name.checkValidity()) { setStatus(form, "Ism va familiyani kiriting", "error"); name.focus(); return; }
      if (!phoneOk(phone.value)) { setStatus(form, "Telefon raqamini to‘liq kiriting", "error"); phone.focus(); return; }
      var got = collectAnswers(form);
      if (got.missing.length) {
        setStatus(form, "Barcha savollarga javob bering", "error");
        got.missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
      try {
        var r = await post("/api/tests/" + form.getAttribute("data-test-id") + "/submit",
          { full_name: name.value, phone: phone.value, answers: got.answers });
        showResult(form, r);
      } catch (err) {
        setStatus(form, err.message, "error");
        btn.disabled = false; btn.textContent = "Testni yakunlash";
      }
    });
  });

  /* Vaqtli test: savolli yoki faqat fayldan iborat */
  document.querySelectorAll("[data-timed]").forEach(function (box) {
    var tid = box.getAttribute("data-test-id");
    var kind = box.getAttribute("data-kind");
    var mode = box.getAttribute("data-mode");
    var startForm = box.querySelector(".js-timed-start");
    var bar = box.querySelector("[data-timer]");
    var leftEl = box.querySelector("[data-timer-left]");
    var fill = box.querySelector("[data-timer-fill]");
    var announce = box.querySelector("[data-timer-announce]");
    var qForm = box.querySelector(".timed-form");
    var doc = box.querySelector("[data-doc]");
    var over = box.querySelector("[data-over]");
    var chip = document.querySelector("[data-file-chip]");
    var chipHTML = chip ? chip.outerHTML : "";
    var key = "alg-timed-" + tid;
    var state = null, timer = null, said = {}, finishing = false, confirmSkip = false;

    function save() { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }
    function forget() { try { sessionStorage.removeItem(key); } catch (e) {} }
    function remaining() { return state ? (state.deadline - Date.now()) / 1000 : 0; }

    /* daqiqa tanlash */
    if (startForm && mode === "student") {
      var custom = startForm.querySelector(".minute-custom");
      startForm.addEventListener("change", function (e) {
        if (e.target.name !== "minutes") return;
        custom.hidden = e.target.value !== "custom";
        if (!custom.hidden) custom.querySelector("input").focus();
      });
    }
    function chosenMinutes() {
      if (mode !== "student") return null;
      var c = startForm.querySelector('input[name="minutes"]:checked');
      if (!c) return NaN;
      if (c.value !== "custom") return Number(c.value);
      var v = startForm.elements.custom_minutes.value.trim();
      return /^\d+$/.test(v) ? Number(v) : NaN;
    }

    function setChip(token, note) {
      if (!chip) return;
      var name = chip.querySelector("b") ? chip.querySelector("b").textContent : "Test fayli";
      var fresh;
      if (token) {
        fresh = document.createElement("a");
        fresh.className = "file-chip is-open";
        fresh.href = "/tests/" + tid + "/file?t=" + encodeURIComponent(token);
        fresh.target = "_blank"; fresh.rel = "noopener";
        fresh.innerHTML = FILE_SVG + "<span><b></b><small></small></span>";
        fresh.querySelector("b").textContent = name;
        fresh.querySelector("small").textContent = (chip.getAttribute("data-kind") || "Test") + " faylini ko‘rish · vaqt tugaguncha ochiq";
      } else {
        var holder = document.createElement("div");
        holder.innerHTML = chipHTML;
        fresh = holder.firstElementChild;
        if (note) fresh.querySelector("small").textContent = note;
      }
      fresh.setAttribute("data-file-chip", "");
      fresh.setAttribute("data-kind", chip.getAttribute("data-kind") || "");
      chip.replaceWith(fresh);
      chip = fresh;
    }

    function paint() {
      var left = remaining();
      leftEl.textContent = clock(left);
      var ratio = state.limit ? Math.max(0, Math.min(1, left / state.limit)) : 0;
      fill.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
      bar.classList.toggle("is-warn", left <= Math.max(60, Math.min(300, state.limit * 0.2)) && left > 60);
      bar.classList.toggle("is-danger", left <= 60);
      [[300, "5 daqiqa qoldi"], [60, "1 daqiqa qoldi"]].forEach(function (m) {
        if (state.limit > m[0] * 2 && left <= m[0] && left > m[0] - 2 && !said[m[0]]) {
          said[m[0]] = true;
          announce.textContent = m[1];
          toast(m[1]);
        }
      });
      if (left <= 0) timeUp();
    }
    function run() {
      clearInterval(timer);
      bar.hidden = false;
      bar.classList.remove("is-over");
      paint();
      timer = setInterval(paint, 250);
    }
    function stop() { clearInterval(timer); timer = null; }

    /* --- savolli test */
    function renderQuestions() {
      var wrap = qForm.querySelector("[data-questions]");
      wrap.textContent = "";
      state.questions.forEach(function (q, i) {
        var fs = document.createElement("fieldset");
        fs.className = "question";
        var lg = document.createElement("legend");
        var num = document.createElement("span");
        num.className = "q-num"; num.textContent = String(i + 1);
        lg.appendChild(num); lg.appendChild(document.createTextNode(q.text || ""));
        fs.appendChild(lg);
        ["a", "b", "c", "d"].forEach(function (k) {
          var text = String(q[k] || "").trim();
          if (!text) return;
          var lab = document.createElement("label");
          lab.className = "option";
          var inp = document.createElement("input");
          inp.type = "radio"; inp.name = "q_" + q.id; inp.value = k.toUpperCase();
          if (state.answers[q.id] === inp.value) inp.checked = true;
          var keyEl = document.createElement("span");
          keyEl.className = "option-key"; keyEl.textContent = k.toUpperCase();
          var tx = document.createElement("span"); tx.textContent = text;
          lab.appendChild(inp); lab.appendChild(keyEl); lab.appendChild(tx);
          fs.appendChild(lab);
        });
        wrap.appendChild(fs);
      });
      var person = qForm.querySelector("[data-person]");
      person.textContent = "";
      var b = document.createElement("b"); b.textContent = state.name || "";
      var sp = document.createElement("span"); sp.textContent = state.phone || "";
      person.appendChild(b); person.appendChild(sp);
    }
    var updateProgress = qForm ? trackProgress(qForm, function () { return state ? state.questions.length : 0; }) : null;
    if (qForm) {
      qForm.addEventListener("change", function (e) {
        if (!state || !e.target.name || e.target.name.indexOf("q_") !== 0) return;
        state.answers[e.target.name.slice(2)] = e.target.value;
        confirmSkip = false;
        save();
      });
      qForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var got = collectAnswers(qForm);
        if (got.missing.length && !confirmSkip) {
          confirmSkip = true;
          setStatus(qForm, got.missing.length + " ta savolga javob bermadingiz. Shunday yakunlash uchun tugmani yana bir marta bosing.", "error");
          got.missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        finishQuestions(false);
      });
    }
    async function finishQuestions(auto) {
      if (finishing || !state) return;
      finishing = true;
      var btn = qForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
      if (auto) {
        qForm.querySelectorAll(".question").forEach(function (f) { f.disabled = true; });
        setStatus(qForm, "Vaqt tugadi. Javoblaringiz yuborilmoqda…", "");
      }
      try {
        var r = await post("/api/tests/" + tid + "/submit", { attempt: state.attempt, answers: collectAnswers(qForm).answers });
        stop(); forget(); state = null;
        bar.hidden = true;
        setChip(null, "Test yakunlandi — fayl yopildi");
        showResult(qForm, r);
      } catch (err) {
        finishing = false;
        if (/yakunlangan|topilmadi/.test(err.message)) {
          // Urinish boshqa qurilmada davom ettirilgan yoki yakunlangan — boshlash oynasiga qaytamiz
          stop(); forget(); state = null; bar.hidden = true;
          qForm.hidden = true;
          setChip(null);
          startForm.hidden = false;
          setStatus(startForm, err.message, "error");
          startForm.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        setStatus(qForm, err.message, "error");
        btn.disabled = false; btn.textContent = auto ? "Javoblarni qayta yuborish" : "Testni yakunlash";
      }
    }

    /* --- faqat fayl */
    async function loadDoc() {
      doc.hidden = false;
      doc.innerHTML = '<p class="muted doc-loading">Fayl yuklanmoqda…</p>';
      try {
        var res = await fetch("/tests/" + tid + "/file?t=" + encodeURIComponent(state.file_token) + "&fragment=1",
          { credentials: "same-origin", headers: { "X-Requested-With": "fetch" } });
        if (!res.ok) throw new Error(res.status === 403 ? "Fayl yopildi" : "Faylni yuklab bo‘lmadi");
        var html = await res.text();
        if (state) doc.innerHTML = html;
      } catch (err) {
        doc.innerHTML = '<p class="form-status is-error"></p>';
        doc.querySelector("p").textContent = err.message + ". Sahifani yangilab ko‘ring.";
      }
    }

    function timeUp() {
      stop();
      if (kind === "questions") {
        leftEl.textContent = "00:00";
        bar.classList.add("is-over");
        setChip(null, "Vaqt tugadi — fayl yopildi");
        finishQuestions(true);
        return;
      }
      finishing = true;
      forget(); state = null;
      doc.innerHTML = ""; doc.hidden = true;
      bar.hidden = true;
      over.hidden = false;
      over.scrollIntoView({ behavior: "smooth", block: "center" });
      announce.textContent = "Vaqt tugadi. Fayl yopildi";
    }

    function begin(focus) {
      said = {}; finishing = false; confirmSkip = false;
      startForm.hidden = true;
      if (over) over.hidden = true;
      if (kind === "questions") {
        renderQuestions();
        qForm.hidden = false;
        setStatus(qForm, "", "");
        var btn = qForm.querySelector('button[type="submit"]');
        btn.disabled = false; btn.textContent = "Testni yakunlash";
        updateProgress();
        if (state.file_token) setChip(state.file_token);
      } else {
        loadDoc();
      }
      run();
      if (focus && remaining() > 0) bar.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (startForm) {
      startForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var body = {};
        if (kind === "questions") {
          var name = startForm.elements.full_name, phone = startForm.elements.phone;
          if (!name.checkValidity() || name.value.trim().length < 3) { setStatus(startForm, "Ism va familiyani kiriting", "error"); name.focus(); return; }
          if (!phoneOk(phone.value)) { setStatus(startForm, "Telefon raqamini to‘liq kiriting", "error"); phone.focus(); return; }
          body.full_name = name.value.trim(); body.phone = formatPhone(phone.value);
        }
        var minutes = chosenMinutes();
        if (mode === "student") {
          if (!(minutes >= 1 && minutes <= 300)) {
            setStatus(startForm, "Vaqtni 1 daqiqadan 300 daqiqagacha tanlang", "error");
            var ci = startForm.elements.custom_minutes; if (ci && !ci.closest("[hidden]")) ci.focus();
            return;
          }
          body.minutes = minutes;
        }
        var btn = startForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        setStatus(startForm, "Test tayyorlanmoqda…", "");
        try {
          var r = await post("/api/tests/" + tid + "/start", body);
          state = {
            attempt: r.attempt || null, limit: r.limit_seconds,
            deadline: Date.now() + Number(r.remaining_seconds) * 1000,
            file_token: r.file_token || null, questions: r.questions || [], answers: {},
            name: body.full_name || "", phone: body.phone || ""
          };
          save();
          setStatus(startForm, "", "");
          begin(true);
        } catch (err) {
          setStatus(startForm, err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
    }
    var restart = box.querySelector("[data-restart]");
    if (restart) restart.addEventListener("click", function () {
      over.hidden = true; startForm.hidden = false; finishing = false;
      startForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    /* sahifa yangilansa — davom ettirish */
    try { state = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (e) { state = null; }
    if (state && state.deadline && state.limit && (kind === "file" ? state.file_token : state.attempt)) {
      if (kind === "file" && remaining() <= 0) { forget(); state = null; }
      else begin(false);
    } else {
      state = null;
    }
  });
})();
