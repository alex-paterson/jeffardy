import { gameViewMetadata } from "@/lib/viewTitle";

export function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return gameViewMetadata(params, "Host");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
