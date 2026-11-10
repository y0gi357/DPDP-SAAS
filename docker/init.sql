-- Application role: cannot bypass RLS, cannot own tables.
CREATE ROLE app_user LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE dpdpa TO app_user;
