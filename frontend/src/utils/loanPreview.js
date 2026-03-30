export function today() {
  return new Date().toISOString().split('T')[0];
}

export function buildLocalDueDatePreview(itemType, checkoutDate, loanPolicies) {
  const normalizedType = String(itemType || 'book').toLowerCase();
  const policy =
    loanPolicies.find((entry) => entry.itemType === normalizedType) ||
    loanPolicies.find((entry) => entry.itemType === 'book') || {
      itemType: 'book',
      label: 'Book',
      loanPeriodDays: 21,
      isBorrowable: true
    };

  const startDate = new Date(checkoutDate || today());
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + policy.loanPeriodDays);

  return {
    itemType: policy.itemType,
    label: policy.label,
    loanPeriodDays: policy.loanPeriodDays,
    isBorrowable: policy.isBorrowable,
    checkoutDate: startDate.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0]
  };
}
