-- Recoverable store codes are encrypted on the server; login still uses hashes.
alter table pit_credentials add column if not exists code_cipher text;
