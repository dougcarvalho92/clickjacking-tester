import type { ReactNode } from "react";
import type { TestResult } from "@/lib/types";
import { ResultBanner } from "./result-banner";

type TestSectionProps = {
  title: string;
  tag: string;
  result: TestResult;
  relative?: boolean;
  children: ReactNode;
};

export function TestSection({
  title,
  tag,
  result,
  relative = false,
  children,
}: TestSectionProps) {
  return (
    <section className="test-section">
      <div className="test-header">
        <div className={`dot ${result.status}`} />
        <h2>{title}</h2>
        <span className="test-tag">{tag}</span>
      </div>
      <div className="test-body">
        {children}
        <ResultBanner result={result} relative={relative} />
      </div>
    </section>
  );
}
