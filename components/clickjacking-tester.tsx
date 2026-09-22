"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_RESULTS,
  type TestResults,
  type TestStatus,
} from "@/lib/types";
import { normalizeTargetUrl } from "@/lib/security";

const TEST_KEYS = ["iframe1", "iframe2", "iframe3"] as const;

type TestKey = (typeof TEST_KEYS)[number];

const STATUS_TEXT: Record<TestStatus, string> = {
  idle: "Não executado",
  testing: "Testando…",
  blocked: "BLOQUEADO — Protegido",
  vulnerable: "CARREGOU — Vulnerável",
};

export default function ClickjackingTester() {
  const [targetUrl, setTargetUrl] = useState("");
  const [results, setResults] = useState<TestResults>(INITIAL_RESULTS);
  const [isTesting, setIsTesting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [reportTimestamp, setReportTimestamp] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<"pdf" | "png" | null>(null);

  useEffect(() => {
    setReportTimestamp(new Date().toLocaleString("pt-BR"));
  }, []);

  const updateResult = useCallback(
    (key: TestKey, patch: Partial<TestResults[TestKey]>) => {
      setResults((current) => ({
        ...current,
        [key]: { ...current[key], ...patch },
      }));
    },
    [],
  );

  const settleTest = useCallback(
    (key: TestKey, status: "blocked" | "vulnerable", message: string) => {
      updateResult(key, { status, message });
    },
    [updateResult],
  );

  const runSingleTest = useCallback(
    (key: TestKey, url: string, delay: number) => {
      const timer = setTimeout(() => {
        const iframe = document.getElementById(key) as HTMLIFrameElement | null;
        if (!iframe) return;

        let settled = false;
        const settle = (status: "blocked" | "vulnerable", message: string) => {
          if (settled) return;
          settled = true;
          settleTest(key, status, message);
        };

        iframe.onload = () => {
          try {
            const doc =
              iframe.contentDocument ?? iframe.contentWindow?.document;
            if (!doc || !doc.body || doc.body.innerHTML.trim() === "") {
              settle(
                "blocked",
                "Browser bloqueou o frame ou não disponibilizou conteúdo.",
              );
            } else {
              settle("vulnerable", "Conteúdo carregado e acessível no iframe.");
            }
          } catch {
            // Cross-origin access is intentionally denied by SOP. It does NOT by itself
            // prove that X-Frame-Options/CSP are absent; it means the frame navigation occurred.
            settle(
              "vulnerable",
              "Frame cross-origin carregado; o conteúdo não pode ser inspecionado via SOP.",
            );
          }
        };

        iframe.onerror = () =>
          settle("blocked", "Erro de rede ao carregar o iframe.");
        iframe.src = url;

        const timeout = setTimeout(() => {
          if (!settled) {
            try {
              const doc =
                iframe.contentDocument ?? iframe.contentWindow?.document;
              settle(
                doc?.body?.innerHTML.trim() ? "vulnerable" : "blocked",
                doc?.body?.innerHTML.trim()
                  ? "Conteúdo detectado após timeout."
                  : "Sem conteúdo detectado após timeout.",
              );
            } catch {
              settle(
                "vulnerable",
                "Frame cross-origin após timeout; conteúdo não inspecionável.",
              );
            }
          }
        }, 12000);
        timers.current.push(timeout);
      }, delay);
      timers.current.push(timer);
    },
    [settleTest],
  );

  const runTests = useCallback(
    (url = targetUrl) => {
      if (!url || isTesting) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setIsTesting(true);
      setResults({
        ...INITIAL_RESULTS,
        iframe1: {
          ...INITIAL_RESULTS.iframe1,
          status: "testing",
          message: "Carregando…",
        },
        iframe2: {
          ...INITIAL_RESULTS.iframe2,
          status: "testing",
          message: "Carregando…",
        },
        iframe3: {
          ...INITIAL_RESULTS.iframe3,
          status: "testing",
          message: "Carregando…",
        },
      });

      TEST_KEYS.forEach((key, index) => runSingleTest(key, url, index * 700));

      const completionTimer = setInterval(() => {
        setResults((current) => {
          const done = TEST_KEYS.every(
            (key) => current[key].status !== "testing",
          );
          if (done) {
            clearInterval(completionTimer);
            setIsTesting(false);
          }
          return current;
        });
      }, 250);
      timers.current.push(
        completionTimer as unknown as ReturnType<typeof setTimeout>,
      );
    },
    [isTesting, runSingleTest, targetUrl],
  );

  const startTests = () => {
    const normalized = normalizeTargetUrl(targetUrl);
    if (!normalized) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 1500);
      return;
    }
    setTargetUrl(normalized);
    runTests(normalized);
  };

  const exportResults = () => {
    const lines = [
      "RELATÓRIO DE TESTE — CLICKJACKING",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `URL testada: ${targetUrl || "(nenhuma)"}`,
      "",
      "=== RESULTADOS ===",
      ...TEST_KEYS.map((key, index) => {
        const result = results[key];
        return `Teste ${index + 1} (${result.label}): ${result.status.toUpperCase()} — ${result.message}`;
      }),
      "",
      "=== RECOMENDAÇÕES ===",
      "1. X-Frame-Options: DENY ou SAMEORIGIN",
      "2. CSP: frame-ancestors 'self'",
      "3. Auditar headers no WAF/middleware",
      "4. Repetir após cada deploy",
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clickjacking-report-${Date.now()}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const getReportElement = () => {
    const report = reportRef.current;
    if (!report) throw new Error("Relatório não encontrado.");
    return report;
  };

  const createExportClone = () => {
    const source = getReportElement();
    const clone = source.cloneNode(true) as HTMLDivElement;

    clone.classList.add("report-exporting");
    clone.removeAttribute("id");
    document.body.appendChild(clone);

    return {
      element: clone,
      cleanup: () => clone.remove(),
    };
  };

  const exportPDF = async () => {
    if (isExporting) return;

    setIsExporting("pdf");
    const { element, cleanup } = createExportClone();

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `clickjacking-report-${Date.now()}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(element)
        .save();
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert(
        "Não foi possível gerar o PDF. Verifique o console para mais detalhes.",
      );
    } finally {
      cleanup();
      setIsExporting(null);
    }
  };

  const exportPNG = async () => {
    if (isExporting) return;

    setIsExporting("png");
    const { element, cleanup } = createExportClone();

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: element.scrollWidth,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) throw new Error("Não foi possível criar a imagem.");

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `clickjacking-report-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao exportar PNG:", error);
      alert(
        "Não foi possível gerar a imagem. Verifique o console para mais detalhes.",
      );
    } finally {
      cleanup();
      setIsExporting(null);
    }
  };

  const blockedCount = TEST_KEYS.filter(
    (key) => results[key].status === "blocked",
  ).length;
  const vulnerableCount = TEST_KEYS.filter(
    (key) => results[key].status === "vulnerable",
  ).length;
  const totalDone = blockedCount + vulnerableCount;

  const verdict =
    totalDone === 0
      ? {
          className: "unknown",
          text: "⚠ Nenhum teste concluído. Execute os testes antes de exportar.",
        }
      : vulnerableCount === 0
        ? {
            className: "safe",
            text: `✔ URL PROTEGIDA — Todos os ${blockedCount} vetores foram bloqueados.`,
          }
        : {
            className: "unsafe",
            text: `✘ URL VULNERÁVEL — ${vulnerableCount} de ${totalDone} vetor(es) permitiu incorporação.`,
          };

  return (
    <>
      <main className="screen-content">
        <header className="header">
          <div className="badge">🛡 Security Tool</div>
          <h1>Clickjacking Tester</h1>
          <p>Valide se uma URL pode ser incorporada em iframe por terceiros</p>
        </header>

        <section className="url-box">
          <label htmlFor="targetUrl">URL alvo para teste</label>
          <div className="url-row">
            <input
              id="targetUrl"
              className={invalid ? "invalid" : ""}
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && startTests()}
              placeholder="https://github.com/dougcarvalho92/clickjacking-tester"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="btn-validate"
              onClick={startTests}
              disabled={isTesting}
            >
              {isTesting ? (
                <span className="spinner" />
              ) : (
                <span>▶ Validar</span>
              )}
            </button>
          </div>
        </section>

        <section className="notice">
          <strong>Ambiente de Teste de Segurança.</strong> Os iframes abaixo
          tentam incorporar a URL informada. Use sempre uma URL pública e
          acessível pela internet, por exemplo:{" "}
          <code>https://github.com/dougcarvalho92/clickjacking-tester</code>. Se
          o servidor retornar <code>X-Frame-Options: DENY/SAMEORIGIN</code> ou
          CSP <code>frame-ancestors</code>, o carregamento poderá ser bloqueado
          pelo browser. A detecção por iframe é uma indicação prática e não
          substitui a inspeção dos headers HTTP.
        </section>

        <section className="info-grid">
          <InfoCard
            title="Headers de Proteção"
            items={[
              "X-Frame-Options: DENY / SAMEORIGIN",
              "Content-Security-Policy: frame-ancestors",
              "X-Content-Type-Options: nosniff",
              "Strict-Transport-Security",
            ]}
          />
          <InfoCard
            title="Vetores Testados"
            items={[
              "Iframe direto (incorporação simples)",
              "Iframe com atributo sandbox",
              "Iframe invisível sobre UI falsa",
            ]}
          />
          <InfoCard
            title="Como Interpretar"
            items={[
              "🟢 Verde = Bloqueado (protegido)",
              "🔴 Vermelho = Carregou (indício de vulnerabilidade)",
              "🟡 Amarelo = Aguardando / testando",
            ]}
          />
        </section>

        <TestSection
          index={1}
          title="Teste 1 — Incorporação Direta"
          tag="Basic"
          result={results.iframe1}
        >
          <p className="test-desc">
            <strong>Técnica:</strong> iframe simples apontando para a URL alvo.
            <br />
            <strong>Esperado:</strong> Bloqueado pelo browser via header{" "}
            <code>X-Frame-Options</code> ou CSP.
          </p>
          <IframeBox
            id="iframe1"
            result={results.iframe1}
            overlay="Carregando teste 1…"
            title="Teste 1 – Direto"
          />
        </TestSection>

        <TestSection
          index={2}
          title="Teste 2 — Iframe com Sandbox"
          tag="Sandbox Bypass"
          result={results.iframe2}
        >
          <p className="test-desc">
            <strong>Técnica:</strong> Atributo{" "}
            <code>sandbox="allow-scripts allow-same-origin allow-forms"</code>.
            <br />
            <strong>Esperado:</strong> O sandbox não contorna proteções
            server-side; resultado deve ser equivalente ao teste 1.
          </p>
          <IframeBox
            id="iframe2"
            sandbox
            result={results.iframe2}
            overlay="Carregando teste 2…"
            title="Teste 2 – Sandbox"
          />
        </TestSection>

        <TestSection
          index={3}
          title="Teste 3 — Simulação de Ataque Real"
          tag="UI Redress"
          result={results.iframe3}
        >
          <p className="test-desc">
            <strong>Técnica:</strong> Iframe invisível (
            <code>opacity: 0.15</code>) sobreposto a um botão atrativo.
            <br />
            <strong>Esperado:</strong> Nenhum conteúdo visível no iframe; botão
            não deve desencadear ação na aplicação alvo.
          </p>
          <div className="attack-wrap">
            <button
              className="fake-btn"
              onClick={() =>
                alert(
                  "SIMULAÇÃO DE ATAQUE\n\nEm um ataque real, este clique poderia ter acionado uma ação na aplicação alvo sem o seu conhecimento.\n\nX-Frame-Options / CSP frame-ancestors evitam esse vetor.",
                )
              }
            >
              🎁 Ganhe R$ 1.000!
            </button>
            <iframe
              id="iframe3"
              className="invis-iframe"
              title="Iframe Malicioso – Simulação"
            />
          </div>
          <p className="attack-caption">
            Se conteúdo da aplicação aparecer no quadro acima, existe indício de
            vulnerabilidade de clickjacking.
          </p>
          <ResultBanner result={results.iframe3} relative />
        </TestSection>

        <div className="actions">
          <button
            className="btn btn-secondary"
            onClick={() =>
              targetUrl
                ? runTests()
                : document.getElementById("targetUrl")?.focus()
            }
          >
            ↺ Re-executar Testes
          </button>
          <button className="btn btn-secondary" onClick={exportResults}>
            ⬇ Exportar .txt
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportPDF}
            disabled={isExporting !== null}
          >
            🖨 {isExporting === "pdf" ? "Gerando PDF…" : "Exportar PDF"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportPNG}
            disabled={isExporting !== null}
          >
            🖼 {isExporting === "png" ? "Gerando PNG…" : "Exportar PNG"}
          </button>
        </div>
      </main>

      <PrintReport
        reportRef={reportRef}
        targetUrl={targetUrl}
        results={results}
        verdict={verdict}
        totalDone={totalDone}
        blockedCount={blockedCount}
        vulnerableCount={vulnerableCount}
        generatedAt={reportTimestamp}
      />
    </>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-card">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TestSection({
  index,
  title,
  tag,
  result,
  children,
}: {
  index: number;
  title: string;
  tag: string;
  result: TestResults[TestKey];
  children: React.ReactNode;
}) {
  return (
    <section className="test-section">
      <div className="test-header">
        <div className={`dot ${result.status}`} />
        <h2>{title}</h2>
        <span className="test-tag">{tag}</span>
      </div>
      <div className="test-body">
        {children}
        {index !== 3 && <ResultBanner result={result} />}
      </div>
    </section>
  );
}

