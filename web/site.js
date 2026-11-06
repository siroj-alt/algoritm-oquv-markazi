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
  document.querySelectorAll(".js-test").forEach(function (form) {
    var questions = form.querySelectorAll(".question");
    var progress = form.querySelector("[data-progress]");
    var total = questions.length;
    function answered() {
      var n = 0;
      questions.forEach(function (q) { if (q.querySelector("input:checked")) n++; });
      return n;
    }
    form.addEventListener("change", function () {
      if (progress) progress.textContent = answered() + " / " + total + " javob berildi";
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.elements.full_name, phone = form.elements.phone;
      if (!name.checkValidity()) { setStatus(form, "Ism va familiyani kiriting", "error"); name.focus(); return; }
      if (!phoneOk(phone.value)) { setStatus(form, "Telefon raqamini to‘liq kiriting", "error"); phone.focus(); return; }
      var missing = null;
      var answers = {};
      questions.forEach(function (q) {
        var c = q.querySelector("input:checked");
        if (c) answers[c.name.slice(2)] = c.value; else if (!missing) missing = q;
      });
      if (missing) {
        setStatus(form, "Barcha savollarga javob bering", "error");
        missing.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
      try {
        var r = await post("/api/tests/" + form.getAttribute("data-test-id") + "/submit",
          { full_name: name.value, phone: phone.value, answers: answers });
        var box = form.parentElement.querySelector(".test-result");
        var pct = Math.round(Number(r.percentage));
        var verdict = pct >= 85 ? "Ajoyib natija!" : pct >= 60 ? "Yaxshi natija." : "Mashq qilishda davom eting.";
        box.innerHTML = '<h2></h2><div class="result-score"></div><p class="muted"></p><div class="actions actions-center"><a class="btn btn-primary" href="/register">Kursga yozilish</a><a class="btn btn-ghost" href="/tests">Boshqa testlar</a></div>';
        box.querySelector("h2").textContent = verdict;
        countUp(box.querySelector(".result-score"), pct);
        box.querySelector("p").textContent = r.total + " ta savoldan " + r.correct + " tasiga to‘g‘ri javob berdingiz.";
        var tid = form.getAttribute("data-test-id");
        if (r.file_token || r.file_open) {
          var a = document.createElement("a");
          a.className = "btn btn-ghost";
          a.href = "/tests/" + tid + "/file" + (r.file_token ? "?t=" + encodeURIComponent(r.file_token) : "");
          a.textContent = "Test faylini ko‘rish";
          box.querySelector(".actions").appendChild(a);
        }
        form.hidden = true; box.hidden = false;
        box.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        setStatus(form, err.message, "error");
        btn.disabled = false; btn.textContent = "Testni yakunlash";
      }
    });
  });
})();
