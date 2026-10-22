// Idiomas do site. Módulo puro (sem DOM, rede ou disco): o build usa no Node e o painel no navegador.
// O primeiro de site.idiomas é o principal; os outros são traduções.
// Cada tradução fica num arquivo ao lado do original, só com os textos traduzidos:
// "sobre.json" → "sobre.en.json", "projetos/x/projeto.json" → "projetos/x/projeto.en.json".
// O que não estiver traduzido usa o texto do idioma principal.

// Idiomas do site; sem a lista, o site tem só o idioma principal.
export function idiomasDo(site) {
  return Array.isArray(site?.idiomas) && site.idiomas.length ? site.idiomas : [{ codigo: site?.idioma }];
}

export function traducoesDo(site) {
  return idiomasDo(site).slice(1);
}

// Prefixo das páginas de um idioma: '' no principal, '/en' nos outros.
export function prefixoDe(site, codigo) {
  return codigo === idiomasDo(site)[0].codigo ? '' : `/${String(codigo).toLowerCase()}`;
}

// Arquivo de tradução de um original: "sobre.json" + "en" → "sobre.en.json".
export function arquivoTraducao(arquivo, codigo) {
  return arquivo.replace(/\.json$/, `.${String(codigo).toLowerCase()}.json`);
}

// "projeto.en.json", "sobre.pt-br.json"…: arquivos que são traduções, não conteúdo próprio.
export function ehArquivoTraducao(caminho) {
  return /\.[a-z]{2,3}(-[a-z0-9]{2,8})?\.json$/i.test(caminho);
}

function ehObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Aplica a tradução sobre o original. Objetos se juntam campo a campo; listas, item a item
// (pela posição); textos traduzidos substituem os originais. Texto vazio ou ausente, null
// e itens a mais na tradução são ignorados: valem os do original.
export function aplicarTraducao(original, traducao) {
  if (traducao === undefined || traducao === null) return original;
  if (Array.isArray(original)) {
    if (!Array.isArray(traducao)) return original;
    return original.map((item, i) => aplicarTraducao(item, traducao[i]));
  }
  if (ehObjeto(original)) {
    if (!ehObjeto(traducao)) return original;
    const saida = { ...original };
    for (const [chave, valor] of Object.entries(traducao)) {
      saida[chave] = Object.hasOwn(original, chave) ? aplicarTraducao(original[chave], valor) : valor;
    }
    return saida;
  }
  if (typeof traducao === 'string') return traducao.trim() === '' ? original : traducao;
  return original;
}

// Remove da tradução o que não traduz nada: textos vazios, objetos vazios e nulls no fim das listas.
// Devolve undefined quando não sobra nada.
export function podarTraducao(valor) {
  if (Array.isArray(valor)) {
    const lista = valor.map((item) => podarTraducao(item) ?? null);
    while (lista.length && lista.at(-1) === null) lista.pop();
    return lista.length ? lista : undefined;
  }
  if (ehObjeto(valor)) {
    const saida = {};
    for (const [chave, item] of Object.entries(valor)) {
      const podado = podarTraducao(item);
      if (podado !== undefined) saida[chave] = podado;
    }
    return Object.keys(saida).length ? saida : undefined;
  }
  if (typeof valor === 'string') return valor.trim() === '' ? undefined : valor;
  return valor ?? undefined;
}

// Informações de idioma que os renderizadores recebem em site.lingua:
// { codigo, prefixo, principal, todos: [{ codigo, sigla, nome, prefixo }] }.
export function linguaDe(site, codigo) {
  const todos = idiomasDo(site).map((idioma) => ({ ...idioma, prefixo: prefixoDe(site, idioma.codigo) }));
  return { codigo, prefixo: prefixoDe(site, codigo), principal: todos[0].codigo, todos };
}

// Site pronto para renderizar num idioma: textos traduzidos, idioma e site.lingua.
export function siteNoIdioma(site, traducao, codigo) {
  return { ...aplicarTraducao(site, traducao), idioma: codigo, lingua: linguaDe(site, codigo) };
}
