const { supabase } = require('../lib/supabase');

function unwrapSingleRelation(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function assertNoError(error, fallbackMessage) {
  if (!error) {
    return;
  }

  const nextError = new Error(error.message || fallbackMessage);
  nextError.status = error.code === 'PGRST116' ? 404 : 500;
  throw nextError;
}

function normalizeBookFormat(format) {
  const value = String(format || '').trim().toLowerCase();

  switch (value) {
    case '':
      return 'Hardcover';
    case 'hardcover':
      return 'Hardcover';
    case 'paperback':
      return 'Paperback';
    case 'ebook':
    case 'e-book':
    case 'e book':
      return 'E-book';
    case 'audiobook':
      return 'Audiobook';
    case 'dvd':
      return 'DVD';
    case 'magazine':
      return 'Magazine';
    case 'reference':
      return 'Reference';
    default:
      return 'Other';
  }
}

function mapBookSummary(row) {
  const publisher = unwrapSingleRelation(row.publisher);
  const category = unwrapSingleRelation(row.category);
  const copies = Array.isArray(row.copies) ? row.copies : [];

  return {
    id: row.id,
    title: row.title,
    isbn: row.isbn,
    isbn13: row.isbn13,
    format: row.format,
    language: row.language,
    pages: row.pages,
    publication_date: row.publication_date,
    publisher_name: publisher?.name || null,
    category_name: category?.name || null,
    total_copies: copies.length,
    available_copies: copies.filter((copy) => copy.status === 'Available').length
  };
}

function mapBookDetail(row) {
  const publisher = unwrapSingleRelation(row.publisher);
  const category = unwrapSingleRelation(row.category);

  return {
    id: row.id,
    title: row.title,
    isbn: row.isbn,
    isbn13: row.isbn13,
    publisher_id: row.publisher_id,
    category_id: row.category_id,
    publication_date: row.publication_date,
    description: row.description,
    pages: row.pages,
    language: row.language,
    format: row.format,
    is_digital: Boolean(row.is_digital),
    cover_image_url: row.cover_image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    publisher_name: publisher?.name || null,
    category_name: category?.name || null,
    authors: (row.book_authors || [])
      .map((item) => {
        const author = unwrapSingleRelation(item.author);
        if (!author) {
          return null;
        }

        return {
          id: author.id,
          first_name: author.first_name,
          last_name: author.last_name,
          author_order: item.author_order,
          role: item.role || 'Author'
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.author_order - right.author_order),
    copies: (row.copies || []).map((copy) => ({
      id: copy.id,
      barcode: copy.barcode,
      copy_number: copy.copy_number,
      status: copy.status,
      condition: copy.condition,
      acquisition_date: copy.acquisition_date,
      location_shelf: copy.location_shelf,
      location_rack: copy.location_rack
    })),
    keywords: (row.book_keywords || [])
      .map((item) => unwrapSingleRelation(item.keyword))
      .filter(Boolean)
      .map((keyword) => ({
        id: keyword.id,
        keyword: keyword.keyword
      })),
    digital_assets: (row.digital_assets || []).map((asset) => ({
      id: asset.id,
      asset_type: asset.asset_type,
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      drm_protected: Boolean(asset.drm_protected)
    }))
  };
}

function mapLoanRow(row) {
  const book = unwrapSingleRelation(row.book);
  const copy = unwrapSingleRelation(row.copy);

  return {
    id: row.id,
    copy_id: row.copy_id,
    book_id: row.book_id,
    borrower_name: row.borrower_name,
    borrower_email: row.borrower_email,
    borrower_id: row.borrower_id,
    item_type: row.item_type,
    checkout_date: row.checkout_date,
    due_date: row.due_date,
    returned_date: row.returned_date,
    status: row.status,
    notes: row.notes,
    title: book?.title || null,
    format: book?.format || null,
    barcode: copy?.barcode || null,
    copy_number: copy?.copy_number || null,
    created_at: row.created_at
  };
}

async function getOrCreateNamedRow(table, name, extraData = {}) {
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    assertNoError(existingError, `Failed to query ${table}`);
  }

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ name, ...extraData })
    .select('id')
    .single();

  assertNoError(error, `Failed to create ${table} default row`);
  return data.id;
}

async function ensureDefaultPublisher() {
  return getOrCreateNamedRow('publishers', 'Unknown Publisher');
}

