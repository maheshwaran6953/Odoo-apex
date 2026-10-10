import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw new Error(
      "Pass --temporary-fixtures to acknowledge isolated records will be created and deleted.",
    );
  loadEnvConfig(process.cwd());
  const { db } = await import("../src/lib/db");
  const { parseExpenseAmount, reviewExpenseRecord, financeSummary } =
    await import("../src/server/finance-service");
  const marker = `finance-verify-${randomUUID()}`;
  const userIds: string[] = [];
  const transactionIds: string[] = [];
  const baseline = await db.transaction.findMany({
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      claimantId: true,
      reviewedById: true,
      reviewedAt: true,
      decisionReason: true,
    },
    orderBy: { id: "asc" },
  });
  try {
    for (const value of [
      "-1",
      "0",
      "0.00",
      "1e3",
      "1.001",
      "100000.01",
      "NaN",
      "Infinity",
      "",
      ".50",
      "1,000",
      1,
      null,
    ])
      assert.equal(parseExpenseAmount(value), null, `reject ${String(value)}`);
    assert.equal(parseExpenseAmount("0.01"), 1);
    assert.equal(parseExpenseAmount("24.50"), 2450);
    assert.equal(parseExpenseAmount("100000.00"), 10_000_000);
    const createUser = async (
      role: string,
      approvalStatus = "APPROVED",
      verified = true,
      disabled = false,
    ) => {
      const id = `${marker}-user-${userIds.length}`;
      userIds.push(id);
      return db.user.create({
        data: {
          id,
          email: `${id}@skyline.example`,
          name: "Isolated finance verification",
          passwordHash: "NOT_A_VALID_LOGIN_HASH",
          role,
          requestedRole: role,
          approvalStatus,
          emailVerifiedAt: verified ? new Date() : null,
          disabledAt: disabled ? new Date() : null,
          emailReminders: false,
        },
      });
    };
    const claimant = await createUser("MEMBER");
    const reviewer = await createUser("TREASURER");
    const secondReviewer = await createUser("TREASURER");
    const pendingReviewer = await createUser("TREASURER", "PENDING");
    const unverifiedReviewer = await createUser("TREASURER", "APPROVED", false);
    const disabledReviewer = await createUser(
      "TREASURER",
      "APPROVED",
      true,
      true,
    );
    const request = async (
      claimantId: string | null,
      amountCents = 2500,
      currency = "USD",
    ) => {
      const id = `${marker}-request-${transactionIds.length}`;
      transactionIds.push(id);
      return db.transaction.create({
        data: {
          id,
          claimantId,
          description: "Isolated verification — club materials",
          amountCents,
          currency,
          type: "EXPENSE",
          category: "REIMBURSEMENT",
          status: "pending",
        },
      });
    };
    const normal = await request(claimant.id);
    for (const actor of [
      claimant,
      pendingReviewer,
      unverifiedReviewer,
      disabledReviewer,
    ])
      assert.equal(
        (
          await reviewExpenseRecord(
            actor.id,
            normal.id,
            "posted",
            undefined,
            db,
          )
        ).ok,
        false,
      );
    assert.equal(
      (await db.transaction.findUniqueOrThrow({ where: { id: normal.id } }))
        .status,
      "pending",
    );
    const own = await request(reviewer.id);
    assert.equal(
      (await reviewExpenseRecord(reviewer.id, own.id, "posted", undefined, db))
        .ok,
      false,
    );
    assert.equal(
      (
        await reviewExpenseRecord(
          reviewer.id,
          own.id,
          "rejected",
          "Own request",
          db,
        )
      ).ok,
      false,
    );
    const results = await Promise.all([
      reviewExpenseRecord(reviewer.id, normal.id, "posted", undefined, db),
      reviewExpenseRecord(
        secondReviewer.id,
        normal.id,
        "rejected",
        "Receipt incomplete",
        db,
      ),
    ]);
    assert.equal(
      results.filter((result) => result.ok).length,
      1,
      "concurrent approval/rejection has one winner",
    );
    const decided = await db.transaction.findUniqueOrThrow({
      where: { id: normal.id },
    });
    assert.ok(["posted", "rejected"].includes(decided.status));
    assert.ok(decided.reviewedAt);
    assert.ok(
      [reviewer.id, secondReviewer.id].includes(decided.reviewedById ?? ""),
    );
    assert.equal(
      (
        await reviewExpenseRecord(
          secondReviewer.id,
          normal.id,
          "posted",
          undefined,
          db,
        )
      ).ok,
      false,
    );
    const rejectable = await request(claimant.id, 4500, "INR");
    for (const reason of ["", "x", "a".repeat(301), "bad\nreason"])
      assert.equal(
        (
          await reviewExpenseRecord(
            reviewer.id,
            rejectable.id,
            "rejected",
            reason,
            db,
          )
        ).ok,
        false,
      );
    assert.equal(
      (
        await reviewExpenseRecord(
          reviewer.id,
          rejectable.id,
          "rejected",
          "Missing original receipt",
          db,
        )
      ).ok,
      true,
    );
    assert.equal(
      (await db.transaction.findUniqueOrThrow({ where: { id: rejectable.id } }))
        .decisionReason,
      "Missing original receipt",
    );
    for (const invalid of [
      await request(null),
      await request(claimant.id, -10),
      await request(claimant.id, 0),
      await request(claimant.id, 10_000_001),
      await request(claimant.id, 10, "ZZZ"),
    ])
      assert.equal(
        (
          await reviewExpenseRecord(
            reviewer.id,
            invalid.id,
            "posted",
            undefined,
            db,
          )
        ).ok,
        false,
      );
    const approved = await request(claimant.id, 1234, "INR");
    assert.equal(
      (
        await reviewExpenseRecord(
          reviewer.id,
          approved.id,
          "posted",
          undefined,
          db,
        )
      ).ok,
      true,
    );
    assert.equal(
      (await db.transaction.findUniqueOrThrow({ where: { id: approved.id } }))
        .status,
      "posted",
    );
    const summaryRows = [
      {
        currency: "USD",
        type: "INCOME" as const,
        status: "posted",
        amountCents: 10000,
      },
      {
        currency: "USD",
        type: "EXPENSE" as const,
        status: "posted",
        amountCents: 2000,
      },
      {
        currency: "USD",
        type: "EXPENSE" as const,
        status: "pending",
        amountCents: 500,
      },
      {
        currency: "USD",
        type: "EXPENSE" as const,
        status: "rejected",
        amountCents: 600,
      },
      {
        currency: "USD",
        type: "INCOME" as const,
        status: "test",
        amountCents: 90000,
      },
      {
        currency: "USD",
        type: "INCOME" as const,
        status: "void",
        amountCents: 90000,
      },
      {
        currency: "INR",
        type: "INCOME" as const,
        status: "posted",
        amountCents: 70000,
      },
    ];
    assert.deepEqual(financeSummary(summaryRows, "USD"), {
      income: 10000,
      expenses: 2000,
      balance: 8000,
      pendingCount: 1,
      pendingAmount: 500,
    });
    assert.equal(financeSummary(summaryRows, "INR").balance, 70000);
    assert.equal(financeSummary([], "USD").balance, 0);
    console.log(
      "PASS: amount boundaries, authoritative reviewer eligibility, ownership, self-review prevention, concurrent decisions, rejection reasons, audit fields, currency isolation and excluded statuses.",
    );
  } finally {
    await db.transaction.deleteMany({ where: { id: { in: transactionIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    assert.equal(
      await db.transaction.count({ where: { id: { in: transactionIds } } }),
      0,
    );
    assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
    const after = await db.transaction.findMany({
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        claimantId: true,
        reviewedById: true,
        reviewedAt: true,
        decisionReason: true,
      },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(after, baseline, "Existing ledger records unchanged");
    await db.$disconnect();
    console.log("PASS: isolated fixtures removed; existing ledger preserved.");
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Finance verification failed",
  );
  process.exitCode = 1;
});
