import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/campaign/admin";
import { Queue } from "./Queue";

export const metadata: Metadata = {
  title: "Queue",
  robots: { index: false, follow: false },
};

export default async function QueuePage() {
  // A 404, not a sign-in prompt. A page that says "you are not allowed in here"
  // is a page that tells you there is a here.
  if (!(await isAdmin())) notFound();
  return <Queue />;
}
