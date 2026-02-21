/**
 * Boleto Integration
 * Sistema de integração para geração e gestão de boletos bancários
 */

import axios, { AxiosInstance } from 'axios';
import { executeQueryOne } from '@/lib/db/adapter';

async function getSystemSetting(key: string): Promise<string | null> {
  const row = await executeQueryOne<{ value: string }>(
    'SELECT value FROM system_settings WHERE key = ? AND organization_id IS NULL LIMIT 1',
    [key]
  );
  return row?.value ?? null;
}
import logger from '@/lib/monitoring/structured-logger';

interface BoletoConfig {
  bankCode: string;
  agencia: string;
  conta: string;
  carteira: string;
  convenio?: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

interface Beneficiario {
  cpfCnpj: string;
  tipo: 'PF' | 'PJ';
  nome: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

interface Pagador {
  cpfCnpj: string;
  tipo: 'PF' | 'PJ';
  nome: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  email?: string;
  telefone?: string;
}

interface BoletoData {
  numeroDocumento: string;
  dataVencimento: string; // YYYY-MM-DD
  valor: number;
  nossoNumero?: string;
  beneficiario: Beneficiario;
  pagador: Pagador;
  instrucoes?: string[];
  descricao?: string;
  multa?: {
    tipo: 'VALOR_FIXO' | 'PERCENTUAL';
    valor: number;
    data?: string; // YYYY-MM-DD
  };
  juros?: {
    tipo: 'VALOR_FIXO' | 'PERCENTUAL_DIA' | 'PERCENTUAL_MES' | 'PERCENTUAL_ANO';
    valor: number;
    data?: string; // YYYY-MM-DD
  };
  desconto?: {
    tipo: 'VALOR_FIXO' | 'PERCENTUAL';
    valor: number;
    dataLimite: string; // YYYY-MM-DD
  };
  aceite: 'S' | 'N';
  especie: 'DM' | 'DS' | 'RC' | 'LC' | 'ND' | 'CS' | 'CT' | 'OUT';
  modalidade?: number;
}

interface BoletoResponse {
  numeroDocumento: string;
  nossoNumero: string;
  codigoBarras: string;
  linhaDigitavel: string;
  dataVencimento: string;
  valor: number;
  situacao: string;
  dataProcessamento: string;
  dataRegistro?: string;
  urlPdf?: string;
  beneficiario: Beneficiario;
  pagador: Pagador;
  qrCode?: {
    texto: string;
    imagem: string;
  };
}

interface BoletoConsulta {
  numeroDocumento: string;
  nossoNumero: string;
  situacao: 'REGISTRADO' | 'BAIXADO' | 'LIQUIDADO' | 'PROTESTADO' | 'VENCIDO';
  dataVencimento: string;
  valor: number;
  valorPago?: number;
  dataPagamento?: string;
  dataCredito?: string;
  valorTarifa?: number;
  ocorrencias?: Array<{
    codigo: string;
    descricao: string;
    data: string;
  }>;
}

interface BoletoRemessa {
  loteServico: number;
  formaLancamento: number;
  tipoInscricao: number;
  numeroInscricao: string;
  convenio: string;
  nomeEmpresa: string;
  nomeFantasia?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  registros: Array<{
    numeroDocumento: string;
    nossoNumero: string;
    dataVencimento: string;
    valor: number;
    pagador: Pagador;
    instrucoes?: string[];
  }>;
}

export class BoletoClient {
  private api: AxiosInstance;
  private config: BoletoConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  // URLs dos principais bancos brasileiros
  private bankEndpoints: Record<string, { sandbox: string; production: string }> = {
    '033': { // Santander
      sandbox: 'https://api-sandbox.santander.com.br/boleto/v1',
      production: 'https://api.santander.com.br/boleto/v1'
    },
    '237': { // Bradesco
      sandbox: 'https://api-sandbox.bradesco.com.br/boleto/v1',
      production: 'https://api.bradesco.com.br/boleto/v1'
    },
    '001': { // Banco do Brasil
      sandbox: 'https://api-sandbox.bb.com.br/boleto/v1',
      production: 'https://api.bb.com.br/boleto/v1'
    },
    '104': { // Caixa
      sandbox: 'https://api-sandbox.caixa.gov.br/boleto/v1',
      production: 'https://api.caixa.gov.br/boleto/v1'
    },
    '341': { // Itaú
      sandbox: 'https://api-sandbox.itau.com.br/boleto/v1',
      production: 'https://api.itau.com.br/boleto/v1'
    },
    '399': { // HSBC
      sandbox: 'https://api-sandbox.hsbc.com.br/boleto/v1',
      production: 'https://api.hsbc.com.br/boleto/v1'
    }
  };

