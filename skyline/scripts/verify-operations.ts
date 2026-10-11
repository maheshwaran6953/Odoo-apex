import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw Error("Pass --temporary-fixtures.");
  loadEnvConfig(process.cwd());
  const { boundedDatabaseUrl } = await import("../src/lib/database-url");
  const sample =
    "postgresql://fixture:fake-password@localhost:5432/fixture?schema=public";
  const bounded = new URL(boundedDatabaseUrl(sample)!);
  assert.equal(bounded.searchParams.get("connection_limit"), "3");
  assert.equal(bounded.searchParams.get("pool_timeout"), "10");
  assert.equal(bounded.searchParams.get("schema"), "public");
  assert.equal(boundedDatabaseUrl("file:./dev.db"), "file:./dev.db");
  for (const limit of ["0", "6", "-1", "1.5", "NaN", ""])
    assert.throws(() => boundedDatabaseUrl(sample, limit));
  console.log(
    "PASS: bounded PostgreSQL pool preserves configuration and rejects invalid/excessive limits",
  );
  const { db } = await import("../src/lib/db");
  const { updateVolunteerTask, adjustInventoryStock } =
    await import("../src/server/operations-service");
  const { submitExpense, downloadExpenseReceipt, validateReceipt } =
    await import("../src/server/expense-service");
  const { financeFilters, exportFinance } =
    await import("../src/server/finance-report-service");
  const { exportAttendees } =
    await import("../src/server/attendee-export-service");
  const { csvDocument } = await import("../src/lib/csv");
  const marker = "ops-" + randomUUID();
  const users: string[] = [],
    members: string[] = [];
  const models = [
    "user",
    "member",
    "task",
    "transaction",
    "inventoryItem",
    "inventoryMovement",
    "event",
    "ticket",
    "emailMessage",
  ] as const;
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        models.map(async (m) => [
          m,
          await (
            db[m] as unknown as {
              findMany: (args: {
                orderBy: { id: "asc" };
              }) => Promise<unknown[]>;
            }
          ).findMany({ orderBy: { id: "asc" } }),
        ]),
      ),
    );
  const { clubDate, clubDateTime, clubDatePart } =
    await import("../src/lib/dates");
  const originalTZ = process.env.TZ;
  const timestamp = "2026-03-12T20:00:00Z";
  process.env.TZ = "UTC";
  const timeBaseline = [
    clubDate(timestamp),
    clubDateTime(timestamp),
    clubDatePart(timestamp, "day"),
  ];
  process.env.TZ = "America/New_York";
  assert.deepEqual(
    [
      clubDate(timestamp),
      clubDateTime(timestamp),
      clubDatePart(timestamp, "day"),
    ],
    timeBaseline,
  );
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
  assert.equal(clubDatePart(timestamp, "day"), "13");
  console.log("PASS: campus date display is independent of server timezone");
  const baseline = await snapshot();
  const objects = new Map<string, Blob>();
  const storage = {
    async upload(path: string, bytes: Uint8Array, mime: string) {
      objects.set(path, new Blob([Buffer.from(bytes)], { type: mime }));
    },
    async remove(path: string) {
      objects.delete(path);
    },
    async download(path: string) {
      const file = objects.get(path);
      if (!file) throw Error("Missing fixture object");
      return file;
    },
  };
  const itemId = marker + "-item",
    taskId = marker + "-task",
    eventId = marker + "-event";
  try {
    const createUser = async (
      role: string,
      approvalStatus = "APPROVED",
      verified = true,
      disabled = false,
    ) => {
      const memberId = marker + "-member-" + members.length;
      members.push(memberId);
      await db.member.create({
        data: {
          id: memberId,
          name: marker,
          email: memberId + "@skyline.example",
        },
      });
      const id = marker + "-user-" + users.length;
      users.push(id);
      return db.user.create({
        data: {
          id,
          memberId,
          name: marker,
          email: id + "@skyline.example",
          passwordHash: "NOT_A_LOGIN_HASH",
          role,
          requestedRole: role,
          approvalStatus,
          emailVerifiedAt: verified ? new Date() : null,
          disabledAt: disabled ? new Date() : null,
          emailReminders: false,
        },
      });
    };
    const volunteer = await createUser("MEMBER");
    const other = await createUser("MEMBER");
    const staff = await createUser("STAFF");
    const treasurer = await createUser("TREASURER");
    const pendingStaff = await createUser("STAFF", "PENDING");
    const unverified = await createUser("STAFF", "APPROVED", false);
    const disabled = await createUser("STAFF", "APPROVED", true, true);
    await db.task.create({
      data: { id: taskId, title: marker, assigneeId: volunteer.memberId },
    });
    assert.equal(
      (await updateVolunteerTask(other.id, taskId, "DONE")).ok,
      false,
    );
    assert.equal(
      (await updateVolunteerTask(volunteer.id, taskId, "INVALID")).ok,
      false,
    );
    assert.equal(
      (await updateVolunteerTask(pendingStaff.id, taskId, "DONE")).ok,
      false,
    );
    assert.equal(
      (await updateVolunteerTask(volunteer.id, taskId, "DOING")).ok,
      true,
    );
    assert.equal(
      (await db.task.findUniqueOrThrow({ where: { id: taskId } })).status,
      "DOING",
    );
    assert.equal(
      (await updateVolunteerTask(staff.id, taskId, "DONE")).ok,
      true,
    );
    console.log(
      "PASS: assigned volunteer and Staff updates; foreign, pending and invalid task mutations denied",
    );

    await db.inventoryItem.create({
      data: {
        id: itemId,
        name: marker,
        category: "Test fixture",
        size: "M",
        priceCents: 1000,
        stock: 10,
      },
    });
    for (const actor of [
      volunteer,
      treasurer,
      pendingStaff,
      unverified,
      disabled,
    ])
      await assert.rejects(
        adjustInventoryStock(
          actor.id,
          itemId,
          2,
          "Fixture receipt",
          randomUUID(),
        ),
      );
    for (const delta of [0, NaN, Infinity, 1.2, -11, 1000001])
      await assert.rejects(
        adjustInventoryStock(
          staff.id,
          itemId,
          delta,
          "Fixture receipt",
          randomUUID(),
        ),
      );
    const stockKey = randomUUID();
    const repeats = await Promise.all(
      [1, 2].map(() =>
        adjustInventoryStock(staff.id, itemId, 5, "Fixture receipt", stockKey),
      ),
    );
    assert(repeats.every((r) => r.ok));
    assert.equal(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .stock,
      15,
    );
    assert.equal(await db.inventoryMovement.count({ where: { itemId } }), 1);
    await assert.rejects(
      adjustInventoryStock(staff.id, itemId, 6, "Fixture receipt", stockKey),
    );
    const removals = await Promise.allSettled(
      [1, 2].map(() =>
        adjustInventoryStock(
          staff.id,
          itemId,
          -10,
          "Fixture correction",
          randomUUID(),
        ),
      ),
    );
    assert.equal(removals.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .stock,
      5,
    );
    console.log(
      "PASS: stock role checks, nonnegative limits, audit trail, retry idempotency and concurrent removal",
    );

    const receipt = new File(
      ["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"],
      "fixture-receipt.pdf",
      { type: "application/pdf" },
    );
    for (const file of [
      new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" }),
      new File(["not an image"], "bad.png", { type: "image/png" }),
      new File(["%PDF-1.4"], "bad.png", { type: "image/png" }),
      new File([], "empty.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.pdf", {
        type: "application/pdf",
      }),
    ])
      await assert.rejects(validateReceipt(file));
    const requestKey = randomUUID();
    const expense = {
      description: marker + " receipt",
      amountCents: 2450,
      currency: "INR",
      requestKey,
      file: receipt,
    };
    for (const amountCents of [-1, 0, NaN, 1.2, 10000001])
      await assert.rejects(
        submitExpense(volunteer.id, { ...expense, amountCents }, db, storage),
      );
    await assert.rejects(submitExpense(pendingStaff.id, expense, db, storage));
    await assert.rejects(
      submitExpense(
        volunteer.id,
        { ...expense, receiptUrl: "https://example.com/receipt" },
        db,
        storage,
      ),
    );
    const claims = await Promise.all(
      [1, 2].map(() => submitExpense(volunteer.id, expense, db, storage)),
    );
    assert(claims.every((r) => r.ok));
    const saved = await db.transaction.findUniqueOrThrow({
      where: { requestKey: volunteer.id + ":" + requestKey },
    });
    assert.equal(
      await db.transaction.count({
        where: { requestKey: volunteer.id + ":" + requestKey },
      }),
      1,
    );
    assert.equal(saved.status, "pending");
    assert.equal(objects.size, 1);
    assert.equal(saved.receiptMime, "application/pdf");
    await assert.rejects(
      submitExpense(
        volunteer.id,
        { ...expense, amountCents: 2500 },
        db,
        storage,
      ),
    );
    for (const actor of [other, staff, pendingStaff, disabled])
      assert.notEqual(
        (await downloadExpenseReceipt(actor.id, saved.id, db, storage)).status,
        200,
      );
    for (const actor of [volunteer, treasurer]) {
      const response = await downloadExpenseReceipt(
        actor.id,
        saved.id,
        db,
        storage,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.match(
        response.headers.get("Content-Disposition") || "",
        /^attachment/,
      );
      assert.equal(await response.text(), await receipt.text());
    }
    const failedKey = randomUUID();
    await assert.rejects(
      submitExpense(volunteer.id, { ...expense, requestKey: failedKey }, db, {
        ...storage,
        upload: async () => {
          throw Error("fixture storage offline");
        },
      }),
    );
    assert.equal(
      await db.transaction.count({
        where: { requestKey: volunteer.id + ":" + failedKey },
      }),
      0,
    );
    // Access is revoked after upload but before the claim commit: remove only the
    // failed upload and preserve the earlier successful receipt.
    const revokeKey = randomUUID();
    await assert.rejects(
      submitExpense(volunteer.id, { ...expense, requestKey: revokeKey }, db, {
        ...storage,
        upload: async (path, bytes, mime) => {
          await storage.upload(path, bytes, mime);
          await db.user.update({
            where: { id: volunteer.id },
            data: { disabledAt: new Date() },
          });
        },
      }),
    );
    assert.equal(objects.size, 1);
    await db.user.update({
      where: { id: volunteer.id },
      data: { disabledAt: null },
    });
    console.log(
      "PASS: private receipt ownership, file validation, one claim on concurrent retries, upload failure and compensation (in-memory storage adapter)",
    );

    for (const input of [
      { from: "2026-02-30" },
      { from: "2026-04-02", to: "2026-04-01" },
      { currency: "EUR" },
      { status: "unknown" },
      { from: ["2026-01-01", "2026-01-02"] },
      { q: "x".repeat(101) },
    ])
      assert.throws(() => financeFilters(input));
    const reportDate = "2026-03-12";
    for (const [index, date] of [
      "2026-03-12T00:00:00Z",
      "2026-03-12T23:59:59.999Z",
      "2026-03-13T00:00:00Z",
    ].map((date, index) => [index, date] as const)) {
      await db.transaction.create({
        data: {
          id: marker + "-boundary-" + index,
          type: "INCOME",
          category: "FUNDRAISER",
          description: marker + " report",
          amountCents: 100,
          currency: "USD",
          createdAt: new Date(date),
        },
      });
    }
    const report = await exportFinance(treasurer, {
      q: marker,
      from: reportDate,
      to: reportDate,
      category: "FUNDRAISER",
      currency: "USD",
    });
    assert.equal(report.status, 200);
    const csv = await report.text();
    assert(
      csv.includes(marker + "-boundary-0") &&
        csv.includes(marker + "-boundary-1") &&
        !csv.includes(marker + "-boundary-2"),
    );
    assert.equal((await exportFinance(staff, { q: marker })).status, 403);
    assert.equal(
      (await exportFinance(treasurer, { from: "2026-02-30" })).status,
      400,
    );
    console.log(
      "PASS: validated filters, UTC-inclusive date boundaries, filtered finance CSV and Treasurer-only report access",
    );

    await db.event.create({
      data: {
        id: eventId,
        name: marker,
        description: "Isolated export verification",
        startsAt: new Date(Date.now() + 86400000),
        location: "Fixture",
        capacity: 2,
        memberPriceCents: 100,
        nonMemberPriceCents: 100,
        currency: "INR",
        paymentMode: "RAZORPAY_TEST",
      },
    });
    await db.ticket.create({
      data: {
        id: marker + "-ticket",
        eventId,
        code: marker,
        type: "NON_MEMBER",
        priceCents: 100,
        attendeeName: "=1+1",
        attendeeEmail: "fixture@skyline.example",
        currency: "INR",
        paymentMode: "RAZORPAY_TEST",
      },
    });
    for (const actor of [
      null,
      volunteer,
      treasurer,
      pendingStaff,
      unverified,
      disabled,
    ])
      assert.equal((await exportAttendees(actor, eventId)).status, 403);
    const attendees = await exportAttendees(staff, eventId);
    assert.equal(attendees.status, 200);
    const attendeeCsv = await attendees.text();
    assert(
      attendeeCsv.includes('"INR"') &&
        attendeeCsv.includes('"Razorpay Test Mode"'),
    );
    assert(attendeeCsv.includes('"\'=1+1"'));
    assert.match(csvDocument([[" \t=1+1", "@SUM(1)", 'a"b', "safe"]]), /'\s*=/);
    console.log(
      "PASS: attendee export rejects pending/unverified/disabled accounts, uses stored currency/mode and escapes spreadsheet formulas",
    );
  } finally {
    await db.ticket.deleteMany({ where: { id: marker + "-ticket" } });
    await db.event.deleteMany({ where: { id: eventId } });
    await db.task.deleteMany({ where: { id: taskId } });
    await db.inventoryMovement.deleteMany({ where: { itemId } });
    await db.inventoryItem.deleteMany({ where: { id: itemId } });
    await db.transaction.deleteMany({
      where: {
        OR: [
          { claimantId: { in: users } },
          { id: { in: [0, 1, 2].map((i) => marker + "-boundary-" + i) } },
        ],
      },
    });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.member.deleteMany({ where: { id: { in: members } } });
    assert.deepEqual(await snapshot(), baseline);
    await db.$disconnect();
    console.log(
      "PASS: exact fixture cleanup preserved existing application data; no provider payments or emails sent",
    );
  }
}
main().catch((error) => {
  console.error(
    "Operational verification failed. Inspect the last PASS marker; record contents and credentials were not printed.",
    "Error type:",
    error?.name || "unknown",
  );
  process.exitCode = 1;
});
