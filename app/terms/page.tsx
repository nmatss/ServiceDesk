import Link from 'next/link';

export const metadata = {
  title: 'Termos de Uso | Insighta',
  description: 'Termos de Uso e condicoes de servico da plataforma Insighta',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12">
          <Link href="/" className="text-brand-600 dark:text-brand-400 hover:underline text-sm mb-4 inline-block">
            &larr; Voltar ao inicio
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Termos de Uso
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Ultima atualizacao: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </header>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {/* 1. Aceitacao dos Termos */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              1. Aceitacao dos Termos
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Ao criar uma conta, acessar ou utilizar a plataforma <strong>Insighta</strong> (&quot;Plataforma&quot;,
              &quot;Servico&quot; ou &quot;nos&quot;), voce declara que leu, compreendeu e concorda integralmente com estes Termos de
              Uso (&quot;Termos&quot;). Caso nao concorde com qualquer disposicao, voce nao devera utilizar o Servico.
              Estes Termos constituem um contrato vinculativo entre voce (&quot;Usuario&quot;, &quot;voce&quot;) e a Insighta
              Tecnologia Ltda., com sede em Sao Paulo/SP.
            </p>
          </section>

          {/* 2. Descricao do Servico */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              2. Descricao do Servico
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              O Insighta e uma plataforma SaaS (Software as a Service) de gestao de servicos de TI
              que oferece:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>Gestao de chamados (tickets) com workflows configuravveis e automacao.</li>
              <li>Base de conhecimento com busca semantica e sugestoes por IA.</li>
              <li>Gestao de problemas, mudancas e configuracao (processos ITIL).</li>
              <li>Catalogo de servicos com aprovacoes e SLA.</li>
              <li>Painel analitico com metricas em tempo real e relatorios.</li>
              <li>Portal de autoatendimento para usuarios finais.</li>
              <li>Integracoes com e-mail, WhatsApp e sistemas externos.</li>
              <li>Funcionalidades de inteligencia artificial (classificacao, copiloto, analise de sentimento).</li>
            </ul>
          </section>

          {/* 3. Planos e Pagamento */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              3. Planos, Precos e Pagamento
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              O Servico e oferecido em diferentes planos de assinatura:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Starter (Gratuito):</strong> ate 3 usuarios, 100 tickets/mes, funcionalidades basicas.
              </li>
              <li>
                <strong>Professional (R$ 109/mes):</strong> ate 15 usuarios, 1.000 tickets/mes, IA, ESM,
                SLA avancado e integracoes.
              </li>
              <li>
                <strong>Enterprise (R$ 179/mes):</strong> usuarios e tickets ilimitados, SSO/SAML, audit
                log avancado, SLA customizado e suporte dedicado.
              </li>
            </ul>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              <strong>Pagamento:</strong> os pagamentos sao processados exclusivamente pela <strong>Stripe Inc.</strong>,
              plataforma certificada PCI-DSS Level 1. Aceitamos cartoes de credito e debito das principais bandeiras.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-2">
              <strong>Renovacao automatica:</strong> as assinaturas sao renovadas automaticamente ao final de cada
              ciclo de cobranca (mensal). Voce sera notificado por e-mail antes da renovacao.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-2">
              <strong>Cancelamento:</strong> voce pode cancelar sua assinatura a qualquer momento atraves do
              painel administrativo. O cancelamento sera efetivado ao final do periodo ja pago, sem cobrancas
              adicionais. Nao ha reembolso proporcional por periodos nao utilizados.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-2">
              <strong>Alteracao de precos:</strong> reservamo-nos o direito de alterar os precos dos planos com
              aviso previo de 30 dias. Alteracoes nao afetam o ciclo de cobranca em andamento.
            </p>
          </section>

          {/* 4. Responsabilidades do Usuario */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              4. Responsabilidades do Usuario
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Ao utilizar o Servico, voce se compromete a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>Fornecer informacoes veridicas, completas e atualizadas no cadastro.</li>
              <li>Manter a confidencialidade de suas credenciais de acesso (login e senha).</li>
              <li>Notificar imediatamente sobre qualquer uso nao autorizado de sua conta.</li>
              <li>Nao utilizar a plataforma para fins ilegais, fraudulentos ou que violem direitos de terceiros.</li>
              <li>Nao tentar acessar dados de outras organizacoes (tenants) ou contornar mecanismos de seguranca.</li>
              <li>Nao realizar engenharia reversa, descompilar ou tentar extrair o codigo-fonte da plataforma.</li>
              <li>Nao enviar conteudo malicioso, incluindo malware, scripts ou anexos prejudiciais.</li>
              <li>Respeitar os limites do plano contratado (numero de usuarios e tickets).</li>
              <li>Cumprir todas as leis e regulamentos aplicaveis, incluindo a LGPD.</li>
            </ul>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              O descumprimento destas obrigacoes podera resultar na suspensao ou cancelamento da conta,
              sem prejuizo de outras medidas cabiveis.
            </p>
          </section>

          {/* 5. Propriedade Intelectual */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              5. Propriedade Intelectual
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Todo o conteudo da plataforma, incluindo codigo-fonte, design, logotipos, textos, graficos,
              interfaces, algoritmos de IA, workflows e documentacao, e de propriedade exclusiva da
              Insighta ou de seus licenciadores, protegido pelas leis de propriedade intelectual
              brasileiras e tratados internacionais.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              O Usuario retem a propriedade intelectual sobre todos os dados, conteudo e informacoes
              inseridos na plataforma. Ao utilizar o Servico, voce nos concede uma licenca limitada,
              nao exclusiva e revogavel para processar, armazenar e exibir seus dados exclusivamente
              para a prestacao do Servico.
            </p>
          </section>

          {/* 6. Limitacao de Responsabilidade */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              6. Limitacao de Responsabilidade
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Na maxima extensao permitida pela legislacao aplicavel:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                O Servico e fornecido &quot;como esta&quot; (&quot;as is&quot;), sem garantias de qualquer tipo, expressas ou
                implicitas, alem daquelas previstas em lei.
              </li>
              <li>
                Nao garantimos que o Servico sera ininterrupto, livre de erros ou totalmente seguro,
                embora empreguemos os melhores esforcos para tal.
              </li>
              <li>
                Nossa responsabilidade total perante o Usuario, por qualquer causa, estara limitada ao
                valor efetivamente pago pelo Usuario nos 12 meses anteriores ao evento que deu origem
                a reclamacao.
              </li>
              <li>
                Nao seremos responsaveis por danos indiretos, incidentais, consequenciais, punitivos
                ou por lucros cessantes.
              </li>
              <li>
                Nao nos responsabilizamos por indisponibilidades decorrentes de forca maior, falhas de
                terceiros (provedores de infraestrutura, internet) ou manutencoes programadas com aviso previo.
              </li>
            </ul>
          </section>

          {/* 7. SLA */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              7. Acordo de Nivel de Servico (SLA)
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Nos comprometemos com os seguintes niveis de servico para os planos pagos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Disponibilidade:</strong> 99,5% de uptime mensal, excluindo manutencoes programadas
                e eventos de forca maior.
              </li>
              <li>
                <strong>Tempo de resposta (suporte):</strong> Professional — ate 4 horas uteis; Enterprise — ate
                1 hora util com suporte dedicado.
              </li>
              <li>
                <strong>Manutencoes programadas:</strong> realizadas preferencialmente fora do horario comercial
                (22h-6h, horario de Brasilia), com aviso previo de 48 horas.
              </li>
              <li>
                <strong>Incidentes criticos:</strong> comunicacao em ate 30 minutos apos deteccao, com
                atualizacoes a cada hora ate a resolucao.
              </li>
            </ul>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              Caso a disponibilidade mensal fique abaixo de 99,5%, o Usuario do plano Enterprise tera direito
              a credito proporcional ao periodo de indisponibilidade, limitado a 30% do valor mensal da assinatura.
            </p>
          </section>

          {/* 8. Conformidade LGPD */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              8. Protecao de Dados e LGPD
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Estamos comprometidos com a protecao dos seus dados pessoais em conformidade com a Lei Geral
              de Protecao de Dados (Lei n. 13.709/2018). Para informacoes detalhadas sobre como coletamos,
              utilizamos e protegemos seus dados, consulte nossa{' '}
              <Link href="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">
                Politica de Privacidade
              </Link>.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Quando o Usuario atua como controlador de dados pessoais inseridos na plataforma (ex: dados
              de clientes do Usuario), a Insighta atua como operadora de dados, tratando-os
              exclusivamente conforme as instrucoes do controlador e em conformidade com a LGPD.
            </p>
          </section>

          {/* 9. Alteracoes nos Termos */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              9. Alteracoes nos Termos
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Reservamo-nos o direito de modificar estes Termos a qualquer momento. Em caso de alteracoes
              substanciais:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>Notificaremos os usuarios por e-mail e/ou notificacao na plataforma com antecedencia minima de 30 dias.</li>
              <li>A data de &quot;ultima atualizacao&quot; sera atualizada no topo desta pagina.</li>
              <li>O uso continuado do Servico apos o periodo de aviso constitui aceitacao das alteracoes.</li>
              <li>Caso nao concorde com as alteracoes, voce podera cancelar sua conta antes da entrada em vigor dos novos Termos.</li>
            </ul>
          </section>

          {/* 10. Foro e Disposicoes Gerais */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              10. Foro e Disposicoes Gerais
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Estes Termos sao regidos pelas leis da Republica Federativa do Brasil. Fica eleito o foro da
              Comarca de <strong>Sao Paulo/SP</strong> para dirimir quaisquer controversias decorrentes destes
              Termos, com renuncia expressa a qualquer outro, por mais privilegiado que seja.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              A eventual nulidade ou invalidade de qualquer disposicao destes Termos nao afetara a validade
              das demais disposicoes, que permanecerao em pleno vigor e efeito.
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              A tolerancia quanto ao descumprimento de qualquer disposicao destes Termos nao constituira
              renuncia ao direito de exigir o cumprimento da obrigacao, podendo a parte prejudicada exercer
              seus direitos a qualquer tempo.
            </p>
          </section>

          {/* Footer links */}
          <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-6">
            <Link href="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline text-sm">
              Politica de Privacidade
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
