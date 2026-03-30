-- Library Catalog System - Supabase/Postgres schema
-- Run this in the Supabase SQL Editor.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.publishers (
  id bigint generated always as identity primary key,
  name text not null unique,
  address text,
  city text,
  country text,
  email text,
  phone text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  parent_category_id bigint references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.authors (
  id bigint generated always as identity primary key,
  first_name text not null,
  last_name text not null,
  biography text,
  birth_date date,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id bigint generated always as identity primary key,
  title text not null,
  isbn text unique,
  isbn13 text unique,
  publisher_id bigint references public.publishers(id) on delete set null,
  category_id bigint references public.categories(id) on delete set null,
  publication_date date,
  description text,
  language text default 'English',
  pages integer check (pages is null or pages > 0),
  edition text,
  format text check (format in ('Hardcover', 'Paperback', 'E-book', 'Audiobook', 'DVD', 'Magazine', 'Reference', 'Other')),
  is_digital boolean not null default false,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_authors (
  book_id bigint not null references public.books(id) on delete cascade,
  author_id bigint not null references public.authors(id) on delete cascade,
  author_order integer not null default 1,
  role text default 'Author',
  primary key (book_id, author_id)
);

create table if not exists public.copies (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  barcode text not null unique,
  copy_number integer not null default 1,
  acquisition_date date,
  cost numeric(10, 2),
  condition text default 'Good' check (condition in ('Excellent', 'Good', 'Fair', 'Poor')),
  status text not null default 'Available' check (status in ('Available', 'Checked Out', 'Reserved', 'Damaged', 'Lost')),
  location_shelf text,
  location_rack text,
  last_maintenance_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.keywords (
  id bigint generated always as identity primary key,
  keyword text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.book_keywords (
  book_id bigint not null references public.books(id) on delete cascade,
  keyword_id bigint not null references public.keywords(id) on delete cascade,
  primary key (book_id, keyword_id)
);

create table if not exists public.digital_assets (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  asset_type text not null check (asset_type in ('E-book', 'Audiobook', 'PDF', 'Video', 'Other')),
  file_path text,
  file_size bigint,
  mime_type text,
  access_url text,
  license_type text,
  expiration_date date,
  drm_protected boolean not null default false,
  downloads_allowed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id bigint generated always as identity primary key,
  copy_id bigint not null references public.copies(id) on delete restrict,
  book_id bigint not null references public.books(id) on delete restrict,
  borrower_name text not null,
  borrower_email text,
  borrower_id text,
  item_type text not null default 'book',
  checkout_date date not null,
  due_date date not null,
  returned_date date,
  status text not null default 'Active' check (status in ('Active', 'Returned', 'Overdue')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_books_title on public.books(title);
create index if not exists idx_books_isbn on public.books(isbn);
create index if not exists idx_books_isbn13 on public.books(isbn13);
create index if not exists idx_books_publisher_id on public.books(publisher_id);
create index if not exists idx_books_category_id on public.books(category_id);
create index if not exists idx_authors_name on public.authors(last_name, first_name);
create index if not exists idx_copies_book_id on public.copies(book_id);
create index if not exists idx_copies_barcode on public.copies(barcode);
create index if not exists idx_copies_status on public.copies(status);
create index if not exists idx_book_keywords_book_id on public.book_keywords(book_id);
create index if not exists idx_book_keywords_keyword_id on public.book_keywords(keyword_id);
create index if not exists idx_digital_assets_book_id on public.digital_assets(book_id);
create index if not exists idx_loans_copy_id on public.loans(copy_id);
create index if not exists idx_loans_book_id on public.loans(book_id);
create index if not exists idx_loans_status on public.loans(status);
create index if not exists idx_loans_due_date on public.loans(due_date);

drop trigger if exists trg_publishers_updated_at on public.publishers;
create trigger trg_publishers_updated_at
before update on public.publishers
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_authors_updated_at on public.authors;
create trigger trg_authors_updated_at
before update on public.authors
for each row execute function public.set_updated_at();

drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at
before update on public.books
for each row execute function public.set_updated_at();

drop trigger if exists trg_copies_updated_at on public.copies;
create trigger trg_copies_updated_at
before update on public.copies
for each row execute function public.set_updated_at();

drop trigger if exists trg_digital_assets_updated_at on public.digital_assets;
create trigger trg_digital_assets_updated_at
before update on public.digital_assets
for each row execute function public.set_updated_at();

drop trigger if exists trg_loans_updated_at on public.loans;
create trigger trg_loans_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

insert into public.publishers (name, country, website)
values
  ('Unknown Publisher', null, null),
  ('Penguin Books', 'United Kingdom', 'www.penguin.co.uk'),
  ('Bantam Books', 'United States', 'www.bantam.com')
on conflict (name) do nothing;

insert into public.categories (name, description)
values
  ('General', 'Default category for uncategorized books'),
  ('Fiction', 'Fictional works'),
  ('Fantasy', 'Fantasy novels'),
  ('Science Fiction', 'Science fiction novels')
on conflict (name) do nothing;
