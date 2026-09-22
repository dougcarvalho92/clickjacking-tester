import type { TestResult } from "@/lib/types";

type ResultBannerProps = {
  result: TestResult;
  relative?: boolean;
};

export function ResultBanner({ result, relative = false }: ResultBannerProps) {
  if (!["blocked", "vulnerable"].includes(result.status)) return null;

  const blocked = result.status === "blocked";

  return (
    <div
      className={`result-banner show ${blocked ? "blocked" : "vulnerable"} ${relative ? "relative" : ""}`}
    >
      <span className="banner-icon">{blocked ? "🛡" : "⚠️"}</span>
      <div>
        <div>{blocked ? "🛡 PROTEGIDO" : "⚠ VULNERÁVEL"}</div>
        <div className="banner-detail">{result.message}</div>
      </div>
    </div>
  );
}
