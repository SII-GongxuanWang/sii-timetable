export const TZ = "Asia/Shanghai";
export const isDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export function chinaDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monday(date) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(d || 7) + 1);
}
export function epoch(session, which) {
  return Date.parse(`${session.date}T${session[which]}:00+08:00`);
}
export function status(session, now = new Date()) {
  if (session.status === "cancelled") return "cancelled";
  if (now.getTime() >= epoch(session, "end")) return "past";
  if (now.getTime() >= epoch(session, "start")) return "live";
  return session.status === "adjusted" ? "adjusted" : "upcoming";
}
export function sortSessions(sessions) {
  return [...sessions].sort(
    (a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`) ||
      a.title.localeCompare(b.title),
  );
}
export function nextSession(sessions, now = new Date()) {
  return sortSessions(sessions).find(
    (s) => s.status !== "cancelled" && epoch(s, "end") > now.getTime(),
  );
}
export function conflicts(sessions) {
  const result = new Set();
  for (let i = 0; i < sessions.length; i++)
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i],
        b = sessions[j];
      if (
        a.status !== "cancelled" &&
        b.status !== "cancelled" &&
        a.date === b.date &&
        a.start < b.end &&
        b.start < a.end
      ) {
        result.add(a.id);
        result.add(b.id);
      }
    }
  return result;
}
export function validate(data) {
  if (
    !data ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.sessions) ||
    !isDate(data.coverageStart) ||
    !isDate(data.coverageEnd) ||
    data.coverageStart > data.coverageEnd ||
    !Number.isFinite(Date.parse(data.updatedAt))
  )
    throw new Error("课表文件格式不正确");
  const ids = new Set();
  for (const s of data.sessions) {
    if (
      !s.id ||
      ids.has(s.id) ||
      !isDate(s.date) ||
      !s.title ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end) ||
      s.start >= s.end ||
      s.date < data.coverageStart ||
      s.date > data.coverageEnd ||
      !["scheduled", "adjusted", "cancelled"].includes(s.status)
    )
      throw new Error("课表中存在不完整或重复的课程记录");
    ids.add(s.id);
  }
  return data;
}