async function ensureDefaultCategory() {
  return getOrCreateNamedRow('categories', 'General', {
    description: 'Default category for uncategorized books'
  });
}

async function findDuplicateBook(isbn, isbn13, excludedBookId = null) {
  const filters = [];
  const safeIsbn = typeof isbn === 'string' ? isbn.trim() : '';
  const safeIsbn13 = typeof isbn13 === 'string' ? isbn13.trim() : '';

  if (safeIsbn) {
    filters.push(`isbn.eq.${safeIsbn}`, `isbn13.eq.${safeIsbn}`);
  }

  if (safeIsbn13) {
    filters.push(`isbn.eq.${safeIsbn13}`, `isbn13.eq.${safeIsbn13}`);
  }

  if (filters.length === 0) {
    return null;
  }

  let query = supabase
    .from('books')
    .select('id')
    .or(filters.join(','))
    .limit(5);

  if (excludedBookId) {
    query = query.neq('id', Number(excludedBookId));
  }

  const { data, error } = await query;
  assertNoError(error, 'Failed to check duplicate ISBN');

  return data?.[0] || null;
}

async function listBooks(page = 1, limit = 20) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, count, error } = await supabase
    .from('books')
    .select(
      `
        id,
        title,
        isbn,
        isbn13,
        format,
        language,
        pages,
        publication_date,
        publisher:publishers(name),
        category:categories(name),
        copies(status)
      `,
      { count: 'exact' }
    )
    .order('title', { ascending: true })
    .range(from, to);

  assertNoError(error, 'Failed to fetch books');

  const total = count || 0;
  return {
    data: (data || []).map(mapBookSummary),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit) || 1
    }
  };
}

async function searchBooks(query, categoryId, limit = 20) {
  const normalizedQuery = String(query || '').trim();
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const likeQuery = normalizedQuery.replace(/[%(),]/g, ' ').trim();

  let request = supabase
    .from('books')
    .select(
      `
        id,
        title,
        isbn,
        isbn13,
        format,
        language,
        pages,
        publication_date,
        publisher:publishers(name),
        category:categories(name),
        copies(status)
      `
    )
    .or(
      `title.ilike.%${likeQuery}%,description.ilike.%${likeQuery}%,isbn.ilike.%${likeQuery}%,isbn13.ilike.%${likeQuery}%`
    )
    .order('title', { ascending: true })
    .limit(safeLimit);

  if (categoryId) {
    request = request.eq('category_id', Number(categoryId));
  }

  const { data, error } = await request;
  assertNoError(error, 'Failed to search books');

  const mapped = (data || []).map(mapBookSummary);
  return {
    data: mapped,
    total: mapped.length
  };
}

async function getBookById(id) {
  const { data, error } = await supabase
    .from('books')
    .select(
      `
        id,
        title,
        isbn,
        isbn13,
        publisher_id,
        category_id,
        publication_date,
        description,
        pages,
        language,
        format,
        is_digital,
        cover_image_url,
        created_at,
        updated_at,
        publisher:publishers(name),
        category:categories(name),
        book_authors(
          author_order,
          role,
          author:authors(
            id,
            first_name,
            last_name
          )
        ),
        copies(
          id,
          barcode,
          copy_number,
          status,
          condition,
          acquisition_date,
          location_shelf,
          location_rack
        ),
        book_keywords(
          keyword:keywords(
            id,
            keyword
          )
        ),
        digital_assets(
          id,
          asset_type,
          file_size,
          mime_type,
          drm_protected
        )
      `
    )
    .eq('id', Number(id))
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    assertNoError(error, 'Failed to fetch book');
  }

  return data ? mapBookDetail(data) : null;
}

async function getBookByISBN(isbn) {
  const { data, error } = await supabase
    .from('books')
    .select(
      `
        id,
        title,
        isbn,
        isbn13,
        publisher_id,
        category_id,
        publication_date,
        description,
        pages,
        language,
        format,
        is_digital,
        cover_image_url,
        created_at,
        updated_at,
        publisher:publishers(name),
        category:categories(name)
      `
    )
    .or(`isbn.eq.${isbn},isbn13.eq.${isbn}`)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    assertNoError(error, 'Failed to fetch book by ISBN');
  }

  if (!data) {
    return null;
  }

  const publisher = unwrapSingleRelation(data.publisher);
  const category = unwrapSingleRelation(data.category);

  return {
    ...data,
    publisher_name: publisher?.name || null,
    category_name: category?.name || null,
    is_digital: Boolean(data.is_digital)
  };
}

