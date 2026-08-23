// Automated smoke test - exercises the real API end-to-end so you can
// verify the whole system works with one command, without manually
// clicking through the UI every time.
//
// Requires the backend to already be running (npm run dev) and seeded
// (npm run seed) against whatever database MONGO_URI in .env points to.
//
// Usage:  npm run smoke
// Or:     BASE_URL=http://localhost:5000/api node scripts/smokeTest.js
//
// This exercises the same 10 scenarios listed in the Verification/Test
// Checklist (Section 9) of the Technical Specification sign-off document -
// running it here first means the manual walkthrough should already be a
// formality by the time QC does it by hand.

const BASE_URL = process.env.BASE_URL || "http://localhost:5000/api";
const PASSWORD = "ChangeMe123!";

let passCount = 0;
let failCount = 0;
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  if (pass) passCount++;
  else failCount++;
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? " :: " + detail : ""}`);
}

async function req(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

async function login(email) {
  const { status, data } = await req("POST", "/auth/login", { email, password: PASSWORD });
  if (status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data; // { token, user }
}

async function main() {
  console.log(`Running smoke test against ${BASE_URL}\n`);

  // 1. Health check
  try {
    const { status, data } = await req("GET", "/health");
    record("API health check", status === 200 && data?.status === "ok");
  } catch (err) {
    record("API health check", false, err.message);
    console.log("\nBackend is not reachable - is it running (npm run dev) and is BASE_URL correct?");
    printSummary();
    process.exit(1);
  }

  // 2. Login as a seeded Captain
  let captainAuth;
  try {
    captainAuth = await login("captain1@loreal-ea-cmms.local");
    record("Line Captain login", !!captainAuth.token && captainAuth.user.role === "Captain");
  } catch (err) {
    record("Line Captain login", false, err.message);
    console.log("\nSeeded accounts not found - did you run `npm run seed`?");
    printSummary();
    process.exit(1);
  }

  // 3. Fetch the captain's assigned line's machines
  const lineId = captainAuth.user.assignedLineId;
  const { data: machines } = await req("GET", `/lines/${lineId}/machines`, null, captainAuth.token);
  record("Fetch assigned line's machines", Array.isArray(machines) && machines.length > 0,
    `${machines?.length || 0} machines found`);
  const machine = machines[0];

  // 4. Fetch machine detail (components)
  const { data: detail } = await req("GET", `/machines/${machine._id}/detail`, null, captainAuth.token);
  record("Fetch machine detail", !!detail?.components?.length,
    `${detail?.components?.length || 0} components found`);
  const component = detail.components[0];

  // 5. Fetch failure taxonomy
  const { data: failureTypes } = await req("GET", "/failure-types", null, captainAuth.token);
  record("Fetch failure taxonomy", Array.isArray(failureTypes) && failureTypes.length > 0,
    failureTypes?.join(", "));
  const failureType = failureTypes[0];

  // 6. Submit breakdown reports until the critical-alert threshold fires.
  // Component default is 3 failures / 30 days (Personalization Requirements
  // Section 5), so 3 submissions against the same component should trigger it.
  let alertFromSubmission = null;
  for (let i = 1; i <= 3; i++) {
    const { status, data } = await req("POST", "/breakdowns", {
      lineId, machineId: machine._id, componentId: component._id,
      failureType, severity: 6, description: `Smoke test report #${i}`, downtimeMinutes: 15,
    }, captainAuth.token);
    if (status !== 201) {
      record(`Submit breakdown report #${i}`, false, JSON.stringify(data));
    } else {
      record(`Submit breakdown report #${i}`, true, data.criticalAlert ? "critical alert present" : "no alert yet");
      if (data.criticalAlert) alertFromSubmission = data.criticalAlert;
    }
  }
  record("Critical alert auto-triggered at threshold", !!alertFromSubmission,
    alertFromSubmission ? `alert id ${alertFromSubmission._id}, failureCount ${alertFromSubmission.failureCount}` : "no alert returned");

  // 7. Login as Admin, confirm the alert is visible plant-wide
  const adminAuth = await login("admin@loreal-ea-cmms.local");
  record("Admin login", !!adminAuth.token && adminAuth.user.role === "Admin");

  const { data: alerts } = await req("GET", "/alerts", null, adminAuth.token);
  const alert = alerts.find((a) => a.componentId?._id === component._id || a.componentId === component._id);
  record("Alert visible on plant-wide Critical Alerts list", !!alert && alert.status === "Critical");

  if (!alert) {
    console.log("\nCould not find the triggered alert - skipping acknowledge/resolve steps.");
    printSummary();
    return;
  }

  // 8. Resolve without root cause should be REJECTED (this is the point of
  // the two-step clearance - see the Refined Feature Design)
  const { status: rejectStatus } = await req("PATCH", `/alerts/${alert._id}/resolve`, {}, adminAuth.token);
  record("Resolve WITHOUT root cause is correctly rejected", rejectStatus === 400);

  // 9. Acknowledge
  const { status: ackStatus, data: ackData } = await req("PATCH", `/alerts/${alert._id}/acknowledge`, null, adminAuth.token);
  record("Acknowledge critical alert", ackStatus === 200 && ackData.status === "Acknowledged");

  // 10. Resolve WITH root cause - should succeed
  const { status: resolveStatus, data: resolveData } = await req("PATCH", `/alerts/${alert._id}/resolve`, {
    rootCause: "Smoke test root cause - worn bearing",
    correctiveAction: "Smoke test corrective action - bearing replaced",
  }, adminAuth.token);
  record("Resolve WITH root cause succeeds", resolveStatus === 200 && resolveData.status === "Resolved");

  // 11. Component status should be back to Normal
  const { data: detailAfter } = await req("GET", `/machines/${machine._id}/detail`, null, adminAuth.token);
  const componentAfter = detailAfter.components.find((c) => c._id === component._id);
  record("Component status returns to Normal after resolution", componentAfter?.currentStatus === "Normal");

  // 12. Submit a production log and check OEE calculation
  const now = new Date();
  const start = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const { status: logStatus, data: logData } = await req("POST", "/production-logs", {
    lineId, machineId: machine._id, shiftLabel: "Smoke Test Shift",
    periodStart: start.toISOString(), periodEnd: now.toISOString(),
    piecesProduced: 4200, rejectedPieces: 80, scheduledMinutes: 480,
  }, captainAuth.token);
  record("Submit production log", logStatus === 201);
  record("OEE metrics computed (Performance Rate + full OEE both present)",
    logStatus === 201 && typeof logData?.metrics?.performanceRate === "number" && typeof logData?.metrics?.oee === "number",
    logStatus === 201 ? `performanceRate=${logData.metrics.performanceRate}, oee=${logData.metrics.oee}` : "");

  // 13. Role restriction check: Captain should NOT be able to reach admin-only routes
  const { status: forbiddenStatus } = await req("GET", "/breakdowns", null, captainAuth.token);
  record("Role restriction: Captain blocked from admin breakdown list", forbiddenStatus === 403);

  printSummary();
}

function printSummary() {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Smoke test complete: ${passCount} passed, ${failCount} failed`);
  console.log("=".repeat(50));
  if (failCount > 0) {
    console.log("\nFailed checks:");
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.name}${r.detail ? ": " + r.detail : ""}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nSmoke test crashed:", err);
  process.exitCode = 1;
});
