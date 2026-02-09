const express = require('express');
const { body, validationResult } = require('express-validator');
const { SupportTicket, Profile, AdminNotification } = require('../models');
const logger = require('../utils/logger');
const { appEvents } = require('../utils/events');

const router = express.Router();

router.post('/tickets', [
  body('requester_email').isEmail().normalizeEmail(),
  body('requester_name').optional().isString().trim().isLength({ max: 200 }),
  body('subject').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Subject must be 1–500 characters'),
  body('message').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1–5000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { requester_email, requester_name, subject, message } = req.body;

    const user = await Profile.findOne({ where: { email: requester_email } });

    const ticketData = {
      subject,
      message,
      status: 'open',
      priority: 'medium'
    };

    if (user) {
      ticketData.userId = user.id;
    } else {
      ticketData.message = `From: ${requester_name || 'Guest'} (${requester_email})\n\n${message}`;
    }

    const ticket = await SupportTicket.create(ticketData);

    try {
      const notif = await AdminNotification.create({
        type: 'ticket.created',
        title: 'New Support Ticket',
        message: subject,
        readBy: [],
        data: { kind: 'ticket', id: ticket.id }
      });
      try { 
        appEvents.emit('admin.notification.created', { 
          id: notif.id, 
          type: notif.type, 
          title: notif.title, 
          message: notif.message, 
          data: notif.data, 
          createdAt: notif.createdAt 
        }); 
      } catch (err) { 
        logger.warn('Emit admin notification error', err); 
      }
    } catch (err) { 
      logger.warn('Create global admin notification error', err); 
    }

    return res.status(201).json({ success: true, data: { id: ticket.id }, message: 'Ticket created' });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create ticket' });
  }
});

module.exports = router; 