function IframeBox({
  id,
  sandbox,
  result,
  overlay,
  title,
}: {
  id: TestKey;
  sandbox?: boolean;
  result: TestResults[TestKey];
  overlay: string;
  title: string;
}) {
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

function ResultBanner({
  result,
  relative = false,
}: {
  result: TestResults[TestKey];
  relative?: boolean;
}) {
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

function PrintReport({
  reportRef,
  targetUrl,
  results,
  verdict,
  totalDone,
  blockedCount,
  vulnerableCount,
  generatedAt,
}: {
  reportRef: React.RefObject<HTMLDivElement>;
  targetUrl: string;
  results: TestResults;
  verdict: { className: string; text: string };
  totalDone: number;
  blockedCount: number;
  vulnerableCount: number;
  generatedAt: string;
}) {
  const now = generatedAt || "—";
  return (
    <div id="pdfReport" ref={reportRef}>
      <div className="pr-page">
        <div className="pr-cover">
          <span className="pr-cover-badge">
            🛡 Security Report · Clickjacking Tester
          </span>
          <h1>Relatório de Teste de Clickjacking</h1>
          <p>
            Gerado automaticamente pela ferramenta de validação de segurança
          </p>
        </div>
        <p className="pr-section-title">Informações Gerais</p>
        <table className="pr-meta">
          <tbody>
            <tr>
              <td>Data / Hora</td>
              <td>{now}</td>
            </tr>
            <tr>
              <td>URL Testada</td>
              <td>{targetUrl || "—"}</td>
            </tr>
            <tr>
              <td>Testes Executados</td>
              <td>{totalDone} de 3</td>
            </tr>
            <tr>
              <td>Vetores Bloqueados</td>
              <td>{blockedCount}</td>
            </tr>
            <tr>
              <td>Vetores Vulneráveis</td>
              <td>{vulnerableCount}</td>
            </tr>
          </tbody>
        </table>
        <p className="pr-section-title">Preview dos Iframes Testados</p>
        <div className="pr-iframe-grid">
          {TEST_KEYS.map((key, index) => (
            <PrintBox
              key={key}
              index={index}
              result={results[key]}
              targetUrl={targetUrl}
            />
          ))}
        </div>
        <p className="pr-section-title">Veredicto Final</p>
        <div className={`pr-verdict ${verdict.className}`}>{verdict.text}</div>
        <p className="pr-section-title">Tabela de Resultados</p>
        <table className="pr-result-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vetor</th>
              <th>Técnica</th>
              <th>Status</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {TEST_KEYS.map((key, index) => {
              const r = results[key];
              return (
                <tr key={key}>
                  <td>{index + 1}</td>
                  <td>{r.label}</td>
                  <td>{r.tag}</td>
                  <td className={`status-${r.status}`}>
                    {STATUS_TEXT[r.status]}
                  </td>
                  <td>{r.message}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="pr-section-title">Recomendações</p>
        <ul className="pr-recs">
          <li>
            Configurar <strong>X-Frame-Options: DENY</strong> ou{" "}
            <strong>SAMEORIGIN</strong> em endpoints compatíveis.
          </li>
          <li>
            Implementar{" "}
            <strong>Content-Security-Policy: frame-ancestors 'self'</strong> via
            header HTTP.
          </li>
          <li>
            Auditar middlewares e WAF para garantia dos headers em toda a camada
            de resposta.
          </li>
          <li>Repetir o teste após cada deploy para validação contínua.</li>
          <li>
            Documentar o resultado no controle de vulnerabilidades da equipe de
            segurança.
          </li>
        </ul>
        <div className="pr-footer">
          <span>Clickjacking Tester — Ferramenta interna de segurança</span>
          <span>{now}</span>
        </div>
      </div>
    </div>
  );
}

function PrintBox({
  index,
  result,
  targetUrl,
}: {
  index: number;
  result: TestResults[TestKey];
  targetUrl: string;
}) {
  const icon = { blocked: "🛡", vulnerable: "⚠", testing: "⏳", idle: "○" }[
    result.status
  ];
  return (
    <div className={`pr-iframe-box ${result.status}`}>
      <div className="pr-iframe-chrome">
        <div className="pr-chrome-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="pr-chrome-url">{targetUrl || "about:blank"}</div>
      </div>
      <div className={`pr-iframe-viewport ${result.status}`}>
        <div className="pr-iframe-icon">{icon}</div>
        <div className={`pr-iframe-status-text ${result.status}`}>
          {STATUS_TEXT[result.status]}
        </div>
        <div className="pr-iframe-sub">{result.message}</div>
      </div>
      <div className="pr-iframe-label">
        Teste {index + 1} — {result.label} <span>({result.tag})</span>
      </div>
    </div>
  );
}
