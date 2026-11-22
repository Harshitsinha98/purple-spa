import { SmoothScroll } from "@/components/providers/smooth-scroll";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  );
}
