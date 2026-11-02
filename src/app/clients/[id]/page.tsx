import { redirect } from "next/navigation";

// Canonical client profile = /clients/{id}/view. Purane bookmarks/links 404 na
// hon, isliye ye route wahan redirect karta hai.
export default async function ClientDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}/view`);
}
