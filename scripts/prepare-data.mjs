import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  randomBytes,
  pbkdf2Sync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { validate, sortSessions } from "../schedule.js";

const input = process.argv[2] || "private/source.json";
const raw = JSON.parse(readFileSync(input, "utf8"));
const sections = [...raw.panel.sectionList].sort(
  (a, b) => a.sectionSequence - b.sectionSequence,
);
const dates = Object.values(raw.panel.timetableDateMap)
  .flat()
  .filter((d) => d.enableTimetableSaved === "1")
  .map((d) => d.timetableDate)
  .sort();
const sessions = raw.timetable.map((r, index) => {
  const start = sections.findIndex((s) => s.id === r.startSectionId),
    end = start + Number(r.sectionNumber) - 1;
  if (start < 0 || !sections[end])
    throw new Error(`Invalid section for source row ${index}`);
  if (!["1", "2", "3"].includes(String(r.dataType)))
    throw new Error(`Unknown schedule status ${r.dataType}`);
  return {
    id: `session-${index + 1}`,
    date: r.timetableDate,
    title: r.className,
    teacher: r.courseTeacherName || "",
    room: r.classroomName || "",
    start: sections[start].startTime.slice(0, 5),
    end: sections[end].endTime.slice(0, 5),
    sections:
      r.section ||
      `第${sections[start].sectionSequence}–${sections[end].sectionSequence}节`,
    status: { 1: "scheduled", 2: "adjusted", 3: "cancelled" }[
      String(r.dataType)
    ],
  };
});
const data = validate({
  schemaVersion: 1,
  term: raw.panel.termName,
  updatedAt: raw.exportedAt,
  coverageStart: dates[0],
  coverageEnd: dates.at(-1),
  sessions: sortSessions(sessions),
});
writeFileSync("private/schedule.json", JSON.stringify(data, null, 2), {
  mode: 0o600,
});
if (process.argv.includes("--public")) {
  writeFileSync("schedule-data.json", JSON.stringify(data, null, 2));
} else {
  const passwordPath = "private/passphrase.txt";
  if (!existsSync(passwordPath))
    writeFileSync(passwordPath, randomBytes(12).toString("base64url") + "\n", {
      mode: 0o600,
    });
  const password = readFileSync(passwordPath, "utf8").trim();
  const salt = randomBytes(16),
    iv = randomBytes(12),
    iterations = 600000,
    key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const envelope = {
    encrypted: true,
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const checked = JSON.parse(
    Buffer.concat([
      decipher.update(ciphertext.subarray(0, -16)),
      decipher.final(),
    ]).toString(),
  );
  validate(checked);
  if (JSON.stringify(checked) !== JSON.stringify(data))
    throw new Error("Encryption round trip failed");
  writeFileSync("schedule-data.json", JSON.stringify(envelope, null, 2));
}
console.log(
  JSON.stringify({
    sessions: data.sessions.length,
    courses: new Set(data.sessions.map((s) => s.title)).size,
    start: data.coverageStart,
    end: data.coverageEnd,
    encrypted: !process.argv.includes("--public"),
  }),
);
