-- Create bank accounts table for storing connected bank accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL, -- TrueLayer account ID
  provider_id TEXT NOT NULL, -- Bank provider ID
  provider_name TEXT NOT NULL, -- Bank name (e.g., 'hsbc', 'barclays')
  account_type TEXT NOT NULL, -- 'current', 'savings', 'credit_card'
  account_number TEXT,
  sort_code TEXT,
  currency TEXT NOT NULL DEFAULT 'GBP',
  balance DECIMAL(15,2),
  available_balance DECIMAL(15,2),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank transactions table for storing synced transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL, -- TrueLayer transaction ID
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  description TEXT,
  transaction_type TEXT NOT NULL, -- 'debit', 'credit'
  category TEXT,
  merchant_name TEXT,
  transaction_date DATE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  balance_after DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, bank_account_id)
);

-- Enable Row Level Security
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for bank_accounts
CREATE POLICY "Users can manage their own bank accounts" 
ON public.bank_accounts 
FOR ALL 
USING (auth.uid() = user_id);

-- Create policies for bank_transactions
CREATE POLICY "Users can view their own bank transactions" 
ON public.bank_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert bank transactions" 
ON public.bank_transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_provider ON public.bank_accounts(provider_name);
CREATE INDEX idx_bank_transactions_user_id ON public.bank_transactions(user_id);
CREATE INDEX idx_bank_transactions_account_id ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(transaction_date);

-- Create function to update timestamps
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_bank_transactions_updated_at
BEFORE UPDATE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();