import { supabase } from '@/integrations/supabase/client';

export interface RegionalData {
  suppliers?: any[];
  companies?: any[];
  services?: any[];
}

export const SUPPORTED_REGIONS = [
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' }
];

export class DirectoryService {
  static async generateRegionalData(region: string, type: 'suppliers' | 'companies' | 'services', count: number = 10) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-directory-data', {
        body: { region, type, count }
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate directory data');
      }

      return data.data;
    } catch (error) {
      console.error('Error generating regional data:', error);
      throw error;
    }
  }

  static async populateSuppliers(region: string, count: number = 20) {
    try {
      const generatedData = await this.generateRegionalData(region, 'suppliers', count);
      
      // Transform AI data to match our suppliers table structure
      const suppliersData = generatedData.map((supplier: any) => ({
        name: supplier.name,
        contact_person: supplier.contact_person || supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        website: supplier.website,
        payment_terms: supplier.payment_terms || supplier.paymentTerms || 'Net 30',
        user_id: '00000000-0000-0000-0000-000000000000', // System generated
        is_active: true
      }));

      const { data, error } = await supabase
        .from('suppliers')
        .insert(suppliersData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error populating suppliers:', error);
      throw error;
    }
  }

  static async populateCompanies(region: string, count: number = 20) {
    try {
      const generatedData = await this.generateRegionalData(region, 'companies', count);
      
      // Transform AI data to match our companies table structure
      const companiesData = generatedData.map((company: any) => ({
        name: company.name,
        description: company.description,
        industry: company.industry,
        size: company.size,
        location: company.location,
        website: company.website,
        founded_year: company.founded_year || company.foundedYear,
        created_by: '00000000-0000-0000-0000-000000000000' // System generated
      }));

      const { data, error } = await supabase
        .from('companies')
        .insert(companiesData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error populating companies:', error);
      throw error;
    }
  }

  static async populateServices(region: string, count: number = 20) {
    try {
      const generatedData = await this.generateRegionalData(region, 'services', count);
      
      // Transform AI data to match our advertisements table structure (services)
      const servicesData = generatedData.map((service: any) => ({
        title: service.title,
        description: service.description,
        category: service.category,
        subcategory: service.subcategory,
        price: service.price,
        currency: service.currency || 'USD',
        contact_email: service.contact_email || service.contactEmail,
        contact_phone: service.contact_phone || service.contactPhone,
        website_url: service.website_url || service.websiteUrl,
        user_id: '00000000-0000-0000-0000-000000000000', // System generated
        is_service: true,
        is_active: true
      }));

      const { data, error } = await supabase
        .from('advertisements')
        .insert(servicesData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error populating services:', error);
      throw error;
    }
  }

  static async populateAllForRegion(region: string) {
    try {
      const [suppliers, companies, services] = await Promise.all([
        this.populateSuppliers(region, 15),
        this.populateCompanies(region, 15),
        this.populateServices(region, 15)
      ]);

      return {
        suppliers: suppliers?.length || 0,
        companies: companies?.length || 0,
        services: services?.length || 0
      };
    } catch (error) {
      console.error('Error populating all data for region:', error);
      throw error;
    }
  }
}