/**
 * TOTVS ERP Integration
 * Sistema de integração com ERP TOTVS (Protheus/RM/Datasul)
 */

import axios, { AxiosInstance } from 'axios';
import { getSystemSetting } from '@/lib/db/queries';
import logger from '@/lib/monitoring/structured-logger';

interface TotvsConfig {
  baseUrl: string;
  username: string;
  password: string;
  tenant: string;
  environment: 'development' | 'production';
  apiVersion: string;
  product: 'protheus' | 'rm' | 'datasul';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TotvsAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TotvsCustomer {
  id: string;
  code: string;
  name: string;
  tradeName?: string;
  documentType: 'CPF' | 'CNPJ';
  document: string;
  email?: string;
  phone?: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  isActive: boolean;
  customerGroup?: string;
  creditLimit?: number;
  paymentTerms?: string;
  createdAt: string;
  updatedAt: string;
}

interface TotvsProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unitOfMeasure: string;
  price: number;
  costPrice?: number;
  isActive: boolean;
  stock?: {
    quantity: number;
    reserved: number;
    available: number;
    warehouse: string;
  };
  specifications?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface TotvsOrder {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: 'PENDING' | 'CONFIRMED' | 'INVOICED' | 'DELIVERED' | 'CANCELLED';
  orderDate: string;
  deliveryDate?: string;
  totalValue: number;
  items: Array<{
    sequence: number;
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unitOfMeasure: string;
  }>;
  billing?: {
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceValue?: number;
  };
  delivery?: {
    address: {
      street: string;
      number: string;
      complement?: string;
      district: string;
      city: string;
      state: string;
      zipCode: string;
    };
    carrier?: string;
    trackingCode?: string;
  };
  payment?: {
    method: string;
    terms: string;
    dueDate: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TotvsInvoice {
  id: string;
  number: string;
  series: string;
  customerId: string;
  customerName: string;
  customerDocument: string;
  issueDate: string;
  dueDate?: string;
  totalValue: number;
  status: 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED';
  items: Array<{
    sequence: number;
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxes: {
      icms?: number;
      ipi?: number;
      pis?: number;
      cofins?: number;
    };
  }>;
  taxes: {
    icms: number;
    ipi: number;
    pis: number;
    cofins: number;
    total: number;
  };
  xmlUrl?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface TotvsServiceRequest {
  id?: string;
  number?: string;
  customerId: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  requestedDate: string;
  requiredDate?: string;
  assignedTo?: string;
  resolution?: string;
  resolutionDate?: string;
  serviceItems?: Array<{
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export class TotvsClient {
  private api: AxiosInstance;
  private config: TotvsConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: TotvsConfig) {
    this.config = config;

    this.api = axios.create({
      baseURL: `${config.baseUrl}/rest/${config.apiVersion}`,
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
      await this.ensureValidToken();

      if (this.accessToken) {
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      // Adiciona tenant para produtos multi-tenant
      if (this.config.tenant) {
        config.headers['Tenant'] = this.config.tenant;
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
   * Autentica com o TOTVS
   */
  private async authenticate(): Promise<void> {
    try {
      const authData = {
        username: this.config.username,
        password: this.config.password
      };

      const response = await axios.post(
        `${this.config.baseUrl}/rest/auth/login`,
        authData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Tenant': this.config.tenant
          }
        }
      );

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s buffer
    } catch (error) {
      logger.error('TOTVS authentication failed', error);
      throw new Error('Failed to authenticate with TOTVS API');
    }
  }

  /**
   * CUSTOMER MANAGEMENT
   */

  /**
   * Lista clientes
   */
  async getCustomers(params?: {
    page?: number;
    pageSize?: number;
    filter?: string;
    orderBy?: string;
  }): Promise<{
    items: TotvsCustomer[];
    hasNext: boolean;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params?.filter) queryParams.append('filter', params.filter);
      if (params?.orderBy) queryParams.append('orderBy', params.orderBy);

      const response = await this.api.get(`/customers?${queryParams.toString()}`);

      return {
        items: response.data.items || response.data,
        hasNext: response.data.hasNext || false,
        total: response.data.total || response.data.length
      };
    } catch (error) {
      logger.error('Error fetching customers', error);
      throw error;
    }
  }

  /**
   * Obtém cliente por ID
   */
  async getCustomer(id: string): Promise<TotvsCustomer> {
    try {
      const response = await this.api.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching customer', error);
      throw error;
    }
  }

  /**
   * Busca cliente por documento (CPF/CNPJ)
   */
  async getCustomerByDocument(document: string): Promise<TotvsCustomer | null> {
    try {
      const cleanDocument = document.replace(/\D/g, '');
      const response = await this.api.get(`/customers?filter=document eq '${cleanDocument}'`);

      const customers = response.data.items || response.data;
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      logger.error('Error fetching customer by document', error);
      return null;
    }
  }

  /**
   * Cria novo cliente
   */
  async createCustomer(customer: Omit<TotvsCustomer, 'id' | 'createdAt' | 'updatedAt'>): Promise<TotvsCustomer> {
    try {
      const response = await this.api.post('/customers', customer);
      return response.data;
    } catch (error) {
      logger.error('Error creating customer', error);
      throw error;
    }
  }

  /**
   * Atualiza cliente
   */
  async updateCustomer(id: string, customer: Partial<TotvsCustomer>): Promise<TotvsCustomer> {
    try {
      const response = await this.api.put(`/customers/${id}`, customer);
      return response.data;
    } catch (error) {
      logger.error('Error updating customer', error);
      throw error;
    }
  }

  /**
   * PRODUCT MANAGEMENT
   */

  /**
   * Lista produtos
   */
  async getProducts(params?: {
    page?: number;
    pageSize?: number;
    filter?: string;
    category?: string;
  }): Promise<{
    items: TotvsProduct[];
    hasNext: boolean;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params?.filter) queryParams.append('filter', params.filter);
      if (params?.category) queryParams.append('category', params.category);

      const response = await this.api.get(`/products?${queryParams.toString()}`);

      return {
        items: response.data.items || response.data,
        hasNext: response.data.hasNext || false,
        total: response.data.total || response.data.length
      };
    } catch (error) {
      logger.error('Error fetching products', error);
      throw error;
    }
  }

  /**
   * Obtém produto por código
   */
  async getProductByCode(code: string): Promise<TotvsProduct | null> {
    try {
      const response = await this.api.get(`/products?filter=code eq '${code}'`);

      const products = response.data.items || response.data;
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      logger.error('Error fetching product by code', error);
      return null;
    }
  }

  /**
   * ORDER MANAGEMENT
   */

  /**
   * Lista pedidos
   */
  async getOrders(params?: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    items: TotvsOrder[];
    hasNext: boolean;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params?.customerId) queryParams.append('customerId', params.customerId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
      if (params?.dateTo) queryParams.append('dateTo', params.dateTo);

      const response = await this.api.get(`/orders?${queryParams.toString()}`);

      return {
        items: response.data.items || response.data,
        hasNext: response.data.hasNext || false,
        total: response.data.total || response.data.length
      };
    } catch (error) {
      logger.error('Error fetching orders', error);
      throw error;
    }
  }

  /**
   * Obtém pedido por ID
   */
  async getOrder(id: string): Promise<TotvsOrder> {
    try {
      const response = await this.api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching order', error);
      throw error;
    }
  }

  /**
   * Cria novo pedido
   */
  async createOrder(order: Omit<TotvsOrder, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<TotvsOrder> {
    try {
      const response = await this.api.post('/orders', order);
      return response.data;
    } catch (error) {
      logger.error('Error creating order', error);
      throw error;
    }
  }

  /**
   * INVOICE MANAGEMENT
   */

  /**
   * Lista notas fiscais
   */
  async getInvoices(params?: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    items: TotvsInvoice[];
    hasNext: boolean;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params?.customerId) queryParams.append('customerId', params.customerId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
      if (params?.dateTo) queryParams.append('dateTo', params.dateTo);

      const response = await this.api.get(`/invoices?${queryParams.toString()}`);

      return {
        items: response.data.items || response.data,
        hasNext: response.data.hasNext || false,
        total: response.data.total || response.data.length
      };
    } catch (error) {
      logger.error('Error fetching invoices', error);
      throw error;
    }
  }

  /**
   * Obtém nota fiscal por número
   */
  async getInvoiceByNumber(number: string, series?: string): Promise<TotvsInvoice | null> {
    try {
      let filter = `number eq '${number}'`;
      if (series) {
        filter += ` and series eq '${series}'`;
      }

      const response = await this.api.get(`/invoices?filter=${filter}`);

      const invoices = response.data.items || response.data;
      return invoices.length > 0 ? invoices[0] : null;
    } catch (error) {
      logger.error('Error fetching invoice by number', error);
      return null;
    }
  }

  /**
   * SERVICE REQUEST MANAGEMENT
   */

  /**
   * Lista solicitações de serviço
   */
  async getServiceRequests(params?: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
  }): Promise<{
    items: TotvsServiceRequest[];
    hasNext: boolean;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params?.customerId) queryParams.append('customerId', params.customerId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.priority) queryParams.append('priority', params.priority);
      if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo);

      const response = await this.api.get(`/service-requests?${queryParams.toString()}`);

      return {
        items: response.data.items || response.data,
        hasNext: response.data.hasNext || false,
        total: response.data.total || response.data.length
      };
    } catch (error) {
      logger.error('Error fetching service requests', error);
      throw error;
    }
  }

  /**
   * Cria nova solicitação de serviço
   */
  async createServiceRequest(request: Omit<TotvsServiceRequest, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<TotvsServiceRequest> {
    try {
      const response = await this.api.post('/service-requests', request);
      return response.data;
    } catch (error) {
      logger.error('Error creating service request', error);
      throw error;
    }
  }

  /**
   * Atualiza solicitação de serviço
   */
  async updateServiceRequest(id: string, request: Partial<TotvsServiceRequest>): Promise<TotvsServiceRequest> {
    try {
      const response = await this.api.put(`/service-requests/${id}`, request);
      return response.data;
    } catch (error) {
      logger.error('Error updating service request', error);
      throw error;
    }
  }

  /**
   * INTEGRATION HELPERS
   */

  /**
   * Sincroniza cliente do ServiceDesk com TOTVS
   */
  async syncCustomerToTotvs(customerData: {
    name: string;
    email: string;
    document: string;
    phone?: string;
    address?: any;
  }): Promise<TotvsCustomer> {
    try {
      // Verifica se cliente já existe
      const existingCustomer = await this.getCustomerByDocument(customerData.document);

      if (existingCustomer) {
        // Atualiza cliente existente
        return await this.updateCustomer(existingCustomer.id, {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          address: customerData.address
        });
      } else {
        // Cria novo cliente
        const documentType = customerData.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';

        return await this.createCustomer({
          code: customerData.document.replace(/\D/g, ''),
          name: customerData.name,
          documentType,
          document: customerData.document.replace(/\D/g, ''),
          email: customerData.email,
          phone: customerData.phone,
          address: customerData.address || {
            street: '',
            number: '',
            district: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'Brasil'
          },
          isActive: true
        });
      }
    } catch (error) {
      logger.error('Error syncing customer to TOTVS', error);
      throw error;
    }
  }

  /**
   * Cria solicitação de serviço a partir de ticket do ServiceDesk
   */
  async createServiceRequestFromTicket(ticketData: {
    customerId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: string;
  }): Promise<TotvsServiceRequest> {
    try {
      const priorityMap = {
        'low': 'LOW' as const,
        'medium': 'MEDIUM' as const,
        'high': 'HIGH' as const,
        'critical': 'CRITICAL' as const
      };

      return await this.createServiceRequest({
        customerId: ticketData.customerId,
        description: `${ticketData.title}\n\n${ticketData.description}`,
        category: ticketData.category,
        priority: priorityMap[ticketData.priority],
        status: 'OPEN',
        requestedDate: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating service request from ticket', error);
      throw error;
    }
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<TotvsClient> {
    const [
      baseUrl,
      username,
      password,
      tenant,
      environment,
      apiVersion,
      product
    ] = await Promise.all([
      getSystemSetting('totvs_base_url'),
      getSystemSetting('totvs_username'),
      getSystemSetting('totvs_password'),
      getSystemSetting('totvs_tenant'),
      getSystemSetting('totvs_environment'),
      getSystemSetting('totvs_api_version'),
      getSystemSetting('totvs_product')
    ]);

    if (!baseUrl || !username || !password || !tenant) {
      throw new Error('TOTVS configuration incomplete. Please check system settings.');
    }

    return new TotvsClient({
      baseUrl,
      username,
      password,
      tenant,
      environment: (environment || 'production') as 'development' | 'production',
      apiVersion: apiVersion || 'v1',
      product: (product || 'protheus') as 'protheus' | 'rm' | 'datasul'
    });
  }
}

export default TotvsClient;