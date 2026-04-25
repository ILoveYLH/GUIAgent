import type { Metadata } from "next";
import HdModePage from "@/components/hd/HdModePage";

export const metadata: Metadata = {
  title: "HD 影像浏览",
  description: "DICOM HD 阅片",
};

export default function HdPage() {
  return <HdModePage />;
}
