/**
 * SAP Brasil Integration
 * Sistema de integração com SAP Business One e SAP S/4HANA Brasil
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

interface SapConfig {
  baseUrl: string;
  companyDB: string;
  username: string;
  password: string;
  version: 'b1' | 's4hana';
  environment: 'development' | 'production';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SapAuthResponse {
  SessionId: string;
  Version: string;
  SessionTimeout: number;
}

interface SapBusinessPartner {
  CardCode: string;
  CardName: string;
  CardType: 'cCustomer' | 'cSupplier' | 'cLead';
  FederalTaxID?: string; // CNPJ
  Phone1?: string;
  Phone2?: string;
  Cellular?: string;
  EmailAddress?: string;
  Website?: string;
  BillToState?: string;
  BillToCountry?: string;
  BillToCity?: string;
  BillToStreet?: string;
  BillToStreetNo?: string;
  BillToZipCode?: string;
  ShipToState?: string;
  ShipToCountry?: string;
  ShipToCity?: string;
  ShipToStreet?: string;
  ShipToStreetNo?: string;
  ShipToZipCode?: string;
  GroupCode?: number;
  PayTermsGrpCode?: number;
  CreditLimit?: number;
  Valid?: 'tYES' | 'tNO';
  Frozen?: 'tYES' | 'tNO';
  Currency?: string;
  CreateDate?: string;
  UpdateDate?: string;
  // Campos específicos Brasil
  TaxId0?: string; // CPF
  TaxId1?: string; // Inscrição Estadual
  TaxId4?: string; // Inscrição Municipal
  Industry?: string;
  DiscountPercent?: number;
  // Endereços múltiplos
  BPAddresses?: Array<{
    AddressName: string;
    Street: string;
    StreetNo?: string;
    Block?: string;
    ZipCode?: string;
    City: string;
    County?: string;
    Country?: string;
    State?: string;
    BuildingFloorRoom?: string;
    AddressType?: 'bo_BillTo' | 'bo_ShipTo';
  }>;
}

interface SapItem {
  ItemCode: string;
  ItemName: string;
  ForeignName?: string;
  ItemGroupCode?: number;
  BarCode?: string;
  VatGourpSa?: string; // Grupo de impostos vendas
  VatGroupPu?: string; // Grupo de impostos compras
  SalesUnit?: string;
  PurchaseUnit?: string;
  InventoryUOM?: string;
  Valid?: 'tYES' | 'tNO';
  Frozen?: 'tYES' | 'tNO';
  ItemType?: 'itItems' | 'itLabor' | 'itTravel';
  // Preços
  ItemPrices?: Array<{
    PriceList: number;
    Price: number;
    Currency?: string;
  }>;
  // Estoque
  ItemWarehouseInfoCollection?: Array<{
    WarehouseCode: string;
    InStock: number;
    Committed: number;
    Ordered: number;
    MinStock?: number;
    MaxStock?: number;
  }>;
  // Impostos Brasil
  NCMCode?: string; // Código NCM
  CESTCode?: string; // Código CEST
  ServiceCode?: string; // Código de serviço municipal
  CreateDate?: string;
  UpdateDate?: string;
}

interface SapDocument {
  DocEntry?: number;
  DocNum?: number;
  DocType?: 'dDocument_Items' | 'dDocument_Service';
  DocDate: string;
  DocDueDate?: string;
  CardCode: string;
  CardName?: string;
  Comments?: string;
  JournalMemo?: string;
  DocCurrency?: string;
  DocRate?: number;
  DocTotal?: number;
  DocTotalFC?: number;
  VatSum?: number;
  VatSumFC?: number;
  DocumentStatus?: 'bost_Open' | 'bost_Close' | 'bost_Paid' | 'bost_Delivered';
  // Linhas do documento
  DocumentLines: Array<{
    LineNum?: number;
    ItemCode?: string;
    ItemDescription?: string;
    Quantity: number;
    Price?: number;
    PriceAfterVAT?: number;
    LineTotal?: number;
    LineTotalFC?: number;
    VatGroup?: string;
    TaxCode?: string;
    WarehouseCode?: string;
    UnitOfMeasure?: string;
    // Impostos específicos Brasil
    Usage?: string;
    TaxLiable?: 'tYES' | 'tNO';
    CFOPCode?: string; // CFOP
    CSTCode?: string; // CST
    U_NCM?: string; // NCM
    U_CEST?: string; // CEST
  }>;
  // Parcelas (para documentos financeiros)
  DocumentInstallments?: Array<{
    DueDate: string;
    Percentage?: number;
    Total?: number;
    TotalFC?: number;
  }>;
  // Informações fiscais Brasil
  BrazilianInvoice?: {
    FiscalDocumentModel?: string;
    FiscalDocumentType?: string;
    NFeNumber?: string;
    NFeStatus?: string;
    NFeXMLPath?: string;
    NFeXML?: string;
  };
}

interface SapServiceCall {
  ServiceCallID?: number;
  Subject: string;
  CustomerCode: string;
  CustomerName?: string;
  ContactCode?: number;
  Status?: 'Open' | 'Closed';
  Priority?: 'Low' | 'Medium' | 'High';
  CallType?: number;
  ProblemType?: number;
  AssigneeCode?: number;
  Description?: string;
  Resolution?: string;
  CreationDate?: string;
  CreationTime?: number;
  UpdateDate?: string;
  UpdateTime?: number;
  CloseDate?: string;
  CloseTime?: number;
  // Atividades relacionadas
  ServiceCallActivities?: Array<{
    LineNum?: number;
    ActivityDate: string;
    ActivityTime?: number;
    StartDate?: string;
    StartTime?: number;
    EndDate?: string;
    EndTime?: number;
    Subject: string;
    Details?: string;
    Activity?: number;
    HandledBy?: number;
    Status?: 'cn_Open' | 'cn_Closed';
  }>;
  // Soluções
  ServiceCallSolutions?: Array<{
    LineNum?: number;
    SolutionID: number;
    Remarks?: string;
  }>;
}

export class SapBrasilClient {
  private api: AxiosInstance;
  private config: SapConfig;
  private sessionId?: string;
  private sessionExpiresAt?: Date;

  constructor(config: SapConfig) {
    this.config = config;

    // Define base URL baseado na versão SAP
    const apiPath = config.version === 'b1' ? 'b1s/v1' : 'sap/bc/rest/sap/api/v1';

    this.api = axios.create({
      baseURL: `${config.baseUrl}/${apiPath}`,
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
    // Request interceptor para adicionar autenticação
    this.api.interceptors.request.use(async (config) => {
      await this.ensureValidSession();

      if (this.sessionId) {
        if (this.config.version === 'b1') {
          config.headers['Cookie'] = `B1SESSION=${this.sessionId}`;
        } else {
          config.headers['Authorization'] = `Bearer ${this.sessionId}`;
        }
      }

      return config;
    });

    // Response interceptor para tratar erros
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Sessão expirou, tenta renovar
          this.sessionId = undefined;
          this.sessionExpiresAt = undefined;

          // Retry a requisição
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.ensureValidSession();

            if (this.sessionId) {
              if (this.config.version === 'b1') {
                originalRequest.headers['Cookie'] = `B1SESSION=${this.sessionId}`;
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${this.sessionId}`;
              }
              return this.api(originalRequest);
            }
          }
        }

        throw error;
      }
    );
  }

  /**
   * Garante que a sessão é válida
   */
  private async ensureValidSession(): Promise<void> {
    if (this.sessionId && this.sessionExpiresAt && new Date() < this.sessionExpiresAt) {
      return;
    }

    await this.authenticate();
  }

  /**
   * Autentica com o SAP
   */
  private async authenticate(): Promise<void> {
    try {
      const authData = {
        CompanyDB: this.config.companyDB,
        UserName: this.config.username,
        Password: this.config.password
      };

      const loginPath = this.config.version === 'b1' ? '/Login' : '/login';
      const response = await axios.post(
        `${this.config.baseUrl}/${this.config.version === 'b1' ? 'b1s/v1' : 'sap/bc/rest/sap/api/v1'}${loginPath}`,
        authData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (this.config.version === 'b1') {
        this.sessionId = response.data.SessionId;
        const sessionTimeout = response.data.SessionTimeout || 30; // minutos
        this.sessionExpiresAt = new Date(Date.now() + (sessionTimeout - 2) * 60 * 1000); // 2min buffer
      } else {
        this.sessionId = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        this.sessionExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s buffer
      }
    } catch (error) {
      logger.error('SAP authentication failed', error);
      throw new Error('Failed to authenticate with SAP');
    }
  }

  /**
   * BUSINESS PARTNER MANAGEMENT
   */

  /**
   * Lista parceiros de negócio
   */
  async getBusinessPartners(params?: {
    filter?: string;
    select?: string;
    top?: number;
    skip?: number;
  }): Promise<{
    value: SapBusinessPartner[];
    '@odata.count'?: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.filter) queryParams.append('$filter', params.filter);
      if (params?.select) queryParams.append('$select', params.select);
      if (params?.top) queryParams.append('$top', params.top.toString());
      if (params?.skip) queryParams.append('$skip', params.skip.toString());
      queryParams.append('$inlinecount', 'allpages');

      const response = await this.api.get(`/BusinessPartners?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching business partners', error);
      throw error;
    }
  }

  /**
   * Obtém parceiro de negócio por código
   */
  async getBusinessPartner(cardCode: string): Promise<SapBusinessPartner> {
    try {
      const response = await this.api.get(`/BusinessPartners('${cardCode}')`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching business partner', error);
      throw error;
    }
  }

  /**
   * Busca parceiro por documento (CPF/CNPJ)
   */
  async getBusinessPartnerByDocument(document: string): Promise<SapBusinessPartner | null> {
    try {
      const cleanDocument = document.replace(/\D/g, '');

      // Busca por CNPJ (FederalTaxID) ou CPF (TaxId0)
      const filter = cleanDocument.length === 14
        ? `FederalTaxID eq '${cleanDocument}'`
        : `TaxId0 eq '${cleanDocument}'`;

      const response = await this.getBusinessPartners({ filter, top: 1 });

      return response.value.length > 0 ? response.value[0] || null : null;
    } catch (error) {
      logger.error('Error fetching business partner by document', error);
      return null;
    }
  }

  /**
   * Cria novo parceiro de negócio
   */
  async createBusinessPartner(partner: Omit<SapBusinessPartner, 'CreateDate' | 'UpdateDate'>): Promise<SapBusinessPartner> {
    try {
      const response = await this.api.post('/BusinessPartners', partner);
      return response.data;
    } catch (error) {
      logger.error('Error creating business partner', error);
      throw error;
    }
  }

  /**
   * Atualiza parceiro de negócio
   */
  async updateBusinessPartner(cardCode: string, partner: Partial<SapBusinessPartner>): Promise<void> {
    try {
      await this.api.patch(`/BusinessPartners('${cardCode}')`, partner);
    } catch (error) {
      logger.error('Error updating business partner', error);
      throw error;
    }
  }

  /**
   * ITEM MANAGEMENT
   */

  /**
   * Lista itens
   */
  async getItems(params?: {
    filter?: string;
    select?: string;
    top?: number;
    skip?: number;
  }): Promise<{
    value: SapItem[];
    '@odata.count'?: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.filter) queryParams.append('$filter', params.filter);
      if (params?.select) queryParams.append('$select', params.select);
      if (params?.top) queryParams.append('$top', params.top.toString());
      if (params?.skip) queryParams.append('$skip', params.skip.toString());
      queryParams.append('$inlinecount', 'allpages');

      const response = await this.api.get(`/Items?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching items', error);
      throw error;
    }
  }

  /**
   * Obtém item por código
   */
  async getItem(itemCode: string): Promise<SapItem> {
    try {
      const response = await this.api.get(`/Items('${itemCode}')`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching item', error);
      throw error;
    }
  }

  /**
   * SERVICE CALL MANAGEMENT
   */

  /**
   * Lista chamados de serviço
   */
  async getServiceCalls(params?: {
    filter?: string;
    select?: string;
    top?: number;
    skip?: number;
  }): Promise<{
    value: SapServiceCall[];
    '@odata.count'?: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.filter) queryParams.append('$filter', params.filter);
      if (params?.select) queryParams.append('$select', params.select);
      if (params?.top) queryParams.append('$top', params.top.toString());
      if (params?.skip) queryParams.append('$skip', params.skip.toString());
      queryParams.append('$inlinecount', 'allpages');

      const response = await this.api.get(`/ServiceCalls?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching service calls', error);
      throw error;
    }
  }

  /**
   * Obtém chamado de serviço por ID
   */
  async getServiceCall(serviceCallID: number): Promise<SapServiceCall> {
    try {
      const response = await this.api.get(`/ServiceCalls(${serviceCallID})`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching service call', error);
      throw error;
    }
  }

  /**
   * Cria novo chamado de serviço
   */
  async createServiceCall(serviceCall: Omit<SapServiceCall, 'ServiceCallID' | 'CreationDate' | 'CreationTime'>): Promise<SapServiceCall> {
    try {
      const response = await this.api.post('/ServiceCalls', serviceCall);
      return response.data;
    } catch (error) {
      logger.error('Error creating service call', error);
      throw error;
    }
  }

  /**
   * Atualiza chamado de serviço
   */
  async updateServiceCall(serviceCallID: number, serviceCall: Partial<SapServiceCall>): Promise<void> {
    try {
      await this.api.patch(`/ServiceCalls(${serviceCallID})`, serviceCall);
    } catch (error) {
      logger.error('Error updating service call', error);
      throw error;
    }
  }

  /**
   * DOCUMENT MANAGEMENT (NFe, Pedidos, etc.)
   */

  /**
   * Lista documentos de vendas
   */
  async getSalesOrders(params?: {
    filter?: string;
    select?: string;
    top?: number;
    skip?: number;
  }): Promise<{
    value: SapDocument[];
    '@odata.count'?: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.filter) queryParams.append('$filter', params.filter);
      if (params?.select) queryParams.append('$select', params.select);
      if (params?.top) queryParams.append('$top', params.top.toString());
      if (params?.skip) queryParams.append('$skip', params.skip.toString());
      queryParams.append('$inlinecount', 'allpages');

      const response = await this.api.get(`/Orders?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching sales orders', error);
      throw error;
    }
  }

  /**
   * Lista faturas de venda
   */
  async getInvoices(params?: {
    filter?: string;
    select?: string;
    top?: number;
    skip?: number;
  }): Promise<{
    value: SapDocument[];
    '@odata.count'?: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.filter) queryParams.append('$filter', params.filter);
      if (params?.select) queryParams.append('$select', params.select);
      if (params?.top) queryParams.append('$top', params.top.toString());
      if (params?.skip) queryParams.append('$skip', params.skip.toString());
      queryParams.append('$inlinecount', 'allpages');

      const response = await this.api.get(`/Invoices?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching invoices', error);
      throw error;
    }
  }

  /**
   * INTEGRATION HELPERS
   */

  /**
   * Sincroniza cliente do ServiceDesk com SAP
   */
  async syncCustomerToSap(customerData: {
    name: string;
    email: string;
    document: string;
    phone?: string;
    address?: any;
  }): Promise<SapBusinessPartner> {
    try {
      // Verifica se cliente já existe
      const existingPartner = await this.getBusinessPartnerByDocument(customerData.document);

      const cleanDocument = customerData.document.replace(/\D/g, '');
      const isCompany = cleanDocument.length === 14;

      const partnerData: Partial<SapBusinessPartner> = {
        CardName: customerData.name,
        CardType: 'cCustomer',
        EmailAddress: customerData.email,
        Phone1: customerData.phone,
        Valid: 'tYES',
        Frozen: 'tNO',
        Currency: 'BRL'
      };

      if (isCompany) {
        partnerData.FederalTaxID = cleanDocument; // CNPJ
      } else {
        partnerData.TaxId0 = cleanDocument; // CPF
      }

      if (customerData.address) {
        partnerData.BillToStreet = customerData.address.street;
        partnerData.BillToStreetNo = customerData.address.number;
        partnerData.BillToCity = customerData.address.city;
        partnerData.BillToState = customerData.address.state;
        partnerData.BillToZipCode = customerData.address.zipCode;
        partnerData.BillToCountry = 'BR';
      }

      if (existingPartner) {
        // Atualiza parceiro existente
        await this.updateBusinessPartner(existingPartner.CardCode, partnerData);
        return await this.getBusinessPartner(existingPartner.CardCode);
      } else {
        // Cria novo parceiro
        partnerData.CardCode = `C${cleanDocument}`;
        return await this.createBusinessPartner(partnerData as SapBusinessPartner);
      }
    } catch (error) {
      logger.error('Error syncing customer to SAP', error);
      throw error;
    }
  }

  /**
   * Cria chamado de serviço a partir de ticket do ServiceDesk
   */
  async createServiceCallFromTicket(ticketData: {
    customerCode: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string;
  }): Promise<SapServiceCall> {
    try {
      const priorityMap = {
        'low': 'Low' as const,
        'medium': 'Medium' as const,
        'high': 'High' as const,
        'critical': 'High' as const
      };

      const serviceCallData: Omit<SapServiceCall, 'ServiceCallID' | 'CreationDate' | 'CreationTime'> = {
        Subject: ticketData.title,
        CustomerCode: ticketData.customerCode,
        Description: ticketData.description,
        Priority: priorityMap[ticketData.priority],
        Status: 'Open',
        CallType: 1, // Suporte técnico
        ProblemType: 1 // Problema geral
      };

      if (ticketData.assignedTo) {
        // Busca código do usuário no SAP
        // serviceCallData.AssigneeCode = await this.getUserCodeByEmail(ticketData.assignedTo);
      }

      return await this.createServiceCall(serviceCallData);
    } catch (error) {
      logger.error('Error creating service call from ticket', error);
      throw error;
    }
  }

  /**
   * Logout da sessão SAP
   */
  async logout(): Promise<void> {
    try {
      if (this.sessionId) {
        const logoutPath = this.config.version === 'b1' ? '/Logout' : '/logout';
        await this.api.post(logoutPath);
        this.sessionId = undefined;
        this.sessionExpiresAt = undefined;
      }
    } catch (error) {
      logger.error('Error during SAP logout', error);
    }
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<SapBrasilClient> {
    const [
      baseUrl,
      companyDB,
      username,
      password,
      version = 'b1',
      environment = 'production'
    ] = await Promise.all([
      getSystemSetting('sap_base_url'),
      getSystemSetting('sap_company_db'),
      getSystemSetting('sap_username'),
      getSystemSetting('sap_password'),
      getSystemSetting('sap_version'),
      getSystemSetting('sap_environment')
    ]);

    if (!baseUrl || !companyDB || !username || !password) {
      throw new Error('SAP configuration incomplete. Please check system settings.');
    }

    return new SapBrasilClient({
      baseUrl,
      companyDB,
      username,
      password,
      version: version as 'b1' | 's4hana',
      environment: environment as 'development' | 'production'
    });
  }
}

export default SapBrasilClient;