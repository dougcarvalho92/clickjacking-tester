import type { TestResult } from "@/lib/types";

type IframeBoxProps = {
  id: string;
  sandbox?: boolean;
  result: TestResult;
  overlay: string;
  title: string;
};

export function IframeBox({
  id,
  sandbox,
  result,
  overlay,
  title,
}: IframeBoxProps) {
  return (
    <div className={`iframe-wrap ${result.status}`}>
      <span className="top-label">
        Monitorando iframe{sandbox ? " sandboxed" : " direto"}…
      </span>
      {result.status === "testing" && (
        <div className="loading-overlay">
          <div className="big-spinner" />
          <span>{overlay}</span>
        </div>
      )}
      <iframe
        id={id}
        sandbox={
          sandbox ? "allow-scripts allow-same-origin allow-forms" : undefined
        }
        title={title}
      />
    </div>
  );
}
