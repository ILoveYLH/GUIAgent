import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "手机访问",
  description: "扫码在手机上打开本站",
};

export default function QrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
