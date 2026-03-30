const express = require('express');
const store = require('../data/store');
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

router.get('/loans', async (req, res) => {
  try {
    const status = req.query.status || 'Active';
    const result = await store.listLoans(status);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch loans',
      message: error.message,
      status: 500
    });
  }
});

router.post('/checkout', async (req, res) => {
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

    const calculation = calculateDueDate(item_type || 'book', checkout_date || new Date());
    if (!calculation.isBorrowable) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'This item type cannot be borrowed',
        status: 400
      });
    }

    const result = await store.checkoutBook({
      copyId: Number(copy_id),
      borrowerName: borrower_name,
      borrowerEmail: borrower_email,
      borrowerId: borrower_id,
      itemType: item_type,
      checkoutDate: checkout_date,
      notes,
      calculation
    });

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

router.post('/loans/:id/return', async (req, res) => {
  try {
    const returnedDate = req.body.returned_date || new Date().toISOString().split('T')[0];
    const result = await store.returnLoan(req.params.id, returnedDate);

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