  constructor(config: BoletoConfig) {
    this.config = config;

    const endpoint = this.bankEndpoints[config.bankCode];
    if (!endpoint) {
      throw new Error(`Bank code ${config.bankCode} not supported`);
    }

    const baseURL = endpoint[config.environment];

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ServiceDesk/1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor para adicionar token de acesso
    this.api.interceptors.request.use(async (config) => {
      await this.ensureValidToken();

      if (this.accessToken) {
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      return config;
    });

    // Response interceptor para tratar erros
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expirado, tenta renovar
          this.accessToken = undefined;
          this.tokenExpiresAt = undefined;

          // Retry a requisição
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.ensureValidToken();

            if (this.accessToken) {
              originalRequest.headers['Authorization'] = `Bearer ${this.accessToken}`;
              return this.api(originalRequest);
            }
          }
        }

        throw error;
      }
    );
  }

  /**
   * Garante que o token de acesso é válido
   */
  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return;
    }

    await this.authenticate();
  }

  /**
   * Autentica com o banco e obtém token de acesso
   */
  private async authenticate(): Promise<void> {
    try {
      const authData = {
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'boleto.read boleto.write'
      };

      const response = await axios.post(
        `${this.api.defaults.baseURL}/oauth/token`,
        new URLSearchParams(authData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s buffer
    } catch (error) {
      logger.error('Boleto authentication failed', error);
      throw new Error('Failed to authenticate with Boleto API');
    }
  }

  /**
   * Registra um novo boleto
   */
  async registrarBoleto(data: BoletoData): Promise<BoletoResponse> {
    try {
      // Valida dados obrigatórios
      this.validateBoletoData(data);

      // Gera nosso número se não fornecido
      if (!data.nossoNumero) {
        data.nossoNumero = this.generateNossoNumero();
      }

      const boletoPayload = {
        numeroDocumento: data.numeroDocumento,
        dataVencimento: data.dataVencimento,
        valor: data.valor,
        nossoNumero: data.nossoNumero,
        beneficiario: data.beneficiario,
        pagador: data.pagador,
        instrucoes: data.instrucoes || [],
        descricao: data.descricao || '',
        multa: data.multa,
        juros: data.juros,
        desconto: data.desconto,
        aceite: data.aceite,
        especie: data.especie,
        modalidade: data.modalidade || 1
      };

      const response = await this.api.post('/boletos', boletoPayload);

      return {
        ...response.data,
        urlPdf: response.data.urlPdf || `${this.api.defaults.baseURL}/boletos/${data.nossoNumero}/pdf`
      };
    } catch (error) {
      logger.error('Error registering boleto', error);
      throw error;
    }
  }

  /**
   * Consulta um boleto
   */
  async consultarBoleto(nossoNumero: string): Promise<BoletoConsulta> {
    try {
      const response = await this.api.get(`/boletos/${nossoNumero}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching boleto', error);
      throw error;
    }
  }

  /**
   * Lista boletos
   */
  async listarBoletos(params: {
    dataInicio?: string; // YYYY-MM-DD
    dataFim?: string; // YYYY-MM-DD
    situacao?: string;
    pagina?: number;
    tamanhoPagina?: number;
  }): Promise<{
    boletos: BoletoConsulta[];
    totalPaginas: number;
    totalRegistros: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params.dataInicio) queryParams.append('dataInicio', params.dataInicio);
      if (params.dataFim) queryParams.append('dataFim', params.dataFim);
      if (params.situacao) queryParams.append('situacao', params.situacao);
      if (params.pagina) queryParams.append('pagina', params.pagina.toString());
      if (params.tamanhoPagina) queryParams.append('tamanhoPagina', params.tamanhoPagina.toString());

      const response = await this.api.get(`/boletos?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error listing boletos', error);
      throw error;
    }
  }

  /**
   * Baixa um boleto
   */
  async baixarBoleto(
    nossoNumero: string,
    motivoBaixa: 'ACERTOS' | 'PROTESTADO' | 'DEVOLUCAO' | 'SUBSTITUICAO'
  ): Promise<void> {
    try {
      await this.api.patch(`/boletos/${nossoNumero}/baixar`, {
        motivoBaixa
      });
    } catch (error) {
      logger.error('Error canceling boleto', error);
      throw error;
    }
  }

  /**
   * Altera data de vencimento de um boleto
   */
  async alterarVencimento(
    nossoNumero: string,
    novaDataVencimento: string
  ): Promise<BoletoResponse> {
    try {
      const response = await this.api.patch(`/boletos/${nossoNumero}/vencimento`, {
        dataVencimento: novaDataVencimento
      });

      return response.data;
    } catch (error) {
      logger.error('Error updating boleto due date', error);
      throw error;
    }
  }

  /**
   * Protesta um boleto
   */
  async protestarBoleto(
    nossoNumero: string,
    diasProtesto: number = 3
  ): Promise<void> {
    try {
      await this.api.patch(`/boletos/${nossoNumero}/protestar`, {
        diasProtesto
      });
    } catch (error) {
      logger.error('Error protesting boleto', error);
      throw error;
    }
  }

  /**
   * Sustenta protesto de um boleto
   */
  async sustentarProtesto(nossoNumero: string): Promise<void> {
    try {
      await this.api.patch(`/boletos/${nossoNumero}/sustar-protesto`);
    } catch (error) {
      logger.error('Error withdrawing protest', error);
      throw error;
    }
  }

  /**
   * Gera arquivo de remessa
   */
  async gerarRemessa(data: BoletoRemessa): Promise<{
    nomeArquivo: string;
    conteudoArquivo: string; // Base64
    numeroRemessa: number;
  }> {
    try {
      const response = await this.api.post('/remessa', data);
      return response.data;
    } catch (error) {
      logger.error('Error generating remessa file', error);
      throw error;
    }
  }

  /**
   * Processa arquivo de retorno
   */
  async processarRetorno(
    arquivo: string, // Base64
    nomeArquivo: string
  ): Promise<{
    numeroRetorno: number;
    dataProcessamento: string;
    registros: Array<{
      nossoNumero: string;
      numeroDocumento: string;
      ocorrencia: string;
      descricaoOcorrencia: string;
      valorPago?: number;
      dataPagamento?: string;
      dataCredito?: string;
    }>;
  }> {
    try {
      const response = await this.api.post('/retorno', {
        arquivo,
        nomeArquivo
      });

      return response.data;
    } catch (error) {
      logger.error('Error processing return file', error);
      throw error;
    }
  }

  /**
   * Gera PDF do boleto
   */
  async gerarPdf(nossoNumero: string): Promise<Buffer> {
    try {
      const response = await this.api.get(`/boletos/${nossoNumero}/pdf`, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Error generating boleto PDF', error);
      throw error;
    }
  }

  /**
   * Gera QR Code PIX para boleto
   */
  async gerarQRCodePix(nossoNumero: string): Promise<{
    qrCode: string;
    txid: string;
    emv: string;
  }> {
    try {
      const response = await this.api.get(`/boletos/${nossoNumero}/pix`);
      return response.data;
    } catch (error) {
      logger.error('Error generating PIX QR code for boleto', error);
      throw error;
    }
  }

  /**
   * Validações auxiliares
   */
  private validateBoletoData(data: BoletoData): void {
    if (!data.numeroDocumento) {
      throw new Error('Número do documento é obrigatório');
    }

    if (!data.dataVencimento) {
      throw new Error('Data de vencimento é obrigatória');
    }

    if (!data.valor || data.valor <= 0) {
      throw new Error('Valor deve ser maior que zero');
    }

    if (!data.beneficiario?.cpfCnpj) {
      throw new Error('CPF/CNPJ do beneficiário é obrigatório');
    }

    if (!data.pagador?.cpfCnpj) {
      throw new Error('CPF/CNPJ do pagador é obrigatório');
    }

    // Valida data de vencimento (deve ser no futuro)
    const vencimento = new Date(data.dataVencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (vencimento < hoje) {
      throw new Error('Data de vencimento deve ser no futuro');
    }

    // Valida valor (máximo de 2 casas decimais)
    if (!Number.isInteger(data.valor * 100)) {
      throw new Error('Valor deve ter no máximo 2 casas decimais');
    }
  }

  /**
   * Gera nosso número automático
   */
  private generateNossoNumero(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${random}`.substring(0, 17);
  }

  /**
   * Calcula dígito verificador do nosso número (varia por banco)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateDigitoVerificador(nossoNumero: string): string {
    // Implementação genérica - cada banco tem seu próprio algoritmo
    let sum = 0;
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];

    for (let i = 0; i < nossoNumero.length; i++) {
      const digit = parseInt(nossoNumero.charAt(i));
      const weight = weights[i % weights.length] ?? 2;
      sum += digit * weight;
    }

    const remainder = sum % 11;
    return remainder < 2 ? '0' : (11 - remainder).toString();
  }

  /**
   * Formata linha digitável
   */
  formatarLinhaDigitavel(linhaDigitavel: string): string {
    return linhaDigitavel.replace(
      /(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/,
      '$1.$2 $3.$4 $5.$6 $7 $8'
    );
  }

  /**
   * Formata código de barras
   */
  formatarCodigoBarras(codigoBarras: string): string {
    return codigoBarras.replace(/(\d{4})(\d{5})(\d{10})(\d{10})(\d{15})/, '$1 $2 $3 $4 $5');
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<BoletoClient> {
    const [
      bankCode,
      agencia,
      conta,
      carteira,
      convenio,
      clientId,
      clientSecret,
      environment = 'sandbox'
    ] = await Promise.all([
      getSystemSetting('boleto_bank_code'),
      getSystemSetting('boleto_agencia'),
      getSystemSetting('boleto_conta'),
      getSystemSetting('boleto_carteira'),
      getSystemSetting('boleto_convenio'),
      getSystemSetting('boleto_client_id'),
      getSystemSetting('boleto_client_secret'),
      getSystemSetting('boleto_environment')
    ]);

    if (!bankCode || !agencia || !conta || !carteira || !clientId || !clientSecret) {
      throw new Error('Boleto configuration incomplete. Please check system settings.');
    }

    return new BoletoClient({
      bankCode,
      agencia,
      conta,
      carteira,
      convenio: convenio || undefined,
      clientId,
      clientSecret,
      environment: environment as 'sandbox' | 'production'
    });
  }
}

export default BoletoClient;