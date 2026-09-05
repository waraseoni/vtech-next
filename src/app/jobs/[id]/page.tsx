import { redirect } from "next/navigation";

// Canonical job detail page = /jobs/{id}/view.
// Ye route (purana "manage" page) ab usi ka redirect hai — purane bookmarks,
// messaging links, notifications, `/jobs/{id}/old` save-redirects sab 0-404 me
// chale jaate hain. Sare features view page par merge kiye hain (photos
// upload/delete, real activity log, spot mgmt, thermal receipt, payment modal,
// Required Saman section).
export default async function JobDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/jobs/${id}/view`);
}
