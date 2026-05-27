/**
 * SQL function-name denylist for contest judge sandbox.
 *
 * Engine config is the stronger defense. These lists are defense-in-depth so
 * future file/network/extension helpers must also clear AST validation.
 *
 * Lowercase only; validators lowercase function names before lookup.
 */

export const DUCKDB_DENYLIST: ReadonlySet<string> = new Set([
    // File reads
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "read_json",
    "read_json_auto",
    "read_text",
    "read_blob",
    "parquet_scan",
    "parquet_metadata",
    "parquet_schema",
    "glob",
    // HTTP / object storage
    "httpfs_get",
    "http_get",
    "http_post",
    "s3_object",
    "azure_blob",
    "gcs_object",
    // Extensions
    "load_extension",
    "install_extension",
    "force_install",
    // DB lifecycle
    "attach",
    "detach",
    // Introspection that exposes filesystem state
    "duckdb_extensions",
    "duckdb_settings",
    "duckdb_databases",
    "pragma_database_list",
    "pragma_database_size",
    // Postgres-compat that may shell out in extensions
    "copy_from",
    "execute",
    // System escape
    "system",
])

export const POSTGRES_DENYLIST: ReadonlySet<string> = new Set([
    // File reads
    "pg_read_file",
    "pg_read_binary_file",
    "pg_ls_dir",
    "pg_stat_file",
    // Large object IO
    "lo_import",
    "lo_export",
    "lo_get",
    "lo_put",
    // COPY ... PROGRAM is also denied at statement layer.
    "copy_to_program",
    "copy_from_program",
    // Server-side language eval / remote DB access
    "dblink",
    "dblink_connect",
    "dblink_exec",
    // System
    "pg_terminate_backend",
    "pg_cancel_backend",
    "pg_reload_conf",
])

export function denylistFor(
    dialect: "DUCKDB" | "POSTGRES"
): ReadonlySet<string> {
    return dialect === "DUCKDB" ? DUCKDB_DENYLIST : POSTGRES_DENYLIST
}
