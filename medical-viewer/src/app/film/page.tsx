import type { Metadata } from "next";
import FilmViewer from "@/components/film/FilmViewer";

export const metadata: Metadata = {
  title: "胶片浏览",
  description: "多序列胶片浏览",
};

export default function FilmPage() {
  return <FilmViewer />;
}
