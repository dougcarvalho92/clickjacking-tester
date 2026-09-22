"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_RESULTS, type TestResults } from "@/lib/types";
import { normalizeTargetUrl } from "@/lib/security";
import { FabPrintButton } from "./fab-print-button";
import { IframeBox } from "./iframe-box";
import { InfoCard } from "./info-card";
import { TestSection } from "./test-section";

const TEST_KEYS = ["iframe1", "iframe2", "iframe3"] as const;

type TestKey = (typeof TEST_KEYS)[number];

export default function ClickjackingTester() {
  const [targetUrl, setTargetUrl] = useState("");
  const [results, setResults] = useState<TestResults>(INITIAL_RESULTS);
  const [isTesting, setIsTesting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
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
            settle(
              "blocked",
              "Frame cross-origin carregou, mas o conteúdo não pôde ser inspecionado; sem evidência conclusiva de vulnerabilidade.",
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
                "blocked",
                "Frame cross-origin após timeout; conteúdo não inspecionável e sem evidência de vulnerabilidade.",
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

  const blockedCount = TEST_KEYS.filter(
    (key) => results[key].status === "blocked",
  ).length;
  const vulnerableCount = TEST_KEYS.filter(
    (key) => results[key].status === "vulnerable",
  ).length;
  const totalDone = blockedCount + vulnerableCount;

  // kept for future summary/reporting if needed by the UI later.
  void totalDone;
  void vulnerableCount;
  void blockedCount;

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
              placeholder="https://exemplo.com/sua-aplicacao"
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
          acessível pela internet. Para exemplo de referência pública, você pode
          testar manualmente o repositório{" "}
          <code>https://github.com/dougcarvalho92/clickjacking-tester</code> no
          campo acima. Se o servidor retornar{" "}
          <code>X-Frame-Options: DENY/SAMEORIGIN </code>
          ou CSP <code>frame-ancestors</code>, o carregamento poderá ser
          bloqueado pelo browser. A detecção por iframe é uma indicação prática
          e não substitui a inspeção dos headers HTTP.
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
          title="Teste 3 — Simulação de Ataque Real"
          tag="UI Redress"
          result={results.iframe3}
          relative
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
        </TestSection>

        <FabPrintButton />
      </main>
    </>
  );
}
