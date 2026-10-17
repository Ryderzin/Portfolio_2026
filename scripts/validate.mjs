// Valida content/ sem gerar o site.
// Uso: node scripts/validate.mjs

import { imprimirRelatorio, validarDoDisco } from './conteudo.mjs';

try {
  const { conteudo, problemas } = await validarDoDisco();
  if (!imprimirRelatorio(conteudo, problemas)) process.exitCode = 1;
} catch (erro) {
  console.error(`Erro na validação: ${erro.message}`);
  process.exitCode = 1;
}
