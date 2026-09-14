import {
  addDays,
  chinaDate,
  monday,
  status,
  nextSession,
  sortSessions,
  conflicts,
  validate,
  isDate,
} from "./schedule.js";
const $ = (id) => document.getElementById(id);
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const colors = ["#2459e0", "#8860d0", "#15958d", "#d4872e", "#d35f83"];
let data,
  selected = chinaDate(),
  lastToday = selected,
  envelope,
  encrypted = false;
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const shortDate = (d) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
const weekday = (d) => weekdays[new Date(`${d}T12:00:00Z`).getUTCDay()];
const active = (s) => s.status !== "cancelled";
const onDate = (d) => data.sessions.filter((s) => s.date === d);
const covered = (d) => d >= data.coverageStart && d <= data.coverageEnd;
function select(date) {
  if (!isDate(date)) return;
  selected = date;
  render();
}
function icon(type) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.7");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(s.namespaceURI, "path");
  p.setAttribute(
    "d",
    type === "room"
      ? "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      : "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  );
  s.append(p);
  return s;
}
function render() {
  if (!data) return;
  const now = new Date(),
    today = chinaDate(now),
    items = onDate(selected),
    running = items.filter(active),
    start = monday(selected),
    overlaps = conflicts(items);
  $("heading-date").textContent = shortDate(selected);
  $("heading-weekday").textContent = weekday(selected);
  $("date").value = selected;
  $("term").textContent = data.term || "MY SCHEDULE";
  $("day-summary").textContent = !covered(selected)
    ? "这个日期超出已同步的课表范围。"
    : running.length
      ? `安排了 ${running.length} 次课，按上课时间排列。`
      : "今天的时间，留给自己的安排。";
  $("day-count").textContent = !covered(selected)
    ? "未同步"
    : `${running.length} 次课${items.length > running.length ? ` · ${items.length - running.length} 次停课` : ""}`;
  $("week").replaceChildren();
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i),
      count = onDate(date).filter(active).length,
      b = h(
        "button",
        `day${date === selected ? " is-selected" : ""}${date === today ? " is-today" : ""}`,
      );
    b.setAttribute(
      "aria-label",
      `${shortDate(date)} ${weekday(date)}${covered(date) ? `，${count}次课` : "，未同步"}`,
    );
    b.setAttribute("aria-pressed", String(date === selected));
    b.append(
      h("span", "weekday", date === today ? "今天" : weekday(date)),
      h("span", "number", String(Number(date.slice(8)))),
      h(
        "span",
        "marker",
        !covered(date) ? "未同步" : count ? `${count}次课` : "—",
      ),
    );
    b.onclick = () => select(date);
    $("week").append(b);
  }
  $("sessions").replaceChildren();
  if (!items.length) {
    const box = h("div", "empty");
    box.append(
      h("div", "empty-icon", covered(selected) ? "☀" : "▦"),
      h("h3", "", covered(selected) ? "这一天没有课" : "暂无这个日期的课表"),
      h(
        "p",
        "",
        covered(selected)
          ? "已同步的教务课表中，这一天没有课程安排。"
          : "请选择已同步范围内的日期。这里不会把未知日期显示为无课。",
      ),
    );
    const next = sortSessions(data.sessions).find(
      (s) => active(s) && s.date > selected,
    );
    if (next) {
      const b = h("button", "quiet", `查看下次安排 · ${shortDate(next.date)}`);
      b.onclick = () => select(next.date);
      box.append(b);
    }
    $("sessions").append(box);
  }
  const names = [...new Set(data.sessions.map((s) => s.title))];
  for (const s of items) {
    const state = status(s, now),
      row = h(
        "article",
        `course${state === "cancelled" ? " is-cancelled" : ""}${overlaps.has(s.id) ? " conflict" : ""}`,
      ),
      time = h("div", "time");
    time.append(h("span", "start", s.start), h("span", "end", s.end));
    const body = h("div", "course-body");
    body.style.setProperty(
      "--course-color",
      colors[names.indexOf(s.title) % colors.length],
    );
    const top = h("div", "course-top");
    top.append(
      h("span", "course-code", s.sections || s.code || "课程"),
      h(
        "span",
        `status ${state}`,
        {
          cancelled: "已停课",
          past: "已结束",
          live: "上课中",
          adjusted: "调课安排",
          upcoming: "待上课",
        }[state],
      ),
    );
    const details = h("div", "details");
    for (const [type, text] of [
      ["room", s.room || "教室待确认"],
      ["teacher", s.teacher || "教师待确认"],
    ]) {
      const sp = h("span");
      sp.append(icon(type), document.createTextNode(text));
      details.append(sp);
    }
    body.append(top, h("h3", "", s.title), details);
    if (s.note) body.append(h("p", "course-note", s.note));
    if (overlaps.has(s.id))
      body.append(h("p", "conflict-note", "与另一门课的时间重叠"));
    row.append(time, body);
    $("sessions").append(row);
  }
  const next = nextSession(data.sessions, now);
  $("next-session").replaceChildren();
  if (next) {
    $("next-session").append(
      h(
        "div",
        "next-date",
        `${shortDate(next.date)} ${weekday(next.date)}${status(next, now) === "live" ? " · 正在上课" : ""}`,
      ),
      h("div", "next-name", next.title),
      h("p", "next-info", `${next.start} – ${next.end}`),
      h("p", "next-info", next.room || "教室待确认"),
    );
    const b = h("button", "next-link", "查看当天安排 →");
    b.onclick = () => select(next.date);
    $("next-session").append(b);
  } else
    $("next-session").append(
      h("p", "next-info", "已同步的课表中没有后续课程。"),
    );
  const weekItems = data.sessions.filter(
      (s) => s.date >= start && s.date <= addDays(start, 6) && active(s),
    ),
    stats = h("div", "week-stats");
  for (const [value, label] of [
    [weekItems.length, "次课"],
    [new Set(weekItems.map((s) => s.date)).size, "天有课"],
  ]) {
    const stat = h("div", "stat");
    stat.append(h("strong", "", String(value)), h("span", "", label));
    stats.append(stat);
  }
  $("week-summary").replaceChildren(
    stats,
    h(
      "p",
      "week-footnote",
      `${shortDate(start)} — ${shortDate(addDays(start, 6))}${!covered(start) || !covered(addDays(start, 6)) ? " · 部分日期未同步" : ""}`,
    ),
  );
  $("updated").textContent =
    `更新于 ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))}`;
  $("coverage").textContent =
    `已同步 ${data.coverageStart} 至 ${data.coverageEnd} · ${data.sessions.filter(active).length} 次课${data.notice ? " · " + data.notice : ""}`;
}
function show(schedule) {
  data = validate(schedule);
  data.sessions = sortSessions(data.sessions);
  $("gate").hidden = true;
  $("workspace").hidden = false;
  $("lock").hidden = !encrypted;
  render();
}
function base64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function decrypt(password) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64(envelope.salt),
      iterations: envelope.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64(envelope.iv) },
    key,
    base64(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
$("unlock-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  $("error").textContent = "";
  try {
    show(await decrypt($("password").value));
    $("password").value = "";
  } catch {
    $("error").textContent = "口令不正确，或课表文件已损坏，请重试。";
  } finally {
    button.disabled = false;
  }
};
$("lock").onclick = () => {
  data = undefined;
  $("workspace").hidden = true;
  $("gate").hidden = false;
  $("lock").hidden = true;
  $("sessions").replaceChildren();
  $("next-session").replaceChildren();
  $("week-summary").replaceChildren();
  $("password").focus();
};
$("date").onchange = (e) => select(e.target.value);
$("today").onclick = () => select(chinaDate());
$("previous-week").onclick = () => select(addDays(selected, -7));
$("next-week").onclick = () => select(addDays(selected, 7));
function refresh() {
  const today = chinaDate();
  if (selected === lastToday) selected = today;
  lastToday = today;
  if (data) render();
}
setInterval(refresh, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
try {
  const response = await fetch("./schedule-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("课表数据暂未就绪");
  envelope = await response.json();
  if (envelope.encrypted) {
    encrypted = true;
    $("gate-description").textContent = "输入口令，查看你的实际课程安排。";
    $("unlock-form").hidden = false;
  } else show(envelope);
} catch (e) {
  $("gate-description").textContent = "暂时无法读取课表。";
  $("error").textContent = e.message + "，请稍后刷新。";
}
