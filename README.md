# Armazenados e Não Expostos

Sistema web para auditar o que está no depósito e ainda não foi para a área de venda.
Reescrita do sistema Java/NetBeans original em páginas estáticas + Supabase.

## Como funciona

1. **Login** com CPF/CNPJ (mesma identidade do Cota-Certa, via Supabase Auth).
2. **Gerenciamento de Operações** — cards dos sistemas (só Armazenados ativo).
3. **Lojas** — escolha a loja.
4. **Cadastrar dados** — cole as duas listas de códigos (EAN ou SKU):
   - *Armazenados e Não Expostos*
   - *Listagem Total Auditada*
5. O sistema **verifica cada código**: tenta EAN, depois SKU. Se algum não estiver
   cadastrado, avisa e **não grava nada** até cadastrar o produto ou retirar o código.
6. Com tudo válido, gera o **relatório** (imprimível) e grava a auditoria.

**Regra do percentual:** `(qtd no depósito ÷ qtd auditada) × 100`.
Exemplo: 3 no depósito e 55 auditados → **5,45%**.

## Relatórios

| Modo | O que mostra |
|---|---|
| **Por dia** | lista as auditorias do dia (com botão ABRIR) |
| **Por período** | totais, quebra **por categoria** e a lista dos itens que estavam no depósito |
| **Por loja** | todas as lojas no período (visão holding), com totais |

A impressão sai em A4 com o cabeçalho azul, os totais, a tabela e as assinaturas
**Gerente** e **Prevenção**. O envio por e-mail abre o Gmail/Outlook no navegador
já com o texto preenchido (sem depender de cliente de e-mail instalado).

## Estrutura

```
index.html                 aplicação (SPA)
assets/
  config.js                URL e chave publicável do Supabase
  api.js                   Auth, consultas e RPCs
  ui.js                    formatação, modais, toasts
  app.js                   login, layout e rotas
  styles.css
  views/
    operacoes.js           cards dos sistemas
    lojas.js               escolha da loja
    cadastrar.js           as duas listas + verificação
    relatorios.js          os três relatórios + impressão + e-mail
    produtos.js            catálogo (SKU, EAN, descrição, categoria)
supabase/migrations/       DDL aplicado no projeto compartilhado
```

## Banco de dados

Projeto Supabase **compartilhado com o Cota-Certa**:

- `produtos` e `usuarios` são as mesmas tabelas;
- o Armazenados usa o prefixo `arm_` em tudo que é só dele;
- o perfil do Armazenados (`admin` / `gerente` / `auditor`) fica em `arm_usuarios`,
  separado do `tipo` usado pelo Cota-Certa;
- quem é criado só para o Armazenados usa `tipo = 'armazenados'` e não enxerga dados
  do Cota-Certa.

Funções principais:

| Função | Papel |
|---|---|
| `arm_verificar_codigos(texto)` | valida a lista (EAN → SKU) e devolve os que faltam |
| `arm_processar_auditoria(loja, lista_deposito, lista_auditada)` | grava a auditoria e as duas listas |
| `arm_relatorio_dia(loja, data)` | auditorias do dia |
| `arm_relatorio_periodo(loja, inicio, fim)` | totais + categorias + itens |
| `arm_relatorio_por_loja(inicio, fim)` | consolidação das lojas |

## Rodar localmente

Os módulos ES precisam de um servidor (não abrem por `file://`):

```bash
python -m http.server 5500
# abra http://localhost:5500
```

## Perfis

| Perfil | Pode |
|---|---|
| `admin` | tudo, em todas as lojas |
| `gerente` | a própria loja |
| `auditor` | cria auditorias e vê as próprias |
