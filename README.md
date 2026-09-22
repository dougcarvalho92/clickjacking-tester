# Clickjacking Tester

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Estrutura

- `app/` — entrada da aplicação e estilos globais.
- `components/clickjacking-tester.tsx` — UI e orquestração dos testes no navegador.
- `lib/security.ts` — validação/normalização da URL.
- `lib/types.ts` — modelos e estados dos testes.

## Exportações

- `.txt`: download local no navegador.
- PDF: usa a impressão do navegador com layout A4 dedicado (`@media print`).

## Observação de segurança

Um iframe cross-origin pode carregar normalmente e, ao mesmo tempo, impedir acesso ao `document` por Same-Origin Policy. Por isso, a tentativa de leitura do `contentDocument` não é uma prova isolada de ausência de `X-Frame-Options`/`frame-ancestors`. Para uma auditoria definitiva, os headers HTTP devem ser inspecionados diretamente.

## Exportação de relatório

O relatório atual pode ser exportado diretamente no navegador:

- **PDF** — `html2pdf.js` + `html2canvas`, em A4.
- **PNG** — `html2canvas`, capturando o relatório completo.
- **TXT** — mantém a exportação textual original.

As bibliotecas são carregadas dinamicamente apenas quando o usuário clica no botão de exportação, evitando carregá-las no bundle inicial da página.
