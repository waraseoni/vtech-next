import { sendPushToAll, sendPushToUser, type PushPayload } from "./push-send";

// ─── Pre-built Notification Triggers ───────────────────────────────────────
// In functions ko kisi bhi API route / server action se call karo.
// Sab free hai — sirf VAPID keys chahiye.

/** Payment due reminder — admin ko push bhejo */
export async function notifyPaymentDue(opts: {
  clientName: string;
  amount: number;
  daysOverdue: number;
  adminUserId?: string;
}): Promise<void> {
  const payload: PushPayload = {
    title: "Payment Due!",
    body: `${opts.clientName} ka ₹${opts.amount.toLocaleString("en-IN")} payment ${opts.daysOverdue} din se pending hai.`,
    url: "/reports/due-reminders",
    tag: `payment-due-${opts.clientName}`,
  };

  if (opts.adminUserId) {
    await sendPushToUser(opts.adminUserId, payload);
  } else {
    await sendPushToAll(payload);
  }
}

/** Low stock alert — admin ko push bhejo */
export async function notifyLowStock(opts: {
  productName: string;
  currentStock: number;
  adminUserId?: string;
}): Promise<void> {
  const payload: PushPayload = {
    title: "Low Stock Alert",
    body: `"${opts.productName}" ka stock sirf ${opts.currentStock} bacha hai. Reorder karein.`,
    url: "/inventory",
    tag: `low-stock-${opts.productName}`,
  };

  if (opts.adminUserId) {
    await sendPushToUser(opts.adminUserId, payload);
  } else {
    await sendPushToAll(payload);
  }
}

/** Job status changed — client ko notify karo (agar uske device par push enabled hai) */
export async function notifyJobStatusChanged(opts: {
  jobId: string;
  jobTitle: string;
  newStatus: string;
  clientUserId?: string;
}): Promise<void> {
  const statusLabels: Record<string, string> = {
    "1": "Pending",
    "2": "In Progress",
    "3": "Finished",
    "4": "Paid",
    "5": "Delivered",
    "0": "Cancelled",
  };

  const payload: PushPayload = {
    title: "Job Update",
    body: `Aapka job "${opts.jobTitle}" ab ${statusLabels[opts.newStatus] || opts.newStatus} hai.`,
    url: `/jobs/${opts.jobId}`,
    tag: `job-${opts.jobId}`,
  };

  if (opts.clientUserId) {
    await sendPushToUser(opts.clientUserId, payload);
  }
}

/** Attendance missing alert — admin ko */
export async function notifyAttendanceMissing(opts: {
  staffName: string;
  date: string;
  adminUserId?: string;
}): Promise<void> {
  const payload: PushPayload = {
    title: "Attendance Missing",
    body: `${opts.staffName} ki ${opts.date} ko attendance mark nahi hui.`,
    url: "/attendance",
    tag: `attendance-${opts.staffName}-${opts.date}`,
  };

  if (opts.adminUserId) {
    await sendPushToUser(opts.adminUserId, payload);
  } else {
    await sendPushToAll(payload);
  }
}

/** Custom notification — koi bhi message bhejo */
export async function notifyCustom(opts: {
  title: string;
  body: string;
  url?: string;
  userId?: string;
}): Promise<void> {
  const payload: PushPayload = {
    title: opts.title,
    body: opts.body,
    url: opts.url || "/dashboard",
    tag: "custom",
  };

  if (opts.userId) {
    await sendPushToUser(opts.userId, payload);
  } else {
    await sendPushToAll(payload);
  }
}
