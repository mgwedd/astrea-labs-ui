-- Custom SQL migration file, put your code below! --
-- signed_documents and document_reviews are append-only evidence (spec D2, E).
-- Reject UPDATE, DELETE and TRUNCATE at the database, so no code path (or
-- admin query) can change or remove a signed record. A correction is a new
-- row whose supersedes points at the old one.
CREATE OR REPLACE FUNCTION reject_append_only_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER signed_documents_append_only
  BEFORE UPDATE OR DELETE ON signed_documents
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER signed_documents_no_truncate
  BEFORE TRUNCATE ON signed_documents
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER document_reviews_append_only
  BEFORE UPDATE OR DELETE ON document_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER document_reviews_no_truncate
  BEFORE TRUNCATE ON document_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
