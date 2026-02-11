-- Add 'draft' to the service_status enum
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'in_progress';
