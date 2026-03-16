import Link from 'next/link';

export const metadata = {
  title: 'Politica de Privacidade | ServiceDesk Pro',
  description: 'Politica de Privacidade e protecao de dados conforme LGPD',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12">
          <Link href="/" className="text-brand-600 dark:text-brand-400 hover:underline text-sm mb-4 inline-block">
            &larr; Voltar ao inicio
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Politica de Privacidade
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Ultima atualizacao: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </header>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {/* 1. Introducao */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              1. Introducao
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              A <strong>ServiceDesk Pro</strong> (&quot;nos&quot;, &quot;nosso&quot; ou &quot;Empresa&quot;) esta comprometida com a protecao
              da privacidade e dos dados pessoais de seus usuarios, em conformidade com a Lei Geral de Protecao de
              Dados Pessoais (Lei n. 13.709/2018 — LGPD) e demais normas aplicaveis. Esta Politica de Privacidade
              descreve como coletamos, utilizamos, armazenamos, compartilhamos e protegemos suas informacoes
              pessoais ao utilizar nossa plataforma de gestao de chamados e servicos de TI.
            </p>
          </section>

          {/* 2. Dados Coletados */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              2. Dados Pessoais Coletados
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Coletamos os seguintes dados pessoais para viabilizar a prestacao de nossos servicos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Dados de identificacao:</strong> nome completo, endereco de e-mail, telefone (quando fornecido),
                cargo e departamento dentro da organizacao.
              </li>
              <li>
                <strong>Dados de autenticacao:</strong> senha (armazenada com hash bcrypt de 12 rounds), tokens de
                sessao, dados de autenticacao multifator (MFA), credenciais WebAuthn e registros de login.
              </li>
              <li>
                <strong>Dados de tickets e chamados:</strong> titulo, descricao, anexos, comentarios, historico de
                atividades, categorizacao, prioridade e status dos chamados abertos.
              </li>
              <li>
                <strong>Dados de uso e navegacao:</strong> enderecos IP, tipo de navegador, sistema operacional,
                paginas acessadas, data e hora de acesso, tempo de sessao e acoes realizadas na plataforma.
              </li>
              <li>
                <strong>Dados de comunicacao:</strong> mensagens enviadas atraves de canais integrados (e-mail,
                WhatsApp), incluindo conteudo e metadados.
              </li>
              <li>
                <strong>Dados de pagamento:</strong> processados exclusivamente pela Stripe Inc. Nao armazenamos
                numeros de cartao de credito ou dados financeiros sensveis em nossos servidores.
              </li>
            </ul>
          </section>

          {/* 3. Finalidade do Tratamento */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              3. Finalidade do Tratamento de Dados
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Seus dados pessoais sao tratados para as seguintes finalidades:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Gestao de chamados:</strong> abertura, acompanhamento, resolucao e historico de tickets de
                suporte tecnico e solicitacoes de servico.
              </li>
              <li>
                <strong>Autenticacao e seguranca:</strong> verificacao de identidade, controle de acesso baseado em
                papeis (RBAC), protecao contra fraudes e acessos nao autorizados.
              </li>
              <li>
                <strong>Comunicacao:</strong> envio de notificacoes sobre seus chamados, alertas de SLA, atualizacoes
                de status e comunicacoes operacionais necessarias.
              </li>
              <li>
                <strong>Analise e melhoria:</strong> geracao de relatorios analiticos, metricas de desempenho,
                identificacao de tendencias e melhoria continua da plataforma.
              </li>
              <li>
                <strong>Inteligencia artificial:</strong> classificacao automatica de tickets, sugestoes de respostas,
                analise de sentimento e recomendacoes de artigos da base de conhecimento.
              </li>
              <li>
                <strong>Conformidade legal:</strong> cumprimento de obrigacoes legais e regulatorias, incluindo
                retencao de logs de auditoria e rastreabilidade de acoes.
              </li>
            </ul>
          </section>

          {/* 4. Base Legal */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              4. Base Legal para o Tratamento (Art. 7, LGPD)
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              O tratamento dos seus dados pessoais fundamenta-se nas seguintes bases legais previstas no
              Art. 7 da LGPD:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Execucao de contrato (Art. 7, V):</strong> os dados sao necessarios para a prestacao
                do servico contratado, incluindo gestao de chamados, SLA e funcionalidades da plataforma.
              </li>
              <li>
                <strong>Consentimento (Art. 7, I):</strong> para cookies analiticos, comunicacoes de marketing
                e funcionalidades opcionais como integracao com WhatsApp. O consentimento pode ser revogado
                a qualquer momento.
              </li>
              <li>
                <strong>Legitimo interesse (Art. 7, IX):</strong> para analises de uso da plataforma, melhoria
                de servicos, prevencao de fraudes e garantia da seguranca do sistema.
              </li>
              <li>
                <strong>Cumprimento de obrigacao legal (Art. 7, II):</strong> para manutencao de logs de
                auditoria, registros de acesso conforme Marco Civil da Internet e demais obrigacoes legais.
              </li>
            </ul>
          </section>

          {/* 5. Direitos do Titular */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              5. Direitos do Titular dos Dados (Art. 18, LGPD)
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Em conformidade com o Art. 18 da LGPD, voce possui os seguintes direitos em relacao aos seus
              dados pessoais:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Confirmacao e acesso (Art. 18, I e II):</strong> confirmar a existencia de tratamento
                e obter acesso aos seus dados pessoais.
              </li>
              <li>
                <strong>Correcao (Art. 18, III):</strong> solicitar a correcao de dados incompletos, inexatos
                ou desatualizados.
              </li>
              <li>
                <strong>Anonimizacao, bloqueio ou eliminacao (Art. 18, IV):</strong> solicitar o tratamento
                adequado de dados desnecessarios, excessivos ou em desconformidade.
              </li>
              <li>
                <strong>Portabilidade (Art. 18, V):</strong> solicitar a portabilidade dos seus dados a outro
                fornecedor de servico, em formato estruturado e interoperavel.
              </li>
              <li>
                <strong>Eliminacao (Art. 18, VI):</strong> solicitar a eliminacao dos dados pessoais tratados
                com base no consentimento.
              </li>
              <li>
                <strong>Revogacao do consentimento (Art. 18, IX):</strong> revogar o consentimento a qualquer
                momento, de forma gratuita e facilitada.
              </li>
              <li>
                <strong>Oposicao (Art. 18, paragraph 2):</strong> opor-se ao tratamento realizado com base em
                hipotese de dispensa de consentimento, caso haja descumprimento da LGPD.
              </li>
            </ul>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              Para exercer qualquer desses direitos, entre em contato com nosso Encarregado de Protecao de
              Dados (DPO) atraves do e-mail indicado na secao de Contato abaixo.
            </p>
          </section>

          {/* 6. Retencao de Dados */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              6. Retencao e Armazenamento de Dados
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Seus dados pessoais serao retidos pelo periodo necessario para cumprir as finalidades descritas
              nesta politica, observando os seguintes prazos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Dados de conta e tickets:</strong> mantidos enquanto a conta estiver ativa e por ate
                <strong> 3 (tres) anos</strong> apos o encerramento, para fins de auditoria e conformidade legal.
              </li>
              <li>
                <strong>Logs de acesso:</strong> retidos por no minimo 6 meses, conforme Art. 15 do Marco Civil
                da Internet (Lei n. 12.965/2014).
              </li>
              <li>
                <strong>Dados de pagamento:</strong> os registros de transacoes sao retidos pela Stripe conforme
                suas proprias politicas de retencao.
              </li>
              <li>
                <strong>Dados anonimizados:</strong> dados utilizados para analises estatisticas podem ser retidos
                indefinidamente, desde que nao permitam a identificacao do titular.
              </li>
            </ul>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              Apos o termino do periodo de retencao, os dados serao eliminados de forma segura ou anonimizados,
              conforme as melhores praticas de seguranca da informacao.
            </p>
          </section>

          {/* 7. Cookies */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              7. Uso de Cookies
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Utilizamos cookies e tecnologias similares para o funcionamento da plataforma:
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-neutral-700 dark:text-neutral-300">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 pr-4 font-semibold">Tipo</th>
                    <th className="text-left py-3 pr-4 font-semibold">Finalidade</th>
                    <th className="text-left py-3 font-semibold">Base Legal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 pr-4 font-medium">Essenciais</td>
                    <td className="py-3 pr-4">Autenticacao, sessao, preferencias de tema, token CSRF, contexto do tenant</td>
                    <td className="py-3">Execucao de contrato</td>
                  </tr>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 pr-4 font-medium">Analiticos</td>
                    <td className="py-3 pr-4">Metricas de uso, desempenho da plataforma, Web Vitals</td>
                    <td className="py-3">Consentimento</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              Voce pode gerenciar suas preferencias de cookies a qualquer momento atraves do banner de
              consentimento ou das configuracoes do navegador. A desativacao de cookies essenciais pode
              impactar o funcionamento da plataforma.
            </p>
          </section>

          {/* 8. Compartilhamento */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              8. Compartilhamento de Dados
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              <strong>Nao vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins
              comerciais.</strong> Os dados podem ser compartilhados apenas nas seguintes situacoes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Stripe Inc.:</strong> processamento de pagamentos e cobrancas de assinaturas. A Stripe
                atua como operadora de dados e esta em conformidade com padroes PCI-DSS.
              </li>
              <li>
                <strong>Supabase (hosting de banco de dados):</strong> armazenamento de dados em infraestrutura
                segura com criptografia em repouso e em transito.
              </li>
              <li>
                <strong>Obrigacao legal:</strong> quando exigido por lei, regulamento ou ordem judicial,
                compartilharemos apenas os dados estritamente necessarios.
              </li>
              <li>
                <strong>Dentro da organizacao do titular:</strong> dados de tickets e atividades sao visiveis
                para outros membros da mesma organizacao (tenant), conforme as permissoes de acesso configuradas.
              </li>
            </ul>
          </section>

          {/* 9. Seguranca */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              9. Seguranca dos Dados
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Adotamos medidas tecnicas e organizacionais para proteger seus dados pessoais, incluindo:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>Criptografia AES-256-GCM para dados sensiveis com rotacao de chaves.</li>
              <li>Hashing de senhas com bcrypt (12 rounds) e politicas de complexidade.</li>
              <li>Autenticacao multifator (MFA) com TOTP, SMS, e-mail e backup codes.</li>
              <li>Protecao contra CSRF com Double Submit Cookie e HMAC-SHA256.</li>
              <li>Headers de seguranca (CSP, HSTS, X-Frame-Options, Permissions-Policy).</li>
              <li>Isolamento de dados por organizacao (multi-tenancy com scoping por organization_id).</li>
              <li>Rate limiting por endpoint para prevencao de ataques de forca bruta.</li>
              <li>Logs de auditoria completos para rastreabilidade de acoes.</li>
              <li>Queries parametrizadas para prevencao de SQL injection.</li>
              <li>Sanitizacao de entradas com DOMPurify para prevencao de XSS.</li>
            </ul>
          </section>

          {/* 10. Contato DPO */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              10. Contato do Encarregado (DPO)
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Para exercer seus direitos, esclarecer duvidas ou apresentar reclamacoes relacionadas ao
              tratamento de seus dados pessoais, entre em contato com nosso Encarregado de Protecao de Dados:
            </p>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
              <p className="text-neutral-700 dark:text-neutral-300">
                <strong>E-mail:</strong> dpo@servicedesk.com.br
              </p>
              <p className="text-neutral-700 dark:text-neutral-300 mt-2">
                <strong>Prazo de resposta:</strong> ate 15 dias uteis, conforme Art. 18, paragraph 5 da LGPD.
              </p>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              Caso nao esteja satisfeito com a resposta, voce tem o direito de apresentar reclamacao perante a
              Autoridade Nacional de Protecao de Dados (ANPD) atraves do site{' '}
              <a
                href="https://www.gov.br/anpd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 dark:text-brand-400 hover:underline"
              >
                www.gov.br/anpd
              </a>.
            </p>
          </section>

          {/* Footer links */}
          <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-6">
            <Link href="/terms" className="text-brand-600 dark:text-brand-400 hover:underline text-sm">
              Termos de Uso
            </Link>
            <Link href="/" className="text-brand-600 dark:text-brand-400 hover:underline text-sm">
              Pagina Inicial
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