async function createBook(payload) {
  const duplicate = await findDuplicateBook(payload.isbn, payload.isbn13);
  if (duplicate) {
    const error = new Error('ISBN already exists in catalog');
    error.status = 409;
    throw error;
  }

  let publisherId = payload.publisher_id ? Number(payload.publisher_id) : null;
  let categoryId = payload.category_id ? Number(payload.category_id) : null;

  if (publisherId) {
    const { data, error } = await supabase.from('publishers').select('id').eq('id', publisherId).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      assertNoError(error, 'Failed to verify publisher');
    }
    if (!data) {
      const nextError = new Error(`Publisher with id ${publisherId} not found`);
      nextError.status = 400;
      throw nextError;
    }
  } else {
    publisherId = await ensureDefaultPublisher();
  }

  if (categoryId) {
    const { data, error } = await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      assertNoError(error, 'Failed to verify category');
    }
    if (!data) {
      const nextError = new Error(`Category with id ${categoryId} not found`);
      nextError.status = 400;
      throw nextError;
    }
  } else {
    categoryId = await ensureDefaultCategory();
  }

  const { data, error } = await supabase
    .from('books')
    .insert({
      title: payload.title.trim(),
      isbn: payload.isbn || null,
      isbn13: payload.isbn13 || null,
      publisher_id: publisherId,
      category_id: categoryId,
      publication_date: payload.publication_date || null,
      description: payload.description || null,
      pages: payload.pages ?? null,
      language: payload.language || 'English',
      format: normalizeBookFormat(payload.format),
      is_digital: Boolean(payload.is_digital),
      cover_image_url: payload.cover_image_url || null
    })
    .select('id, title')
    .single();

  assertNoError(error, 'Failed to create book');
  return data;
}

async function updateBook(id, payload) {
  const numericId = Number(id);
  const { data: existing, error: existingError } = await supabase
    .from('books')
    .select('id, isbn, isbn13')
    .eq('id', numericId)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    assertNoError(existingError, 'Failed to fetch existing book');
  }

  if (!existing) {
    return null;
  }

  const duplicate = await findDuplicateBook(payload.isbn ?? existing.isbn, payload.isbn13 ?? existing.isbn13, numericId);
  if (duplicate) {
    const error = new Error('ISBN already exists in catalog');
    error.status = 409;
    throw error;
  }

  const updateData = {};
  const allowedFields = [
    'title',
    'isbn',
    'isbn13',
    'description',
    'pages',
    'publication_date',
    'language',
    'format',
    'cover_image_url'
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updateData[field] = field === 'title' && typeof payload[field] === 'string'
        ? payload[field].trim()
        : payload[field];
    }
  }

  if (updateData.format !== undefined) {
    updateData.format = normalizeBookFormat(updateData.format);
  }

  if (payload.is_digital !== undefined) {
    updateData.is_digital = Boolean(payload.is_digital);
  }

  const { data, error } = await supabase
    .from('books')
    .update(updateData)
    .eq('id', numericId)
    .select('id')
    .single();

  assertNoError(error, 'Failed to update book');
  return data;
}

async function deleteBook(id) {
  const numericId = Number(id);
  const { data, error } = await supabase
    .from('books')
    .delete()
    .eq('id', numericId)
    .select('id')
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    assertNoError(error, 'Failed to delete book');
  }

  return Boolean(data);
}

async function listLoans(status = 'Active') {
  let query = supabase
    .from('loans')
    .select(
      `
        id,
        copy_id,
        book_id,
        borrower_name,
        borrower_email,
        borrower_id,
        item_type,
        checkout_date,
        due_date,
        returned_date,
        status,
        notes,
        created_at,
        book:books(
          title,
          format
        ),
        copy:copies(
          barcode,
          copy_number
        )
      `
    );

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  assertNoError(error, 'Failed to fetch loans');

  const rank = { Active: 0, Overdue: 1, Returned: 2 };
  const rows = (data || [])
    .map(mapLoanRow)
    .sort((left, right) => {
      const rankDiff = (rank[left.status] ?? 99) - (rank[right.status] ?? 99);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const dueDateDiff = String(left.due_date || '').localeCompare(String(right.due_date || ''));
      if (dueDateDiff !== 0) {
        return dueDateDiff;
      }

      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    })
    .map(({ created_at, ...row }) => row);

  return {
    data: rows,
    total: rows.length
  };
}

