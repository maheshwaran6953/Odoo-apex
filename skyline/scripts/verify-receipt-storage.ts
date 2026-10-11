let verificationPhase = "initialization";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";

async function main() {
  if (
    !process.argv.includes("--real-storage") ||
    !process.argv.includes("--temporary-fixtures")
  )
    throw Error(
      "Use --real-storage --temporary-fixtures; uploads a harmless temporary receipt and removes its exact records/object.",
    );
  loadEnvConfig(process.cwd());
  const { db } = await import("../src/lib/db");
  const { submitExpense, downloadExpenseReceipt } =
    await import("../src/server/expense-service");
  const { receiptStorage, setupReceiptStorage } =
    await import("../src/server/receipt-storage");
  const { tokenHash } = await import("../src/lib/password");
  const base = process.argv[process.argv.indexOf("--base-url") + 1];
  if (
    process.argv.includes("--base-url") &&
    !/^http:\/\/localhost:\d{2,5}$/.test(base ?? "")
  )
    throw Error("HTTP integration checks must target the local app.");
  const marker = "receipt-live-" + randomUUID(),
    users: string[] = [],
    sessions: string[] = [];
  const ledger = await db.transaction.findMany({ orderBy: { id: "asc" } });
  const initialUserCount = await db.user.count();
  const initialSessionCount = await db.session.count();
  let path: string | null = null;
  try {
    verificationPhase = "bucket setup";
    await setupReceiptStorage();
    const actor = async (
      role: string,
      approvalStatus = "APPROVED",
      verified = true,
    ) => {
      const id = marker + "-" + users.length;
      users.push(id);
      const user = await db.user.create({
        data: {
          id,
          name: "Temporary private receipt check",
          email: id + "@skyline.example",
          passwordHash: "NOT_A_LOGIN_HASH",
          role,
          requestedRole: role,
          approvalStatus,
          emailVerifiedAt: verified ? new Date() : null,
          emailReminders: false,
        },
      });
      const token = randomBytes(32).toString("hex");
      sessions.push(tokenHash(token));
      await db.session.create({
        data: {
          id: tokenHash(token),
          userId: id,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
      return { user, token };
    };
    const owner = await actor("MEMBER"),
      other = await actor("MEMBER"),
      staff = await actor("STAFF"),
      treasurer = await actor("TREASURER"),
      pendingTreasurer = await actor("TREASURER", "PENDING"),
      unverifiedTreasurer = await actor("TREASURER", "APPROVED", false);
    const file = new File(
      ["%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"],
      "skyline-temporary-receipt.pdf",
      { type: "application/pdf" },
    );
    const key = randomUUID();
    assert.equal(
      (
        await submitExpense(owner.user.id, {
          description: "Temporary storage acceptance check",
          amountCents: 1,
          currency: "INR",
          requestKey: key,
          file,
        })
      ).ok,
      true,
    );
    const claim = await db.transaction.findUniqueOrThrow({
      where: { requestKey: owner.user.id + ":" + key },
    });
    path = claim.receiptPath;
    assert(path);
    verificationPhase = "real file download checks";
    const expected = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");
    for (const person of [owner, treasurer]) {
      const response = await downloadExpenseReceipt(person.user.id, claim.id);
      assert.equal(response.status, 200);
      assert.equal(
        createHash("sha256")
          .update(Buffer.from(await response.arrayBuffer()))
          .digest("hex"),
        expected,
      );
    }
    for (const person of [other, staff, pendingTreasurer, unverifiedTreasurer])
      assert.notEqual(
        (await downloadExpenseReceipt(person.user.id, claim.id)).status,
        200,
      );
    const publicUrl =
      process.env.SUPABASE_URL +
      "/storage/v1/object/public/" +
      (process.env.SUPABASE_RECEIPTS_BUCKET || "skyline-receipts") +
      "/" +
      path;
    const anonymous = await fetch(publicUrl);
    assert(
      !anonymous.ok,
      "Private receipt must not have anonymous/public access",
    );
    console.log(
      "PASS: real Supabase private upload, byte-identical owner/Treasurer downloads, foreign/Staff/pending/unverified denial, anonymous public URL denied",
    );
    if (process.argv.includes("--base-url")) {
      verificationPhase = "live HTTP route checks";
      const loginHtml = await (await fetch(base + "/login")).text();
      const credentialForms = Array.from(
        loginHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g),
      )
        .map((match) => match[0])
        .filter((form) => form.includes('name="password"'));
      assert(credentialForms.length > 0);
      for (const form of credentialForms) {
        assert.match(form, /^<form\b[^>]*method="post"/);
        assert.match(form, /<fieldset\b[^>]*disabled/);
      }
      console.log(
        "PASS: server-rendered login cannot fall back to credential-bearing GET submission before hydration",
      );
      verificationPhase = "receipt HTTP authorization and exact bytes";
      const endpoint = base + "/api/receipts/" + claim.id;
      assert.equal((await fetch(endpoint)).status, 401);
      for (const person of [owner, treasurer]) {
        const response = await fetch(endpoint, {
          headers: { Cookie: "skyline_session=" + person.token },
        });
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get("Cache-Control"),
          "private, no-store",
        );
        assert.equal(
          createHash("sha256")
            .update(Buffer.from(await response.arrayBuffer()))
            .digest("hex"),
          expected,
        );
      }
      for (const person of [
        other,
        staff,
        pendingTreasurer,
        unverifiedTreasurer,
      ])
        assert.notEqual(
          (
            await fetch(endpoint, {
              headers: { Cookie: "skyline_session=" + person.token },
            })
          ).status,
          200,
        );
      verificationPhase = "finance HTTP export authorization";
      const exportEndpoint = base + "/api/finance/export";
      assert.equal((await fetch(exportEndpoint)).status, 403);
      for (const person of [
        other,
        staff,
        pendingTreasurer,
        unverifiedTreasurer,
      ])
        assert.equal(
          (
            await fetch(exportEndpoint, {
              headers: { Cookie: "skyline_session=" + person.token },
            })
          ).status,
          403,
        );
      const approvedExport = await fetch(
        exportEndpoint + "?q=Temporary%20storage%20acceptance",
        { headers: { Cookie: "skyline_session=" + treasurer.token } },
      );
      assert.equal(approvedExport.status, 200);
      verificationPhase =
        "attendee HTTP authorization and missing-event response";
      const attendeeEndpoint =
        base + "/api/events/receipt-fixture-missing-event/attendees";
      for (const person of [
        other,
        treasurer,
        pendingTreasurer,
        unverifiedTreasurer,
      ])
        assert.equal(
          (
            await fetch(attendeeEndpoint, {
              headers: { Cookie: "skyline_session=" + person.token },
            })
          ).status,
          403,
        );
      assert.equal(
        (
          await fetch(attendeeEndpoint, {
            headers: { Cookie: "skyline_session=" + staff.token },
          })
        ).status,
        404,
      );
      for (const person of [pendingTreasurer, unverifiedTreasurer]) {
        verificationPhase =
          "public events for " +
          (person.user.emailVerifiedAt ? "pending" : "unverified") +
          " account";
        const publicPage = await fetch(base + "/events", {
          headers: { Cookie: "skyline_session=" + person.token },
          redirect: "manual",
        });
        assert.equal(publicPage.status, 200);
        verificationPhase = "protected account redirect";
        const protectedPage = await fetch(base + "/account", {
          headers: { Cookie: "skyline_session=" + person.token },
          redirect: "manual",
        });
        assert([303, 307].includes(protectedPage.status));
      }
      console.log(
        "PASS: running Next.js receipt/finance/attendee handlers and public/protected pages enforce actual session/account/ownership boundaries",
      );
    }
  } catch (error) {
    const failure = error as {
      name?: string;
      actual?: unknown;
      expected?: unknown;
    };
    console.error(
      "Acceptance step:",
      verificationPhase,
      "error type:",
      failure.name || "unknown",
      "actual status/count:",
      typeof failure.actual === "number" ? failure.actual : "redacted",
      "expected status/count:",
      typeof failure.expected === "number" ? failure.expected : "redacted",
    );
    throw error;
  } finally {
    verificationPhase = "exact fixture cleanup";
    if (!path)
      path =
        (
          await db.transaction.findFirst({
            where: { claimantId: { in: users } },
            select: { receiptPath: true },
          })
        )?.receiptPath ?? null;
    if (path) await receiptStorage.remove(path);
    await db.transaction.deleteMany({ where: { claimantId: { in: users } } });
    await db.session.deleteMany({ where: { id: { in: sessions } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    verificationPhase = "ledger preservation";
    assert.deepEqual(
      await db.transaction.findMany({ orderBy: { id: "asc" } }),
      ledger,
    );
    verificationPhase = "user count preservation";
    assert.equal(await db.user.count(), initialUserCount);
    verificationPhase = "session count preservation";
    assert.equal(await db.session.count(), initialSessionCount);
    await db.$disconnect();
    console.log(
      "PASS: exact temporary storage object, claim, sessions and users removed; existing ledger/accounts preserved; no real money transferred or email sent",
    );
  }
}
main().catch((error) => {
  console.error(
    "Failure phase:",
    verificationPhase,
    "type:",
    error?.name || "unknown",
    "code:",
    typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : "REDACTED",
  );
  console.error(
    "Private receipt acceptance failed. Review configuration and the specific failed step; credentials were not printed.",
  );
  process.exitCode = 1;
});
