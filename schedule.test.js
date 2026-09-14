import test from "node:test";
import assert from "node:assert/strict";
import {
  chinaDate,
  monday,
  addDays,
  nextSession,
  status,
  conflicts,
  validate,
} from "./schedule.js";
const s = {
  id: "a",
  title: "测试课程",
  date: "2026-09-14",
  start: "08:55",
  end: "11:30",
  status: "scheduled",
};
test("中国时区跨日与跨年周导航", () => {
  assert.equal(chinaDate(new Date("2026-09-13T16:01:00Z")), "2026-09-14");
  assert.equal(monday("2027-01-03"), "2026-12-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("课程进行中与结束的准确边界", () => {
  assert.equal(status(s, new Date("2026-09-14T00:54:59Z")), "upcoming");
  assert.equal(status(s, new Date("2026-09-14T00:55:00Z")), "live");
  assert.equal(status(s, new Date("2026-09-14T03:30:00Z")), "past");
});
test("下一节课排除停课并保留正在上的课", () => {
  const cancelled = {
    ...s,
    id: "b",
    start: "08:00",
    end: "08:45",
    status: "cancelled",
  };
  assert.equal(
    nextSession([cancelled, s], new Date("2026-09-14T00:00:00Z")).id,
    "a",
  );
  assert.equal(nextSession([s], new Date("2026-09-14T01:00:00Z")).id, "a");
  assert.equal(nextSession([s], new Date("2026-09-14T03:30:00Z")), undefined);
});
test("冲突检测不会把停课或相邻节次判为冲突", () => {
  assert.equal(
    conflicts([s, { ...s, id: "b", start: "11:30", end: "12:00" }]).size,
    0,
  );
  assert.equal(conflicts([s, { ...s, id: "b", start: "10:30" }]).size, 2);
  assert.equal(conflicts([s, { ...s, id: "b", status: "cancelled" }]).size, 0);
});
test("拒绝重复记录、无效日期与超出覆盖范围的课程", () => {
  const d = {
    schemaVersion: 1,
    updatedAt: "2026-09-14T00:00:00Z",
    coverageStart: "2026-09-13",
    coverageEnd: "2027-01-17",
    sessions: [s],
  };
  assert.equal(validate(d), d);
  assert.throws(() => validate({ ...d, sessions: [s, s] }));
  assert.throws(() =>
    validate({ ...d, sessions: [{ ...s, date: "2026-02-30" }] }),
  );
  assert.throws(() =>
    validate({ ...d, sessions: [{ ...s, date: "2027-02-01" }] }),
  );
});