async function checkoutBook({ copyId, borrowerName, borrowerEmail, borrowerId, itemType, notes, calculation }) {
  const { data: copy, error: copyError } = await supabase
    .from('copies')
    .select(
      `
        id,
        book_id,
        status,
        barcode,
        copy_number,
        book:books(
          title,
          format
        )
      `
    )
    .eq('id', Number(copyId))
    .maybeSingle();

  if (copyError && copyError.code !== 'PGRST116') {
    assertNoError(copyError, 'Failed to fetch copy');
  }

  if (!copy) {
    const error = new Error(`Copy with id ${copyId} not found`);
    error.status = 404;
    throw error;
  }

  if (copy.status !== 'Available') {
    const error = new Error(`Copy ${copy.barcode} is not available for checkout`);
    error.status = 409;
    throw error;
  }

  const { data: existingLoan, error: loanCheckError } = await supabase
    .from('loans')
    .select('id')
    .eq('copy_id', Number(copyId))
    .in('status', ['Active', 'Overdue'])
    .limit(1)
    .maybeSingle();

  if (loanCheckError && loanCheckError.code !== 'PGRST116') {
    assertNoError(loanCheckError, 'Failed to verify active loan');
  }

  if (existingLoan) {
    const error = new Error('This copy already has an active loan');
    error.status = 409;
    throw error;
  }

  const { data: insertedLoan, error: insertLoanError } = await supabase
    .from('loans')
    .insert({
      copy_id: copy.id,
      book_id: copy.book_id,
      borrower_name: borrowerName.trim(),
      borrower_email: borrowerEmail || null,
      borrower_id: borrowerId || null,
      item_type: calculation.itemType || itemType || 'book',
      checkout_date: calculation.checkoutDate,
      due_date: calculation.dueDate,
      notes: notes || null
    })
    .select('id')
    .single();

  assertNoError(insertLoanError, 'Failed to create loan');

  const { error: updateCopyError } = await supabase
    .from('copies')
    .update({ status: 'Checked Out' })
    .eq('id', copy.id);

  assertNoError(updateCopyError, 'Failed to update copy status');

  const book = unwrapSingleRelation(copy.book);
  return {
    id: insertedLoan.id,
    copy_id: copy.id,
    book_id: copy.book_id,
    title: book?.title || null,
    barcode: copy.barcode,
    borrower_name: borrowerName.trim(),
    checkout_date: calculation.checkoutDate,
    due_date: calculation.dueDate,
    loan_period_days: calculation.loanPeriodDays,
    status: 'Active'
  };
}

async function returnLoan(loanId, returnedDate) {
  const numericLoanId = Number(loanId);
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select(
      `
        id,
        copy_id,
        status,
        book:books(
          title
        ),
        copy:copies(
          barcode
        )
      `
    )
    .eq('id', numericLoanId)
    .maybeSingle();

  if (loanError && loanError.code !== 'PGRST116') {
    assertNoError(loanError, 'Failed to fetch loan');
  }

  if (!loan) {
    const error = new Error(`Loan with id ${loanId} not found`);
    error.status = 404;
    throw error;
  }

  if (loan.status === 'Returned') {
    const error = new Error('This loan has already been returned');
    error.status = 409;
    throw error;
  }

  const { error: updateLoanError } = await supabase
    .from('loans')
    .update({
      status: 'Returned',
      returned_date: returnedDate
    })
    .eq('id', numericLoanId);

  assertNoError(updateLoanError, 'Failed to update loan');

  const { error: updateCopyError } = await supabase
    .from('copies')
    .update({ status: 'Available' })
    .eq('id', loan.copy_id);

  assertNoError(updateCopyError, 'Failed to update copy');

  const book = unwrapSingleRelation(loan.book);
  const copy = unwrapSingleRelation(loan.copy);
  return {
    id: loan.id,
    title: book?.title || null,
    barcode: copy?.barcode || null,
    returned_date: returnedDate,
    status: 'Returned'
  };
}

module.exports = {
  listBooks,
  searchBooks,
  getBookById,
  getBookByISBN,
  createBook,
  updateBook,
  deleteBook,
  listLoans,
  checkoutBook,
  returnLoan
};
