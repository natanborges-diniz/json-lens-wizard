-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'seller');

-- Create enum for service status
CREATE TYPE public.service_status AS ENUM ('in_progress', 'budget_sent', 'converted', 'lost');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'seller',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_settings table for institutional info
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Ótica',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  cnpj TEXT,
  instagram TEXT,
  facebook TEXT,
  whatsapp TEXT,
  slogan TEXT,
  footer_text TEXT,
  budget_terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  birth_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services (atendimentos) table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  status service_status NOT NULL DEFAULT 'in_progress',
  -- Anamnesis data
  anamnesis_data JSONB,
  -- Prescription data
  prescription_data JSONB,
  -- Frame data
  frame_data JSONB,
  -- Category
  lens_category TEXT,
  -- Notes
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  -- Selected lens configuration
  family_id TEXT NOT NULL,
  family_name TEXT NOT NULL,
  supplier TEXT NOT NULL,
  selected_index TEXT NOT NULL,
  selected_treatments TEXT[] DEFAULT '{}',
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_discount_percent DECIMAL(5,2) DEFAULT 0,
  extra_discount_type TEXT,
  extra_discount_value DECIMAL(10,2) DEFAULT 0,
  -- Second pair
  second_pair_enabled BOOLEAN DEFAULT false,
  second_pair_price DECIMAL(10,2) DEFAULT 0,
  second_pair_description TEXT,
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL,
  total_discount DECIMAL(10,2) DEFAULT 0,
  final_total DECIMAL(10,2) NOT NULL,
  -- AI generated text
  ai_description TEXT,
  -- Notes
  notes TEXT,
  -- Status
  is_finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales table (when budget is converted)
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  final_value DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for company_settings
CREATE POLICY "Everyone can view company settings" ON public.company_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage company settings" ON public.company_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view all customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (true);

-- RLS Policies for services
CREATE POLICY "Admins and managers can view all services" ON public.services
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view their own services" ON public.services
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Authenticated users can create services" ON public.services
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update their own services" ON public.services
  FOR UPDATE USING (auth.uid() = seller_id OR public.is_admin_or_manager(auth.uid()));

-- RLS Policies for budgets
CREATE POLICY "Admins and managers can view all budgets" ON public.budgets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.services s 
      WHERE s.id = service_id 
      AND (public.is_admin_or_manager(auth.uid()) OR s.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can create budgets for their services" ON public.budgets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.services s 
      WHERE s.id = service_id 
      AND s.seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can update budgets for their services" ON public.budgets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.services s 
      WHERE s.id = service_id 
      AND (s.seller_id = auth.uid() OR public.is_admin_or_manager(auth.uid()))
    )
  );

-- RLS Policies for sales
CREATE POLICY "Admins and managers can view all sales" ON public.sales
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view their own sales" ON public.sales
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Authenticated users can create sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  -- Default role is seller
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'seller');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default company settings
INSERT INTO public.company_settings (company_name, slogan, footer_text, budget_terms)
VALUES (
  'Sua Ótica',
  'Visão clara, vida melhor',
  'Obrigado pela preferência!',
  'Orçamento válido por 7 dias. Preços sujeitos a alteração sem aviso prévio.'
);

-- Create indexes for performance
CREATE INDEX idx_services_seller_id ON public.services(seller_id);
CREATE INDEX idx_services_customer_id ON public.services(customer_id);
CREATE INDEX idx_services_status ON public.services(status);
CREATE INDEX idx_budgets_service_id ON public.budgets(service_id);
CREATE INDEX idx_sales_seller_id ON public.sales(seller_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);