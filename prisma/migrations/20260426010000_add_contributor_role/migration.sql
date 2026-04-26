-- Add CONTRIBUTOR to UserRole. Postgres supports adding enum values
-- without rewriting existing rows.
ALTER TYPE "UserRole" ADD VALUE 'CONTRIBUTOR' BEFORE 'ADMIN';
