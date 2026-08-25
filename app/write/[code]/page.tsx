import { Desk } from "./Desk";

export const metadata = {
  // A draft is nobody's business but its author's, and a room code in the index
  // is a room code anybody can walk into.
  robots: { index: false, follow: false },
};

export default async function DeskPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Desk code={code.toUpperCase()} />;
}
