const express = require('express');
const db = require('../db/database');
const { calculateDueDate, listLoanPolicies } = require('../services/loanPolicies');

const router = express.Router();

router.get('/loan-policies', (req, res) => {
  res.json({ data: listLoanPolicies() });
});

router.post('/due-date', (req, res) => {
  try {
    const itemType = req.body?.item_type || 'book';
    const checkoutDate = req.body?.checkout_date || new Date().toISOString().split('T')[0];
    const calculation = calculateDueDate(itemType, checkoutDate);

    res.json({
      message: 'Due date calculated successfully',
      data: calculation
    });
  } catch (error) {
    res.status(400).json({
      error: 'Validation error',
      message: error.message,
      status: 400
    });
  }
});

router.get('/loans', (req, res) => {
  try {
    const status = req.query.status || 'Active';
    const rows = db.prepare(
      `SELECT l.id, l.copy_id, l.book_id, l.borrower_name, l.borrower_email, l.borrower_id,
              l.item_type, l.checkout_date, l.due_date, l.returned_date, l.status, l.notes,
              b.title, b.format, c.barcode, c.copy_number
       FROM loans l
       JOIN books b ON b.id = l.book_id
       JOIN copies c ON c.id = l.copy_id
       WHERE (? = 'all' OR l.status = ?)
       ORDER BY
         CASE WHEN l.status = 'Active' THEN 0 WHEN l.status = 'Overdue' THEN 1 ELSE 2 END,
         l.due_date ASC,
         l.created_at DESC`
    ).all(status, status);

    res.json({ data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch loans',
      message: error.message,
      status: 500
    });
  }
});

router.post('/checkout', (req, res) => {
  try {
    const {
      copy_id,
      borrower_name,
      borrower_email,
      borrower_id,
      item_type,
      checkout_date,
      notes
    } = req.body;

    if (!copy_id || !borrower_name || borrower_name.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'copy_id and borrower_name are required',
        status: 400
      });
    }

    const checkoutTransaction = db.transaction(() => {
      const copy = db.prepare(
        `SELECT c.id, c.book_id, c.status, c.barcode, c.copy_number, b.title, b.format
         FROM copies c
         JOIN books b ON b.id = c.book_id
         WHERE c.id = ?`
      ).get(copy_id);

      if (!copy) {
        const err = new Error(`Copy with id ${copy_id} not found`);
        err.status = 404;
        throw err;
      }

      if (copy.status !== 'Available') {
        const err = new Error(`Copy ${copy.barcode} is not available for checkout`);
        err.status = 409;
        throw err;
      }

      const existingLoan = db.prepare(
        `SELECT id FROM loans WHERE copy_id = ? AND status IN ('Active', 'Overdue')`
      ).get(copy_id);

      if (existingLoan) {
        const err = new Error('This copy already has an active loan');
        err.status = 409;
        throw err;
      }

      const calculation = calculateDueDate(item_type || copy.format || 'book', checkout_date || new Date());

      if (!calculation.isBorrowable) {
        const err = new Error('This item type cannot be borrowed');
        err.status = 400;
        throw err;
      }

      const insert = db.prepare(
        `INSERT INTO loans (
          copy_id, book_id, borrower_name, borrower_email, borrower_id,
          item_type, checkout_date, due_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        copy.id,
        copy.book_id,
        borrower_name.trim(),
        borrower_email || null,
        borrower_id || null,
        calculation.itemType,
        calculation.checkoutDate,
        calculation.dueDate,
        notes || null
      );

      db.prepare(
        `UPDATE copies
         SET status = 'Checked Out', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(copy.id);

      return {
        id: insert.lastInsertRowid,
        copy_id: copy.id,
        book_id: copy.book_id,
        title: copy.title,
        barcode: copy.barcode,
        borrower_name: borrower_name.trim(),
        checkout_date: calculation.checkoutDate,
        due_date: calculation.dueDate,
        loan_period_days: calculation.loanPeriodDays,
        status: 'Active'
      };
    });

    const result = checkoutTransaction();
    res.status(201).json({
      message: 'Book checked out successfully',
      data: result
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status ? 'Request failed' : 'Failed to checkout copy',
      message: error.message,
      status: error.status || 500
    });
  }
});

router.post('/loans/:id/return', (req, res) => {
  try {
    const loanId = Number(req.params.id);
    const returnedDate = req.body.returned_date || new Date().toISOString().split('T')[0];

    const returnTransaction = db.transaction(() => {
      const loan = db.prepare(
        `SELECT l.id, l.copy_id, l.status, l.book_id, b.title, c.barcode
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN copies c ON c.id = l.copy_id
         WHERE l.id = ?`
      ).get(loanId);

      if (!loan) {
        const err = new Error(`Loan with id ${loanId} not found`);
        err.status = 404;
        throw err;
      }

      if (loan.status === 'Returned') {
        const err = new Error('This loan has already been returned');
        err.status = 409;
        throw err;
      }

      db.prepare(
        `UPDATE loans
         SET status = 'Returned', returned_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(returnedDate, loan.id);

      db.prepare(
        `UPDATE copies
         SET status = 'Available', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(loan.copy_id);

      return {
        id: loan.id,
        title: loan.title,
        barcode: loan.barcode,
        returned_date: returnedDate,
        status: 'Returned'
      };
    });

    const result = returnTransaction();
    res.json({
      message: 'Book returned successfully',
      data: result
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status ? 'Request failed' : 'Failed to return copy',
      message: error.message,
      status: error.status || 500
    });
  }
});

module.exports = router;
