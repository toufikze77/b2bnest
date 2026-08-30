UPDATE public.bank_accounts
SET account_number = public.encrypt_banking_data(account_number)
WHERE account_number IS NOT NULL AND account_number <> '' AND account_number NOT LIKE 'ENC:%';

UPDATE public.bank_accounts
SET sort_code = public.encrypt_banking_data(sort_code)
WHERE sort_code IS NOT NULL AND sort_code <> '' AND sort_code NOT LIKE 'ENC:%';