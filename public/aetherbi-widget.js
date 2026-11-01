(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://erp.aetherbi.com";
  var bar = document.createElement("div");
  bar.setAttribute("dir", "rtl");
  bar.style.cssText = "position:sticky;top:0;z-index:70;display:flex;gap:12px;justify-content:space-between;align-items:center;padding:12px 16px;background:#0f172a;color:#fff;font-family:Cairo,Tahoma,sans-serif";
  bar.innerHTML = '<strong>AetherBI Enterprise ERP</strong><span style="display:flex;gap:8px"><a href="' + origin + '/login" style="color:#fff;background:#1e40af;padding:8px 12px;border-radius:10px;text-decoration:none;font-weight:700">دخول النظام السحابي</a><a href="' + origin + '/download" style="color:#0f172a;background:#fff;padding:8px 12px;border-radius:10px;text-decoration:none;font-weight:700">تحميل تطبيق AetherBI ERP</a></span>';
  document.body.prepend(bar);

  var button = document.createElement("a");
  button.href = origin + "/download";
  button.textContent = "تحميل تطبيق AetherBI ERP";
  button.style.cssText = "position:fixed;bottom:18px;left:18px;z-index:70;background:#1e40af;color:#fff;padding:12px 16px;border-radius:14px;text-decoration:none;font-weight:700;font-family:Cairo,Tahoma,sans-serif";
  document.body.appendChild(button);

  var form = document.createElement("form");
  form.setAttribute("dir", "rtl");
  form.style.cssText = "position:fixed;bottom:72px;left:18px;z-index:70;width:280px;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;padding:14px;font-family:Cairo,Tahoma,sans-serif";
  form.innerHTML = '<strong>اطلب نسختك التجريبية / تواصل معنا</strong><input name="contactName" placeholder="الاسم" required style="width:100%;margin-top:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px"><input name="phone" placeholder="الهاتف" required style="width:100%;margin-top:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px"><input name="email" placeholder="البريد" style="width:100%;margin-top:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px"><input name="title" placeholder="اهتمامك" style="width:100%;margin-top:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px"><button type="submit" style="margin-top:8px;background:#1e40af;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700">إرسال</button>';
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    fetch(origin + "/api/public/aetherbi/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(function (response) {
      form.innerHTML = response.ok ? "<strong>تم استلام طلبكم</strong>" : "<strong>تعذر الإرسال</strong>";
    }).catch(function () {
      form.innerHTML = "<strong>تعذر الإرسال</strong>";
    });
  });
  document.body.appendChild(form);

  fetch(origin + "/api/public/aetherbi/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: location.pathname }),
  }).catch(function () {});
})();
