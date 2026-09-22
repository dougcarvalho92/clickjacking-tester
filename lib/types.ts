export type TestStatus = 'idle' | 'testing' | 'blocked' | 'vulnerable';

export type TestResult = {
  status: TestStatus;
  message: string;
  label: string;
  tag: string;
};

export type TestResults = Record<'iframe1' | 'iframe2' | 'iframe3', TestResult>;

export const INITIAL_RESULTS: TestResults = {
  iframe1: { status: 'idle', message: 'Aguardando URL', label: 'Incorporação Direta', tag: 'Basic' },
  iframe2: { status: 'idle', message: 'Aguardando URL', label: 'Sandbox Bypass', tag: 'Sandbox Bypass' },
  iframe3: { status: 'idle', message: 'Aguardando URL', label: 'Simulação UI Redress', tag: 'UI Redress' },
};
