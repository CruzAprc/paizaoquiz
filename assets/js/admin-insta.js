/* ============================================================================
   PAINEL /pedroinstagram — leads do funil /insta
   Login = mesmo Supabase Auth do /pedro
   Lê: 1) paizao_insta_leads  2) fallback paizao_quiz_leads (answers.flow = "insta")
============================================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ewnsttmmbcdzchzpxqjb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_mIb6RJkWqC5QESdczkFWng_Oo5O17hi";
  var TABLE = "paizao_insta_leads";

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var pct = function (n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : 0; };

  var client = null;
  var rows = [];
  var source = ""; // "insta_table" | "quiz_leads"

  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "paizao_admin_auth" }
    });
  } catch (e) {
    console.error(e);
  }

  function showLogin() {
    $("login").hidden = false;
    $("dash").hidden = true;
  }
  function showDash() {
    $("login").hidden = true;
    $("dash").hidden = false;
  }

  async function boot() {
    if (!client) {
      document.body.innerHTML = "<p style='padding:24px;font:16px sans-serif'>Falha ao carregar o Supabase.</p>";
      return;
    }
    var s = await client.auth.getSession();
    if (s && s.data && s.data.session) {
      showDash();
      load();
    } else {
      showLogin();
    }
  }

  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("loginBtn"), err = $("loginErr");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Entrando…";
    var res = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    btn.disabled = false;
    btn.textContent = "Entrar";
    if (res.error) {
      err.textContent = "Login inválido: " + res.error.message;
      err.hidden = false;
      return;
    }
    showDash();
    load();
  });

  $("logoutBtn").addEventListener("click", async function () {
    await client.auth.signOut();
    showLogin();
  });
  $("reloadBtn").addEventListener("click", function () { load(); });
  $("clearFilters").addEventListener("click", function () {
    $("fromDate").value = "";
    $("toDate").value = "";
    $("statusFilter").value = "";
    $("searchQ").value = "";
    render();
  });
  ["fromDate", "toDate", "statusFilter"].forEach(function (id) {
    $(id).addEventListener("change", render);
  });
  $("searchQ").addEventListener("input", render);
  $("exportBtn").addEventListener("click", exportCsv);

  function windowBounds() {
    var fromISO = $("fromDate").value
      ? new Date($("fromDate").value + "T00:00:00").toISOString()
      : null;
    var toISO = null;
    if ($("toDate").value) {
      var d = new Date($("toDate").value + "T00:00:00");
      d.setDate(d.getDate() + 1);
      toISO = d.toISOString();
    }
    return { fromISO: fromISO, toISO: toISO };
  }

  function normalizeRow(r) {
    // unifica formato: colunas dedicadas OU answers jsonb (fallback quiz)
    var a = r.answers || {};
    return {
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      instagram_handle: r.instagram_handle || a.instagram_handle || null,
      instagram_followers: r.instagram_followers || a.instagram_followers || null,
      tiktok_handle: r.tiktok_handle || a.tiktok_handle || null,
      tiktok_followers: r.tiktok_followers || a.tiktok_followers || null,
      ja_fez_publi: r.ja_fez_publi || a.ja_fez_publi || null,
      conhece_app_paizao: r.conhece_app_paizao || a.conhece_app_paizao || null,
      last_step: r.last_step,
      last_step_slug: r.last_step_slug,
      last_step_label: r.last_step_label,
      completed: !!r.completed,
      completed_at: r.completed_at,
      utm_source: r.utm_source,
      landing_path: r.landing_path,
      answers: a
    };
  }

  function isInstaQuizLead(r) {
    var a = r.answers || {};
    if (a.flow === "insta") return true;
    var slug = String(r.last_step_slug || "");
    if (slug.indexOf("insta/") === 0) return true;
    if (/instagram|tiktok|experiencia|pronto/.test(slug) && (a.instagram_handle || a.tiktok_handle || a.ja_fez_publi)) return true;
    var lp = String(r.landing_path || "");
    if (lp.indexOf("/insta") >= 0 && (a.instagram_handle || a.tiktok_handle || a.ja_fez_publi || a.conhece_app_paizao)) return true;
    return false;
  }

  async function load() {
    $("dashSub").textContent = "carregando…";
    $("dbHint").textContent = "";
    try {
      var data = null;

      // 1) RPC dedicada
      var rpc = await client.rpc("paizao_insta_list", { p_limit: 2000 });
      if (!rpc.error && Array.isArray(rpc.data)) {
        data = rpc.data;
        source = "insta_table";
      } else {
        // 2) select tabela dedicada
        var res = await client
          .from(TABLE)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (!res.error && res.data) {
          data = res.data;
          source = "insta_table";
        } else {
          // 3) fallback: paizao_quiz_leads com flow=insta
          var res2 = await client
            .from("paizao_quiz_leads")
            .select("id,created_at,updated_at,answers,last_step,last_step_slug,last_step_label,completed,completed_at,utm_source,landing_path")
            .order("created_at", { ascending: false })
            .limit(3000);
          if (res2.error) {
            rows = [];
            $("dashSub").textContent = "erro ao carregar";
            $("dbHint").textContent = res2.error.message;
            render();
            return;
          }
          data = (res2.data || []).filter(isInstaQuizLead);
          source = "quiz_leads";
          $("dbHint").innerHTML =
            "Lendo de <code>paizao_quiz_leads</code> (fallback · answers.flow=insta). " +
            "Pra tabela dedicada, rode <code>supabase/migrations/20260712_paizao_insta_leads.sql</code> no SQL Editor.";
        }
      }

      rows = (data || []).map(normalizeRow);
      $("dashSub").textContent =
        rows.length + " registro(s) · fonte: " + (source === "insta_table" ? "paizao_insta_leads" : "quiz_leads (fallback)") +
        " · atualizado agora";
      render();
    } catch (e) {
      console.error(e);
      $("dashSub").textContent = "erro ao carregar";
      $("dbHint").textContent = String(e && e.message || e);
    }
  }

  function filtered() {
    var b = windowBounds();
    var status = $("statusFilter").value;
    var q = ($("searchQ").value || "").trim().toLowerCase();
    return rows.filter(function (r) {
      if (b.fromISO && r.created_at && r.created_at < b.fromISO) return false;
      if (b.toISO && r.created_at && r.created_at >= b.toISO) return false;
      if (status === "completed" && !r.completed) return false;
      if (status === "partial" && r.completed) return false;
      if (q) {
        var blob = [
          r.instagram_handle, r.tiktok_handle, r.instagram_followers, r.tiktok_followers,
          r.ja_fez_publi, r.conhece_app_paizao, r.utm_source, r.last_step_slug
        ].join(" ").toLowerCase();
        if (blob.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function countBy(arr, key) {
    var m = {};
    arr.forEach(function (r) {
      var v = r[key] || "(vazio)";
      m[v] = (m[v] || 0) + 1;
    });
    return Object.keys(m)
      .map(function (k) { return { k: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function renderBars(el, items, total) {
    if (!items.length) {
      el.innerHTML = '<p class="muted">sem dados</p>';
      return;
    }
    el.innerHTML = items.map(function (it) {
      var p = pct(it.n, total);
      return (
        '<div class="insta-bar">' +
          '<span class="insta-bar__label">' + esc(it.k) + "</span>" +
          '<div class="insta-bar__track"><div class="insta-bar__fill" style="width:' + p + '%"></div></div>' +
          '<span class="insta-bar__n">' + it.n + " · " + p + "%</span>" +
        "</div>"
      );
    }).join("");
  }

  function fmtWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return iso; }
  }

  function render() {
    var list = filtered();
    var total = list.length;
    var done = list.filter(function (r) { return r.completed; }).length;
    var withIg = list.filter(function (r) { return r.instagram_handle; }).length;
    var withTt = list.filter(function (r) { return r.tiktok_handle; }).length;

    $("kpis").innerHTML =
      kpi("Total (filtro)", total) +
      kpi("Completou", done + " · " + pct(done, total) + "%") +
      kpi("Com Instagram", withIg) +
      kpi("Com TikTok", withTt);

    renderBars($("chartPubli"), countBy(list, "ja_fez_publi"), total);
    renderBars($("chartApp"), countBy(list, "conhece_app_paizao"), total);

    $("leadsCount").textContent = "· " + total;
    $("leadsBody").innerHTML = list.map(function (r) {
      var slug = String(r.last_step_slug || "").replace(/^insta\//, "");
      return (
        "<tr>" +
          "<td>" + esc(fmtWhen(r.created_at)) + "</td>" +
          "<td><code>" + esc(r.instagram_handle || "—") + "</code></td>" +
          "<td>" + esc(r.instagram_followers || "—") + "</td>" +
          "<td><code>" + esc(r.tiktok_handle || "—") + "</code></td>" +
          "<td>" + esc(r.tiktok_followers || "—") + "</td>" +
          "<td>" + esc(r.ja_fez_publi || "—") + "</td>" +
          "<td>" + esc(r.conhece_app_paizao || "—") + "</td>" +
          "<td>" + esc(slug || r.last_step_label || "—") + "</td>" +
          "<td class=\"" + (r.completed ? "ok" : "partial") + "\">" + (r.completed ? "sim" : "parcial") + "</td>" +
          "<td>" + esc(r.utm_source || "—") + "</td>" +
        "</tr>"
      );
    }).join("") || '<tr><td colspan="10" class="muted">nenhum lead neste filtro</td></tr>';
  }

  function kpi(label, value) {
    return (
      '<div class="kpi">' +
        '<div class="kpi__v">' + esc(value) + "</div>" +
        '<div class="kpi__l">' + esc(label) + "</div>" +
      "</div>"
    );
  }

  function exportCsv() {
    var list = filtered();
    var cols = [
      "created_at", "instagram_handle", "instagram_followers", "tiktok_handle", "tiktok_followers",
      "ja_fez_publi", "conhece_app_paizao", "last_step_slug", "completed", "utm_source", "landing_path"
    ];
    var lines = [cols.join(",")];
    list.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = r[c] == null ? "" : String(r[c]);
        if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "paizao-insta-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  boot();
})();
