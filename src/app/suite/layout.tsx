import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND_NAME, BRAND_SUITE_SUBTITLE } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Test suites · ${BRAND_NAME}`,
  description: `${BRAND_SUITE_SUBTITLE} — judge-backed rubrics and assertions.`,
};

export default function SuiteLayout({ children }: { children: ReactNode }) {
  return children;
}
