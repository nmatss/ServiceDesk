/**
 * Gov.br API Client
 * Cliente para integração com APIs governamentais brasileiras
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

interface ESicProtocol {
  protocolNumber: string;
  subject: string;
  description: string;
  requesterCpf: string;
  requesterName: string;
  requesterEmail: string;
  organ: string;
  category: string;
  status: 'pending' | 'in_progress' | 'responded' | 'closed';
  createdAt: string;
  deadline: string;
  response?: string;
  respondedAt?: string;
}

interface GovApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
}

interface IbgeCity {
  id: number;
  nome: string;
  microrregiao: {
    id: number;
    nome: string;
    mesorregiao: {
      id: number;
      nome: string;
      UF: {
        id: number;
        sigla: string;
        nome: string;
        regiao: {
          id: number;
          sigla: string;
          nome: string;
        };
      };
    };
  };
}

export class GovBrApiClient {
  private cepApi: AxiosInstance;
  private ibgeApi: AxiosInstance;
  private esicApi: AxiosInstance;
  private config: {
    esicApiKey?: string;
    environment: 'sandbox' | 'production';
  };

  constructor(config: { esicApiKey?: string; environment?: 'sandbox' | 'production' } = {}) {
    this.config = {
      environment: 'production',
      ...config
    };

    // API ViaCEP para consulta de CEPs
    this.cepApi = axios.create({
      baseURL: 'https://viacep.com.br/ws',
      timeout: 10000,
      headers: {
        'User-Agent': 'ServiceDesk/1.0'
      }
    });

    // API IBGE para dados geográficos
    this.ibgeApi = axios.create({
      baseURL: 'https://servicodados.ibge.gov.br/api/v1',
      timeout: 15000,
      headers: {
        'User-Agent': 'ServiceDesk/1.0'
      }
    });

    // API e-SIC (Sistema Eletrônico do Serviço de Informação ao Cidadão)
    this.esicApi = axios.create({
      baseURL: config.environment === 'sandbox'
        ? 'https://esic-sandbox.cgu.gov.br/api/v1'
        : 'https://esic.cgu.gov.br/api/v1',
      timeout: 30000,
      headers: {
        'User-Agent': 'ServiceDesk/1.0',
        'Content-Type': 'application/json'
      }
    });

    if (config.esicApiKey) {
      this.esicApi.defaults.headers['Authorization'] = `Bearer ${config.esicApiKey}`;
    }
  }

  /**
   * Consulta CEP via ViaCEP
   */
  async getCepData(cep: string): Promise<GovApiResponse<CepData>> {
    try {
      const cleanCep = cep.replace(/\D/g, '');

      if (cleanCep.length !== 8) {
        return {
          success: false,
          error: 'CEP deve conter 8 dígitos'
        };
      }

      const response = await this.cepApi.get(`/${cleanCep}/json/`);

      if (response.data.erro) {
        return {
          success: false,
          error: 'CEP não encontrado'
        };
      }

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error fetching CEP data', error);
      return {
        success: false,
        error: 'Erro ao consultar CEP'
      };
    }
  }

  /**
   * Lista estados do Brasil via IBGE
   */
  async getStates(): Promise<GovApiResponse<Array<{ id: number; sigla: string; nome: string }>>> {
    try {
      const response = await this.ibgeApi.get('/localidades/estados');

      interface StateData {
        id: number;
        sigla: string;
        nome: string;
      }

      const states = (response.data as StateData[]).map((state: StateData) => ({
        id: state.id,
        sigla: state.sigla,
        nome: state.nome
      })).sort((a: StateData, b: StateData) => a.nome.localeCompare(b.nome));

      return {
        success: true,
        data: states
      };
    } catch (error) {
      logger.error('Error fetching states', error);
      return {
        success: false,
        error: 'Erro ao consultar estados'
      };
    }
  }

  /**
   * Lista cidades por estado via IBGE
   */
  async getCitiesByState(stateId: number): Promise<GovApiResponse<IbgeCity[]>> {
    try {
      const response = await this.ibgeApi.get(`/localidades/estados/${stateId}/municipios`);

      const cities = response.data.sort((a: IbgeCity, b: IbgeCity) =>
        a.nome.localeCompare(b.nome)
      );

      return {
        success: true,
        data: cities
      };
    } catch (error) {
      logger.error('Error fetching cities', error);
      return {
        success: false,
        error: 'Erro ao consultar cidades'
      };
    }
  }

  /**
   * Cria protocolo e-SIC para transparência
   */
  async createESicProtocol(data: {
    subject: string;
    description: string;
    requesterCpf: string;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    category: string;
    organ: string;
    priority?: 'normal' | 'urgent';
  }): Promise<GovApiResponse<ESicProtocol>> {
    try {
      if (!this.config.esicApiKey) {
        return {
          success: false,
          error: 'API Key do e-SIC não configurada'
        };
      }

      const protocolData = {
        assunto: data.subject,
        descricao: data.description,
        requerente: {
          cpf: data.requesterCpf.replace(/\D/g, ''),
          nome: data.requesterName,
          email: data.requesterEmail,
          telefone: data.requesterPhone?.replace(/\D/g, '')
        },
        categoria: data.category,
        orgao: data.organ,
        prioridade: data.priority || 'normal'
      };

      const response = await this.esicApi.post('/protocolos', protocolData);

      const protocol: ESicProtocol = {
        protocolNumber: response.data.numero_protocolo,
        subject: data.subject,
        description: data.description,
        requesterCpf: data.requesterCpf,
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        organ: data.organ,
        category: data.category,
        status: 'pending',
        createdAt: response.data.data_criacao || new Date().toISOString(),
        deadline: response.data.prazo || this.calculateDeadline()
      };

      return {
        success: true,
        data: protocol
      };
    } catch (error) {
      logger.error('Error creating e-SIC protocol', error);
      return {
        success: false,
        error: 'Erro ao criar protocolo e-SIC'
      };
    }
  }

  /**
   * Consulta protocolo e-SIC
   */
  async getESicProtocol(protocolNumber: string): Promise<GovApiResponse<ESicProtocol>> {
    try {
      if (!this.config.esicApiKey) {
        return {
          success: false,
          error: 'API Key do e-SIC não configurada'
        };
      }

      const response = await this.esicApi.get(`/protocolos/${protocolNumber}`);

      const protocol: ESicProtocol = {
        protocolNumber: response.data.numero_protocolo,
        subject: response.data.assunto,
        description: response.data.descricao,
        requesterCpf: response.data.requerente.cpf,
        requesterName: response.data.requerente.nome,
        requesterEmail: response.data.requerente.email,
        organ: response.data.orgao,
        category: response.data.categoria,
        status: this.mapESicStatus(response.data.status),
        createdAt: response.data.data_criacao,
        deadline: response.data.prazo,
        response: response.data.resposta,
        respondedAt: response.data.data_resposta
      };

      return {
        success: true,
        data: protocol
      };
    } catch (error) {
      logger.error('Error fetching e-SIC protocol', error);
      return {
        success: false,
        error: 'Erro ao consultar protocolo e-SIC'
      };
    }
  }

  /**
   * Lista órgãos disponíveis para e-SIC
   */
  async getESicOrgans(): Promise<GovApiResponse<Array<{ code: string; name: string }>>> {
    try {
      const response = await this.esicApi.get('/orgaos');

      interface OrganData {
        codigo: string;
        nome: string;
      }

      const organs = (response.data as OrganData[]).map((organ: OrganData) => ({
        code: organ.codigo,
        name: organ.nome
      }));

      return {
        success: true,
        data: organs
      };
    } catch (error) {
      logger.error('Error fetching e-SIC organs', error);
      return {
        success: false,
        error: 'Erro ao consultar órgãos e-SIC'
      };
    }
  }

  /**
   * Validação avançada de documentos brasileiros
   */
  async validateBrazilianDocument(
    document: string,
    type: 'cpf' | 'cnpj' | 'cep' | 'titulo_eleitor' | 'pis_pasep'
  ): Promise<GovApiResponse<{ valid: boolean; formatted?: string; data?: any }>> {
    try {
      const cleanDocument = document.replace(/\D/g, '');

      switch (type) {
        case 'cpf':
          return this.validateCPF(cleanDocument);

        case 'cnpj':
          return this.validateCNPJ(cleanDocument);

        case 'cep':
          const cepResult = await this.getCepData(cleanDocument);
          return {
            success: true,
            data: {
              valid: cepResult.success,
              formatted: cepResult.success ? this.formatCEP(cleanDocument) : undefined,
              data: cepResult.data
            }
          };

        case 'titulo_eleitor':
          return this.validateTituloEleitor(cleanDocument);

        case 'pis_pasep':
          return this.validatePisPasep(cleanDocument);

        default:
          return {
            success: false,
            error: 'Tipo de documento não suportado'
          };
      }
    } catch (error) {
      logger.error('Error validating document', error);
      return {
        success: false,
        error: 'Erro ao validar documento'
      };
    }
  }

  /**
   * Mapeamento de status do e-SIC
   */
  private mapESicStatus(status: string): ESicProtocol['status'] {
    const statusMap: Record<string, ESicProtocol['status']> = {
      'pendente': 'pending',
      'em_andamento': 'in_progress',
      'respondido': 'responded',
      'fechado': 'closed'
    };

    return statusMap[status.toLowerCase()] || 'pending';
  }

  /**
   * Calcula prazo do e-SIC (20 dias úteis)
   */
  private calculateDeadline(): string {
    const date = new Date();
    let workDays = 0;

    while (workDays < 20) {
      date.setDate(date.getDate() + 1);

      // Pula fins de semana
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workDays++;
      }
    }

    return date.toISOString();
  }

  /**
   * Validações de documentos brasileiros
   */
  private validateCPF(cpf: string): GovApiResponse<{ valid: boolean; formatted?: string }> {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      return { success: true, data: { valid: false } };
    }

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }

    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) {
      return { success: true, data: { valid: false } };
    }

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;

    const valid = remainder === parseInt(cpf.charAt(10));

    return {
      success: true,
      data: {
        valid,
        formatted: valid ? this.formatCPF(cpf) : undefined
      }
    };
  }

  private validateCNPJ(cnpj: string): GovApiResponse<{ valid: boolean; formatted?: string }> {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
      return { success: true, data: { valid: false } };
    }

    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    const digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return { success: true, data: { valid: false } };
    }

    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    const valid = result === parseInt(digits.charAt(1));

    return {
      success: true,
      data: {
        valid,
        formatted: valid ? this.formatCNPJ(cnpj) : undefined
      }
    };
  }

  private validateTituloEleitor(titulo: string): GovApiResponse<{ valid: boolean; formatted?: string }> {
    if (titulo.length !== 12) {
      return { success: true, data: { valid: false } };
    }

    // Algoritmo de validação do título de eleitor
    const sequence = titulo.substring(0, 8);
    const state = titulo.substring(8, 10);
    const digits = titulo.substring(10, 12);

    // Validação básica
    if (parseInt(state) < 1 || parseInt(state) > 23) {
      return { success: true, data: { valid: false } };
    }

    // Cálculo do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(sequence.charAt(i)) * (i + 2);
    }

    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;

    if (firstDigit !== parseInt(digits.charAt(0))) {
      return { success: true, data: { valid: false } };
    }

    // Cálculo do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(sequence.charAt(i)) * (i + 7);
    }
    sum += firstDigit * 9;

    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;

    const valid = secondDigit === parseInt(digits.charAt(1));

    return {
      success: true,
      data: {
        valid,
        formatted: valid ? this.formatTituloEleitor(titulo) : undefined
      }
    };
  }

  private validatePisPasep(pis: string): GovApiResponse<{ valid: boolean; formatted?: string }> {
    if (pis.length !== 11) {
      return { success: true, data: { valid: false } };
    }

    const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 10; i++) {
      sum += parseInt(pis.charAt(i)) * (weights[i] ?? 0);
    }

    const remainder = sum % 11;
    const digit = remainder < 2 ? 0 : 11 - remainder;
    const valid = digit === parseInt(pis.charAt(10));

    return {
      success: true,
      data: {
        valid,
        formatted: valid ? this.formatPisPasep(pis) : undefined
      }
    };
  }

  /**
   * Formatação de documentos
   */
  private formatCPF(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private formatCNPJ(cnpj: string): string {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  private formatCEP(cep: string): string {
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  private formatTituloEleitor(titulo: string): string {
    return titulo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  }

  private formatPisPasep(pis: string): string {
    return pis.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4');
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<GovBrApiClient> {
    const [
      esicApiKey,
      environment
    ] = await Promise.all([
      getSystemSetting('govbr_esic_api_key'),
      getSystemSetting('govbr_environment')
    ]);

    return new GovBrApiClient({
      esicApiKey: esicApiKey || undefined,
      environment: (environment || 'production') as 'sandbox' | 'production'
    });
  }
}

export default GovBrApiClient;