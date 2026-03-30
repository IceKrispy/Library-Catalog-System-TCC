const LOAN_POLICIES = {
  book: { label: 'Book', loanPeriodDays: 21 },
  hardcover: { label: 'Hardcover Book', loanPeriodDays: 21 },
  paperback: { label: 'Paperback Book', loanPeriodDays: 21 },
  'e-book': { label: 'E-book', loanPeriodDays: 14 },
  ebook: { label: 'E-book', loanPeriodDays: 14 },
  audiobook: { label: 'Audiobook', loanPeriodDays: 14 },
  dvd: { label: 'DVD', loanPeriodDays: 7 },
  magazine: { label: 'Magazine', loanPeriodDays: 7 },
  reference: { label: 'Reference Item', loanPeriodDays: 0 }
};

function normalizeItemType(itemType) {
  return String(itemType || 'book').trim().toLowerCase();
}

function getLoanPolicy(itemType) {
  const normalizedItemType = normalizeItemType(itemType);
  const policy = LOAN_POLICIES[normalizedItemType] || LOAN_POLICIES.book;

  return {
    itemType: normalizedItemType,
    label: policy.label,
    loanPeriodDays: policy.loanPeriodDays,
    isBorrowable: policy.loanPeriodDays > 0
  };
}

function calculateDueDate(itemType, checkoutDate = new Date()) {
  const policy = getLoanPolicy(itemType);
  const startDate = new Date(checkoutDate);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error('Invalid checkout date');
  }

  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + policy.loanPeriodDays);

  return {
    ...policy,
    checkoutDate: startDate.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0]
  };
}

function listLoanPolicies() {
  return Object.entries(LOAN_POLICIES).map(([itemType, policy]) => ({
    itemType,
    label: policy.label,
    loanPeriodDays: policy.loanPeriodDays,
    isBorrowable: policy.loanPeriodDays > 0
  }));
}

module.exports = {
  calculateDueDate,
  getLoanPolicy,
  listLoanPolicies
};
